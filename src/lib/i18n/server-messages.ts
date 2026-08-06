/**
 * Mensagens geradas no servidor (rotas de API, respostas da IA, erros).
 *
 * Os componentes de UI usam next-intl (`useTranslations`) com os arquivos em
 * `src/messages/*.json`. Rotas de API não têm acesso ao contexto do React, então
 * resolvem o idioma pelo cookie `NEXT_LOCALE` e usam este catálogo.
 */

export type AppLocale = "pt-BR" | "es-PY";

/** Normaliza um valor de cookie/header para um locale suportado. */
export function resolveLocale(raw: string | undefined | null): AppLocale {
  return raw === "es-PY" ? "es-PY" : "pt-BR";
}

/** Nome do idioma usado nas instruções enviadas ao modelo de IA. */
export function localeLanguageName(locale: AppLocale): string {
  return locale === "es-PY" ? "español (de Paraguay)" : "português (do Brasil)";
}

const messages = {
  "pt-BR": {
    notAuthenticated: "Não autenticado",
    aiRateLimited:
      "Muitos pedidos ao assistente em pouco tempo. Aguarde alguns minutos e tente novamente.",
    aiAttachmentTooLarge:
      "O arquivo é grande demais. Envie uma foto ou PDF de até 10 MB.",
    aiAttachmentType:
      "Formato não aceito. Envie uma foto (JPG, PNG, WEBP, HEIC) ou um PDF.",
    emptyPrompt: "Prompt vazio",
    missingApiKey:
      "A leitura de faturas por foto/PDF exige a chave GEMINI_API_KEY configurada no servidor. Comandos de texto continuam funcionando.",
    invoiceParseFailed:
      "Não foi possível analisar ou extrair os dados estruturados da fatura usando a IA do Gemini.",
    stockTransferred: "Transferência de estoque processada.",
    stockAdjusted: "Ajuste de estoque processado.",
    paymentRegistered: "Baixa processada.",
    orderProcessed: "Pedido processado.",
    productCreated: (name: string, price: unknown, cost: unknown) =>
      `Produto "${name}" com preço ${price} e custo ${cost} identificado e cadastrado com sucesso!`,
    customerCreated: (name: string) => `Cliente "${name}" cadastrado com sucesso!`,
    supplierCreated: (name: string) => `Fornecedor "${name}" cadastrado com sucesso!`,
    transactionCreated: (kind: "RECEIVABLE" | string, amount: unknown) =>
      `Transação de ${kind === "RECEIVABLE" ? "receita" : "despesa"} no valor de ${amount} registrada com sucesso!`,
    invoiceImported: (
      docNumber: string,
      supplierName: string,
      onCredit: boolean,
      itemCount: number
    ) =>
      `Fatura de compra #${docNumber} do fornecedor "${supplierName}" (${onCredit ? "A Prazo" : "À Vista"}) importada com sucesso via IA! Foram cadastrados/associados ${itemCount} produtos sem duplicidades.`,
    fallbackChat: (text: string) =>
      `Olá! Eu entendi: "${text}". Posso ajudar você a gerenciar produtos, clientes, fornecedores, transações financeiras e faturas. Diga comandos como "cadastrar produto Mouse com preço 50000 e custo 30000".`,
    defaultProductName: "Produto IA",
    defaultCustomerName: "Cliente IA",
    defaultSupplierName: "Fornecedor IA",
  },
  "es-PY": {
    notAuthenticated: "No autenticado",
    aiRateLimited:
      "Demasiadas solicitudes al asistente en poco tiempo. Espere unos minutos e intente de nuevo.",
    aiAttachmentTooLarge:
      "El archivo es demasiado grande. Envíe una foto o PDF de hasta 10 MB.",
    aiAttachmentType:
      "Formato no aceptado. Envíe una foto (JPG, PNG, WEBP, HEIC) o un PDF.",
    emptyPrompt: "Consulta vacía",
    missingApiKey:
      "La lectura de facturas por foto/PDF requiere la clave GEMINI_API_KEY configurada en el servidor. Los comandos de texto siguen funcionando.",
    invoiceParseFailed:
      "No fue posible analizar ni extraer los datos estructurados de la factura usando la IA de Gemini.",
    stockTransferred: "Transferencia de inventario procesada.",
    stockAdjusted: "Ajuste de inventario procesado.",
    paymentRegistered: "Cobro procesado.",
    orderProcessed: "Pedido procesado.",
    productCreated: (name: string, price: unknown, cost: unknown) =>
      `¡Producto "${name}" con precio ${price} y costo ${cost} identificado y registrado con éxito!`,
    customerCreated: (name: string) => `¡Cliente "${name}" registrado con éxito!`,
    supplierCreated: (name: string) => `¡Proveedor "${name}" registrado con éxito!`,
    transactionCreated: (kind: "RECEIVABLE" | string, amount: unknown) =>
      `¡Transacción de ${kind === "RECEIVABLE" ? "ingreso" : "egreso"} por el monto de ${amount} registrada con éxito!`,
    invoiceImported: (
      docNumber: string,
      supplierName: string,
      onCredit: boolean,
      itemCount: number
    ) =>
      `¡Factura de compra #${docNumber} del proveedor "${supplierName}" (${onCredit ? "A Crédito" : "Al Contado"}) importada con éxito mediante IA! Se registraron/asociaron ${itemCount} productos sin duplicados.`,
    fallbackChat: (text: string) =>
      `¡Hola! Entendí: "${text}". Puedo ayudarte a gestionar productos, clientes, proveedores, transacciones financieras y facturas. Decime comandos como "registrar producto Mouse con precio 50000 y costo 30000".`,
    defaultProductName: "Producto IA",
    defaultCustomerName: "Cliente IA",
    defaultSupplierName: "Proveedor IA",
  },
} as const;

/** Catálogo de mensagens do servidor para o idioma informado. */
export function serverMessages(locale: AppLocale) {
  return messages[locale];
}
