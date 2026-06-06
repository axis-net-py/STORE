import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { createPurchaseInvoice, createSalesInvoice } from "@/app/actions/invoice";

// Normalizes numbers (integer for PYG, float for quantity) and cleans LatAm separators
function parseExtractedNumber(val: any, isPyg: boolean = false): number {
  if (val === undefined || val === null) return 0;
  
  if (typeof val === "string") {
    let s = val.replace(/\s/g, "");
    if (isPyg) {
      if (s.includes(".") && s.includes(",")) {
        s = s.replace(/\./g, "").replace(/,/g, ".");
      } else if (s.includes(".")) {
        s = s.replace(/\./g, "");
      } else if (s.includes(",")) {
        s = s.replace(/,/g, ".");
      }
      return parseFloat(s) || 0;
    } else {
      if (s.includes(".") && s.includes(",")) {
        s = s.replace(/\./g, "").replace(/,/g, ".");
      } else if (s.includes(",")) {
        s = s.replace(/,/g, ".");
      }
      return parseFloat(s) || 0;
    }
  }
  
  if (typeof val === "number") {
    if (isPyg && val > 0 && val < 1000) {
      if (val % 1 !== 0) {
        const strVal = val.toString();
        const decimalPart = strVal.split(".")[1] || "";
        const decimalCount = decimalPart.length;
        const factor = Math.max(1000, Math.pow(10, decimalCount));
        return Math.round(val * factor);
      } else {
        return val * 1000;
      }
    }
    return val;
  }
  
  return 0;
}

// Normalizes and maps product units
function normalizeUnit(name: string, extractedUnit?: string): string {
  const n = (name || "").toLowerCase();
  if (
    n.includes("diesel") ||
    n.includes("gasolina") ||
    n.includes("combustivel") ||
    n.includes("combustível") ||
    n.includes("etanol") ||
    n.includes("ethanol") ||
    n.includes("lubrificante") ||
    n.includes("oleo") ||
    n.includes("óleo")
  ) {
    return "L";
  }
  
  const u = (extractedUnit || "").toLowerCase().trim();
  if (u === "uni" || u === "unidade" || u === "unidades" || u === "un") return "un";
  if (u === "kg" || u === "kilo" || u === "quilo" || u === "kilogramas") return "kg";
  if (u === "l" || u === "litro" || u === "litros") return "L";
  if (u === "sc" || u === "saca" || u === "sacas" || u === "bag") return "sc";
  if (u === "ton" || u === "tonelada" || u === "toneladas") return "ton";
  
  return extractedUnit || "un";
}

// Helper to query Gemini API via fetch
async function callGemini(prompt: string, imageBase64?: string, mimeType?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    let contents: any[] = [];
    if (imageBase64 && mimeType) {
      contents = [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ];
    } else {
      contents = [
        {
          parts: [{ text: prompt }]
        }
      ];
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      console.error("Gemini API error:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error("Failed calling Gemini API:", err);
    return null;
  }
}

// Local NLP Fallback Engine for Core ERP
function localNlpProcessor(text: string) {
  const cleanText = text.toLowerCase().trim();

  // 1. PRODUCT
  if (cleanText.includes("produto") || cleanText.includes("artigo") || cleanText.includes("item")) {
    let name = "Novo Produto";
    let price = 0;
    let cost = 0;
    let currency = "PYG";

    const priceMatch = cleanText.match(/(?:preço|preco|valor|venda)\s*(\d+(?:[.,]\d+)?)/i);
    if (priceMatch) price = parseFloat(priceMatch[1].replace(",", "."));

    const costMatch = cleanText.match(/(?:custo|compra)\s*(\d+(?:[.,]\d+)?)/i);
    if (costMatch) cost = parseFloat(costMatch[1].replace(",", "."));

    const nameMatch = text.match(/(?:produto|artigo|item)\s+([a-zA-Z0-9\s-]+)/i);
    if (nameMatch) {
      name = nameMatch[1].replace(/(?:preço|preco|valor|venda|custo|compra).*/gi, "").trim();
    }

    return {
      action: "create_product",
      data: {
        name: name || "Produto IA",
        price,
        cost,
        currency,
        unit: "un",
        currentStock: 0,
      },
      message: `Produto "${name || "Produto IA"}" com preço ${price} e custo ${cost} identificado e cadastrado com sucesso!`
    };
  }

  // 2. CUSTOMER
  if (cleanText.includes("cliente") || cleanText.includes("comprador")) {
    let name = "Novo Cliente";
    const nameMatch = text.match(/(?:cliente|comprador)\s+([a-zA-Z\sáàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]+)/i);
    if (nameMatch) name = nameMatch[1].trim();

    return {
      action: "create_customer",
      data: {
        name: name || "Cliente IA",
        documentType: "RUC",
        isActive: true,
      },
      message: `Cliente "${name || "Cliente IA"}" cadastrado com sucesso!`
    };
  }

  // 3. SUPPLIER
  if (cleanText.includes("fornecedor") || cleanText.includes("vendedor")) {
    let name = "Novo Fornecedor";
    const nameMatch = text.match(/(?:fornecedor|vendedor)\s+([a-zA-Z\sáàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]+)/i);
    if (nameMatch) name = nameMatch[1].trim();

    return {
      action: "create_supplier",
      data: {
        name: name || "Fornecedor IA",
        documentType: "RUC",
        isActive: true,
      },
      message: `Fornecedor "${name || "Fornecedor IA"}" cadastrado com sucesso!`
    };
  }

  // 4. TRANSACTION
  if (cleanText.includes("transação") || cleanText.includes("transacao") || cleanText.includes("receita") || cleanText.includes("despesa") || cleanText.includes("pagamento") || cleanText.includes("lançar") || cleanText.includes("lancamento")) {
    let type = "PAYABLE";
    let amount = 0;
    let category = "Geral";

    if (cleanText.includes("receita") || cleanText.includes("recebimento")) {
      type = "RECEIVABLE";
    }

    const amountMatch = cleanText.match(/(?:de|valor|quantia)\s*(\d+(?:[.,]\d+)?)/i) || cleanText.match(/(\d+(?:[.,]\d+)?)\s*(?:guaranis|usd|pyg|reais)/i);
    if (amountMatch) amount = parseFloat(amountMatch[1].replace(",", "."));

    return {
      action: "create_finance_transaction",
      data: {
        type,
        amount,
        currency: "PYG",
        exchangeRate: 1,
        category,
      },
      message: `Transação de ${type === "RECEIVABLE" ? "receita" : "despesa"} no valor de ${amount} registrada com sucesso!`
    };
  }

  // default response
  return {
    action: "chat",
    message: `Olá! Eu entendi: "${text}". Posso ajudar você a gerenciar produtos, clientes, fornecedores, transações financeiras e faturas. Diga comandos como "cadastrar produto Mouse com preço 50000 e custo 30000".`
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const tenantId = session.user.tenantId;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "A chave GEMINI_API_KEY não está configurada no servidor. A IA integrada precisa da chave para processar comandos reais." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { text, image, file, mimeType, purpose, attachmentUrl } = body;
    const fileBase64 = file || image;
    // For file uploads, we only support invoice parsing since crop diagnostic is removed
    const activePurpose = purpose || "invoice";

    // 1. Invoice PDF/Image processing request
    if (activePurpose === "invoice" && fileBase64) {
      let extracted: any = null;

      if (process.env.GEMINI_API_KEY) {
        const prompt = `Você é um leitor especialista em Notas Fiscais e Faturas de Compra (especialmente do Paraguai e América Latina).
Analise o documento anexo (PDF ou Imagem) e extraia as informações necessárias para cadastrar a fatura de compra no sistema ERP.

Atenção especial para Fornecedor (Emissor):
- O fornecedor (supplier) é quem vendeu/emitiu a fatura, não o cliente/receptor (comprador). Tente extrair a Razão Social ou Nome Fantasia e RUC do fornecedor (localizado no cabeçalho do documento). Não utilize os dados da própria empresa receptora da fatura.
- Se houver logo da empresa emitente no topo do documento, use o nome dessa empresa como name/businessName do fornecedor.
- Extraia o e-mail de contato do emissor/fornecedor (ex: 'MARIVONEPRESSI@HOTMAIL.COM') do cabeçalho de dados da empresa fornecedora.

Atenção extrema para números e pontuação (Paraguai/América Latina):
- A quantidade (quantity) e preço unitário (unitPrice) devem ser retornados no formato correto.
- Na fatura original, o ponto '.' é usado como separador de milhar e a vírgula ',' como separador decimal.
- Por exemplo:
  * Uma quantidade '33,75' significa 33.75 (trinta e três ponto setenta e cinco). Você deve retornar como número ou string '33.75' (ou '33,75').
  * Um preço unitário '8.890' em PYG (Guaranis) significa 8890 (oito mil oitocentos e noventa). Você deve retornar como número ou string '8890' (ou '8.890'). NUNCA retorne 8.89 ou 8.890 como um decimal em PYG, pois isso desvalorizaria o produto em 1000x!
  * Um total '300.000' em PYG significa 300000. Retorne como número ou string '300000' (ou '300.000').

Campos a extrair:
- Nro da Fatura (documentNumber): Geralmente no formato XXX-XXX-XXXXXXX.
- Timbrado: Número de 8 dígitos (específico do Paraguai, se disponível).
- Data de Emissão (issuedAt): ISOString no formato YYYY-MM-DD.
- Moeda (currency): "PYG" (Guaranis), "USD" (Dólares) ou "BRL" (Reais).
- Taxa de Câmbio (exchangeRate): se a moeda for PYG, é 1. Se for USD, tente obter a taxa ou use 7800. Se BRL, use 1350.
- Condição de Pagamento (paymentMethod): "A_VISTA" ou "A_PRAZO".
  * Mapeie termos como "Contado", "contado", "a vista", "à vista" obrigatoriamente para "A_VISTA".
  * Mapeie termos como "Crédito", "crédito", "credito", "a prazo", "A Prazo" obrigatoriamente para "A_PRAZO".
- Fornecedor (supplier):
  * name: Nome Fantasia ou Razão Social limpa do emitente.
  * businessName: Razão Social completa do emitente.
  * document: Documento fiscal (RUC, CPF ou CNPJ) do emitente. Tente extrair o RUC do Paraguai (geralmente formato XXXXXXX-X).
  * documentType: Tipo do documento ("RUC" se Paraguai, "CNPJ" ou "CPF" se Brasil, etc.).
  * email: E-mail de contato do emitente/fornecedor (se houver, ex: 'MARIVONEPRESSI@HOTMAIL.COM').
  * phone: Telefone de contato do emitente (se houver).
  * address: Endereço do emitente (se houver).
  * city: Cidade do emitente (se houver).
- Itens da fatura (items): Array contendo para cada produto:
  * name: Nome descritivo do produto ou serviço.
  * sku: SKU ou código do produto (se houver no documento. Se não houver, crie um SKU único amigável baseado no nome do produto, sem espaços ou caracteres especiais, máximo 15 letras, ex: ADUBO-UREIA).
  * quantity: Quantidade (numérica ou string formatada, ex: '33.75' ou '33,75').
  * unitPrice: Preço unitário na moeda especificada no cabeçalho (numérica ou string formatada, ex: '8890' ou '8.890').
  * unit: Unidade de medida (ex: "un", "kg", "l", "sc").
  * taxType: Tipo de IVA ("IVA_10", "IVA_5" ou "EXENTO").

Retorne APENAS um objeto JSON puro no seguinte formato, sem formatação markdown (como \`\`\`json):
{
  "documentNumber": "string ou null",
  "timbrado": "string ou null",
  "issuedAt": "string (YYYY-MM-DD) ou null",
  "currency": "PYG" | "USD" | "BRL",
  "exchangeRate": number | string,
  "paymentMethod": "A_VISTA" | "A_PRAZO",
  "supplier": {
    "name": "string",
    "businessName": "string ou null",
    "document": "string",
    "documentType": "string",
    "email": "string ou null",
    "phone": "string ou null",
    "address": "string ou null",
    "city": "string ou null"
  },
  "items": [
    {
      "name": "string",
      "sku": "string",
      "quantity": number | string,
      "unitPrice": number | string,
      "unit": "string",
      "taxType": "IVA_10" | "IVA_5" | "EXENTO"
    }
  ]
}`;
        const geminiResponse = await callGemini(prompt, fileBase64, mimeType || "application/pdf");
        if (geminiResponse) {
          try {
            const cleanJsonStr = geminiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            extracted = JSON.parse(cleanJsonStr);
          } catch (e) {
            console.error("Erro ao fazer parse do JSON do Gemini:", e);
          }
        }
      }

      if (!extracted) {
        return NextResponse.json(
          { error: "Não foi possível analisar ou extrair os dados estruturados da fatura usando a IA do Gemini." },
          { status: 500 }
        );
      }

      // Check / Create Supplier without duplication
      const supplierDoc = extracted.supplier?.document;
      const supplierName = extracted.supplier?.name;

      let supplier: any = null;
      if (supplierDoc) {
        supplier = await prisma.supplier.findFirst({
          where: { tenantId, document: supplierDoc }
        });
      }
      if (!supplier && supplierName) {
        supplier = await prisma.supplier.findFirst({
          where: { tenantId, name: { equals: supplierName, mode: "insensitive" } }
        });
      }

      if (!supplier && supplierName) {
        supplier = await prisma.supplier.create({
          data: {
            tenantId,
            name: supplierName,
            businessName: extracted.supplier.businessName || supplierName,
            document: supplierDoc || null,
            documentType: extracted.supplier.documentType || "RUC",
            email: extracted.supplier.email || null,
            phone: extracted.supplier.phone || null,
            address: extracted.supplier.address || null,
            city: extracted.supplier.city || null,
            isActive: true,
            category: "retail",
            country: "PY"
          }
        });
      } else if (supplier && !supplier.email && extracted.supplier?.email) {
        // Update existing supplier missing email or contact details
        await prisma.supplier.update({
          where: { id: supplier.id },
          data: {
            email: extracted.supplier.email,
            phone: supplier.phone || extracted.supplier.phone || null,
            address: supplier.address || extracted.supplier.address || null,
            city: supplier.city || extracted.supplier.city || null,
          }
        });
      }

      if (!supplier) {
        throw new Error("Não foi possível resolver ou cadastrar o fornecedor da fatura.");
      }

      // Resolve Products without duplication
      const resolvedItems: any[] = [];
      const isPygInvoice = (extracted.currency || "PYG") === "PYG";
      for (const item of extracted.items) {
        let product: any = null;
        if (item.sku) {
          product = await prisma.product.findFirst({
            where: { tenantId, sku: item.sku }
          });
        }
        if (!product && item.name) {
          product = await prisma.product.findFirst({
            where: { tenantId, name: { equals: item.name, mode: "insensitive" } }
          });
        }

        const qty = parseExtractedNumber(item.quantity, false);
        const unitPrice = parseExtractedNumber(item.unitPrice, isPygInvoice);

        if (!product && item.name) {
          const cleanSku = item.sku || `PROD-${item.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
          const unit = normalizeUnit(item.name, item.unit);
          product = await prisma.product.create({
            data: {
              tenantId,
              sku: cleanSku,
              name: item.name,
              price: new Decimal(unitPrice), // Cost as price (no markup)
              cost: new Decimal(unitPrice),
              currency: extracted.currency || "PYG",
              unit: unit,
              taxType: item.taxType || "IVA_10",
              currentStock: new Decimal(0),
              isActive: true
            }
          });
        }

        if (product) {
          resolvedItems.push({
            productId: product.id,
            quantity: qty,
            unitPrice: unitPrice,
            taxType: item.taxType || product.taxType
          });
        }
      }

      if (resolvedItems.length === 0) {
        throw new Error("Nenhum produto foi resolvido ou criado na fatura.");
      }

      // Convert prices to PYG
      const exchangeRate = extracted.exchangeRate || 1;
      const parsedIssuedAt = extracted.issuedAt ? new Date(extracted.issuedAt) : new Date();
      
      // Calculate dueDate: A_PRAZO gets 30 days default; A_VISTA gets same as issuedAt (so isCredit is false in ledger)
      const dueDate = extracted.paymentMethod === "A_PRAZO"
        ? new Date(parsedIssuedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
        : parsedIssuedAt;

      const invoicePayload = {
        type: "PURCHASE" as const,
        customerId: supplier.id,
        currency: extracted.currency || "PYG",
        exchangeRate: exchangeRate,
        issuedAt: parsedIssuedAt,
        dueDate: dueDate,
        documentNumber: extracted.documentNumber || `FAC-${Math.floor(100000 + Math.random() * 900000)}`,
        timbrado: extracted.timbrado || undefined,
        notes: `Importado via IA em ${new Date().toLocaleDateString()}. Fornecedor: ${supplier.name}. Condição: ${extracted.paymentMethod === "A_PRAZO" ? "A Prazo" : "À Vista"}.`,
        attachmentUrl: attachmentUrl || undefined,
        items: resolvedItems.map(item => {
          const priceInPYG = extracted.currency === "PYG" ? item.unitPrice : item.unitPrice * exchangeRate;
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: priceInPYG,
            taxType: item.taxType,
            cost: priceInPYG
          };
        })
      };

      const createdInvoice = await createPurchaseInvoice(invoicePayload);

      return NextResponse.json({
        action: "create_purchase_invoice",
        invoiceId: createdInvoice.id,
        message: `Fatura de compra #${extracted.documentNumber || createdInvoice.id.slice(-6)} do fornecedor "${supplier.name}" (${extracted.paymentMethod === "A_PRAZO" ? "A Prazo" : "À Vista"}) importada com sucesso via IA! Foram cadastrados/associados ${resolvedItems.length} produtos sem duplicidades.`
      });
    }

    // 2. Text command request
    if (text) {
      let result: any = null;

      const prompt = `Analise a intenção do usuário: "${text}".
Temos as seguintes ações possíveis de cadastro no ERP comercial:
1. "create_product" (Produto): campos { name: string, sku?: string, price: number, cost: number, currency: "PYG"|"USD"|"BRL", unit?: string, currentStock?: number }
2. "create_customer" (Cliente): campos { name: string, document?: string, documentType?: "RUC"|"CI"|"CPF"|"CNPJ", email?: string, phone?: string, address?: string, city?: string }
3. "create_supplier" (Fornecedor): campos { name: string, document?: string, documentType?: "RUC"|"CI"|"CPF"|"CNPJ", email?: string, phone?: string, address?: string, city?: string }
4. "create_finance_transaction" (Transação Financeira/Caixa): campos { type: "RECEIVABLE"|"PAYABLE"|"TRANSFER", entityId?: string, currency: "PYG"|"USD"|"BRL", amount: number, exchangeRate: number, category?: string }
5. "create_purchase_invoice" (Fatura de Compra): campos { supplierName: string, documentNumber?: string, currency: "PYG"|"USD"|"BRL", exchangeRate: number, paymentMethod: "A_VISTA"|"A_PRAZO", items: [{ name: string, sku?: string, quantity: number, unitPrice: number, taxType?: "IVA_10"|"IVA_5"|"EXENTO" }] }
6. "create_sales_invoice" (Fatura de Venda): campos { customerName: string, documentNumber?: string, currency: "PYG"|"USD"|"BRL", exchangeRate: number, paymentMethod: "A_VISTA"|"A_PRAZO", items: [{ name: string, sku?: string, quantity: number, unitPrice: number, taxType?: "IVA_10"|"IVA_5"|"EXENTO" }] }

Atenção especial para Condição de Pagamento (paymentMethod):
- Se o usuário citar termos de condição de pagamento como "contado", "a vista", "à vista", "cash", mapeie "paymentMethod" para "A_VISTA".
- Se o usuário citar "credito", "crédito", "a prazo", "prazo", mapeie "paymentMethod" para "A_PRAZO".

Se a intenção do usuário corresponder a um cadastro, retorne um objeto JSON puro (sem markdown \`\`\`) contendo:
{
  "action": "nome_da_acao",
  "data": { ...campos mapeados... },
  "message": "Mensagem amigável de sucesso em português explicando o que foi feito"
}
Se for apenas conversa ou dúvida, retorne:
{
  "action": "chat",
  "message": "Sua resposta amigável sobre o sistema COOPER Core ERP"
}`;

      if (process.env.GEMINI_API_KEY) {
        const geminiResponse = await callGemini(prompt);
        if (geminiResponse) {
          try {
            const cleanJsonStr = geminiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            result = JSON.parse(cleanJsonStr);
          } catch (e) {
            console.error("Erro ao parsear resposta do Gemini:", e);
          }
        }
      }

      // Fallback NLP processor if Gemini fails or is not working/responding
      if (!result) {
        result = localNlpProcessor(text);
      }

      // Execute database actions if detected
      if (result.action === "create_product") {
        const sku = result.data.sku || `PROD-${result.data.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
        const isPyg = (result.data.currency || "PYG") === "PYG";
        const price = parseExtractedNumber(result.data.price, isPyg);
        const cost = parseExtractedNumber(result.data.cost, isPyg);
        const currentStock = parseExtractedNumber(result.data.currentStock, false);
        await prisma.product.create({
          data: {
            tenantId,
            sku,
            name: result.data.name,
            price: new Decimal(price || 0),
            cost: new Decimal(cost || 0),
            currency: result.data.currency || "PYG",
            unit: result.data.unit || "un",
            currentStock: new Decimal(currentStock || 0),
            isActive: true
          }
        });
      } else if (result.action === "create_customer") {
        await prisma.customer.create({
          data: {
            tenantId,
            name: result.data.name,
            document: result.data.document || null,
            documentType: result.data.documentType || "RUC",
            email: result.data.email || null,
            phone: result.data.phone || null,
            address: result.data.address || null,
            city: result.data.city || null,
            isActive: true
          }
        });
      } else if (result.action === "create_supplier") {
        await prisma.supplier.create({
          data: {
            tenantId,
            name: result.data.name,
            businessName: result.data.businessName || result.data.name,
            document: result.data.document || null,
            documentType: result.data.documentType || "RUC",
            email: result.data.email || null,
            phone: result.data.phone || null,
            address: result.data.address || null,
            city: result.data.city || null,
            isActive: true
          }
        });
      } else if (result.action === "create_finance_transaction") {
        const amount = Number(result.data.amount || 0);
        const exchangeRate = Number(result.data.exchangeRate || 1);
        await prisma.transaction.create({
          data: {
            tenantId,
            type: result.data.type || "PAYABLE",
            entityId: result.data.entityId || "Geral",
            currency: result.data.currency || "PYG",
            amount: new Decimal(amount),
            exchangeRate: new Decimal(exchangeRate),
            totalPyg: new Decimal(result.data.currency === "PYG" ? amount : amount * exchangeRate),
            category: result.data.category || "Outros"
          }
        });
      } else if (result.action === "create_purchase_invoice") {
        const supplierName = result.data.supplierName;
        let supplier = await prisma.supplier.findFirst({
          where: { tenantId, name: { equals: supplierName, mode: "insensitive" } }
        });
        if (!supplier) {
          supplier = await prisma.supplier.create({
            data: {
              tenantId,
              name: supplierName,
              businessName: supplierName,
              isActive: true,
              category: "retail",
              country: "PY"
            }
          });
        }

        const resolvedItems: any[] = [];
        const isPygInvoiceText = (result.data.currency || "PYG") === "PYG";
        for (const item of result.data.items) {
          let product = await prisma.product.findFirst({
            where: { tenantId, name: { equals: item.name, mode: "insensitive" } }
          });

          const qty = parseExtractedNumber(item.quantity, false);
          const unitPrice = parseExtractedNumber(item.unitPrice, isPygInvoiceText);

          if (!product) {
            const cleanSku = item.sku || `PROD-${item.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
            const unit = normalizeUnit(item.name, item.unit);
            product = await prisma.product.create({
              data: {
                tenantId,
                sku: cleanSku,
                name: item.name,
                price: new Decimal(unitPrice), // Cost as price (no markup)
                cost: new Decimal(unitPrice),
                currency: result.data.currency || "PYG",
                unit: unit,
                taxType: item.taxType || "IVA_10",
                currentStock: new Decimal(0),
                isActive: true
              }
            });
          }

          resolvedItems.push({
            productId: product.id,
            quantity: qty,
            unitPrice: unitPrice,
            taxType: item.taxType || product.taxType
          });
        }

        const exchangeRate = parseExtractedNumber(result.data.exchangeRate || 1, false) || 1;
        const parsedIssuedAt = new Date();
        const dueDate = result.data.paymentMethod === "A_PRAZO"
          ? new Date(parsedIssuedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
          : parsedIssuedAt;

        const invoicePayload = {
          type: "PURCHASE" as const,
          customerId: supplier.id,
          currency: result.data.currency || "PYG",
          exchangeRate: exchangeRate,
          issuedAt: parsedIssuedAt,
          dueDate: dueDate,
          documentNumber: result.data.documentNumber || `FAC-${Math.floor(100000 + Math.random() * 900000)}`,
          notes: `Registrado via comando de texto IA em ${new Date().toLocaleDateString()}. Condição: ${result.data.paymentMethod === "A_PRAZO" ? "A Prazo" : "À Vista"}.`,
          items: resolvedItems.map(item => {
            const priceInPYG = result.data.currency === "PYG" ? item.unitPrice : item.unitPrice * exchangeRate;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: priceInPYG,
              taxType: item.taxType,
              cost: priceInPYG
            };
          })
        };

        await createPurchaseInvoice(invoicePayload);
      } else if (result.action === "create_sales_invoice") {
        const customerName = result.data.customerName;
        let customer = await prisma.customer.findFirst({
          where: { tenantId, name: { equals: customerName, mode: "insensitive" } }
        });
        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              tenantId,
              name: customerName,
              isActive: true,
              category: "retail",
              country: "PY"
            }
          });
        }

        const resolvedItems: any[] = [];
        const isPygInvoiceText = (result.data.currency || "PYG") === "PYG";
        for (const item of result.data.items) {
          let product = await prisma.product.findFirst({
            where: { tenantId, name: { equals: item.name, mode: "insensitive" } }
          });

          const qty = parseExtractedNumber(item.quantity, false);
          const unitPrice = parseExtractedNumber(item.unitPrice, isPygInvoiceText);

          if (!product) {
            const cleanSku = item.sku || `PROD-${item.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
            const unit = normalizeUnit(item.name, item.unit);
            product = await prisma.product.create({
              data: {
                tenantId,
                sku: cleanSku,
                name: item.name,
                price: new Decimal(unitPrice),
                cost: new Decimal(unitPrice * 0.7),
                currency: result.data.currency || "PYG",
                unit: unit,
                taxType: item.taxType || "IVA_10",
                currentStock: new Decimal(qty),
                isActive: true
              }
            });
          } else if (Number(product.currentStock) < qty) {
            const needed = qty - Number(product.currentStock);
            await prisma.product.update({
              where: { id: product.id },
              data: { currentStock: { increment: needed } }
            });
          }

          resolvedItems.push({
            productId: product.id,
            quantity: qty,
            unitPrice: unitPrice,
            taxType: item.taxType || product.taxType
          });
        }

        const exchangeRate = result.data.exchangeRate || 1;
        const parsedIssuedAt = new Date();
        const dueDate = result.data.paymentMethod === "A_PRAZO"
          ? new Date(parsedIssuedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
          : parsedIssuedAt;

        const invoicePayload = {
          type: "SALES" as const,
          customerId: customer.id,
          currency: result.data.currency || "PYG",
          exchangeRate: exchangeRate,
          issuedAt: parsedIssuedAt,
          dueDate: dueDate,
          documentNumber: result.data.documentNumber || undefined,
          notes: `Registrado via comando de texto IA em ${new Date().toLocaleDateString()}. Condição: ${result.data.paymentMethod === "A_PRAZO" ? "A Prazo" : "À Vista"}.`,
          items: resolvedItems.map(item => {
            const priceInPYG = result.data.currency === "PYG" ? item.unitPrice : item.unitPrice * exchangeRate;
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: priceInPYG,
              taxType: item.taxType,
              cost: priceInPYG * 0.7
            };
          })
        };

        await createSalesInvoice(invoicePayload);
      }

      return NextResponse.json({
        action: result.action,
        message: result.message
      });
    }

    return NextResponse.json({ error: "Prompt vazio" }, { status: 400 });
  } catch (err: any) {
    console.error("AI Route error:", err);
    return NextResponse.json({ error: err.message || "Erro no processamento da IA" }, { status: 500 });
  }
}
