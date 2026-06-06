"use client";

import { useState } from "react";
import { Geist_Mono } from "next/font/google";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Coins, FileCheck2, CalendarRange, Landmark, Printer, Receipt, Paperclip } from "lucide-react";
import { createPurchaseInvoice, createSalesInvoice, getLatestExchangeRate, updateInvoice } from "@/app/actions/invoice";
import { getCustomers } from "@/app/actions/customer";
import { getSuppliers } from "@/app/actions/supplier";
import { getProducts } from "@/app/actions/product";
import type { Customer, Supplier, Product } from "@prisma/client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";

const geistMono = Geist_Mono({ subsets: ["latin"] });

export function CommercialInvoiceSheet({
  tenantId,
  invoice,
  trigger,
}: {
  tenantId: string;
  invoice?: any;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"PURCHASE" | "SALES">(invoice?.type ?? "SALES");
  
  // Selection States
  const [isSifen, setIsSifen] = useState(invoice ? (invoice.sifenStatus === 'PENDING' || invoice.sifenStatus === 'APPROVED') : true);
  const [paymentMethod, setPaymentMethod] = useState<"A_VISTA" | "A_PRAZO">(invoice?.dueDate ? "A_PRAZO" : "A_VISTA");
  const [dueDate, setDueDate] = useState<string>(invoice?.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : "");
  const [currency, setCurrency] = useState<"PYG" | "USD" | "BRL">(invoice?.currency ?? "PYG");
  const [customRate, setCustomRate] = useState<number>(invoice ? Number(invoice.exchangeRate) : 1);
  
  // Purchase Fields
  const [documentNumber, setDocumentNumber] = useState(invoice?.documentNumber ?? "");
  const [timbrado, setTimbrado] = useState(invoice?.timbrado ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(invoice?.attachmentUrl ?? "");
  const [uploading, setUploading] = useState(false);

  // Print Prompt States
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState("");
  const [createdInvoiceSifen, setCreatedInvoiceSifen] = useState(false);
  const [printingA4, setPrintingA4] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  
  // Reference Exchange Rates (fetched from database)
  const [exchangeRates, setExchangeRates] = useState<{
    ratePYGtoUSD: number;
    ratePYGtoBRL: number;
  }>({ ratePYGtoUSD: 7800, ratePYGtoBRL: 1350 });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState(invoice ? (invoice.customerId || invoice.supplierId || "") : "");
  
  // Adapt items format and convert prices back to unit currency
  const initialItems = invoice ? invoice.items.map((i: any) => {
    const rawPrice = Number(i.unitPrice);
    const rate = Number(invoice.exchangeRate) || 1;
    const finalPrice = invoice.currency === 'PYG' ? rawPrice : Number((rawPrice / rate).toFixed(2));
    return {
      productId: i.productId,
      quantity: Number(i.quantity),
      unitPrice: finalPrice,
      taxType: i.taxType
    };
  }) : [{ productId: "", quantity: 1, unitPrice: 0, taxType: "IVA_10" }];

  const [items, setItems] = useState<{
    productId: string;
    quantity: number;
    unitPrice: number;
    taxType: "IVA_10" | "IVA_5" | "EXENTO";
  }[]>(initialItems);
  const router = useRouter();

  async function openSheet() {
    setOpen(true);
    setLoading(true);
    try {
      const [custs, supps, prods, rate] = await Promise.all([
        getCustomers(),
        getSuppliers(),
        getProducts(),
        getLatestExchangeRate()
      ]);
      setCustomers(custs as any);
      setSuppliers(supps as any);
      setProducts(prods as any);
      if (rate) {
        const ratesObj = {
          ratePYGtoUSD: Number(rate.ratePYGtoUSD),
          ratePYGtoBRL: Number(rate.ratePYGtoBRL),
        };
        setExchangeRates(ratesObj);
        
        // Initialize customRate based on current selected currency
        if (currency === "USD") {
          setCustomRate(ratesObj.ratePYGtoUSD);
        } else if (currency === "BRL") {
          setCustomRate(ratesObj.ratePYGtoBRL);
        } else {
          setCustomRate(1);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do faturamento:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCustomerChange(id: string) {
    setSelectedCustomer(id);
    if (type === "SALES") {
      const cust = customers.find((c) => c.id === id);
      if (cust) {
        // Automatically set payment terms based on customer profile category
        if (cust.category === "juridica") {
          setPaymentMethod("A_PRAZO");
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 30);
          setDueDate(futureDate.toISOString().split("T")[0]);
        } else {
          setPaymentMethod("A_VISTA");
          setDueDate("");
        }
      }
    } else {
      const supp = suppliers.find((s) => s.id === id);
      if (supp) {
        // For purchase, check if paymentTerms or category applies, default A_VISTA
        setPaymentMethod("A_VISTA");
        setDueDate("");
      }
    }
  }

  function handlePaymentMethodChange(val: "A_VISTA" | "A_PRAZO") {
    setPaymentMethod(val);
    if (val === "A_PRAZO") {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      setDueDate(futureDate.toISOString().split("T")[0]);
    } else {
      setDueDate("");
    }
  }

  const convertPrice = (basePrice: number, from: string, to: string, rate: number) => {
    if (from === to) return basePrice;
    
    // Convert to PYG first
    let priceInPYG = basePrice;
    if (from === "USD") {
      priceInPYG = basePrice * exchangeRates.ratePYGtoUSD;
    } else if (from === "BRL") {
      priceInPYG = basePrice * exchangeRates.ratePYGtoBRL;
    }
    
    // Convert from PYG to target currency
    if (to === "PYG") {
      return priceInPYG;
    } else {
      return Number((priceInPYG / rate).toFixed(2));
    }
  };

  function handleCurrencyChange(v: "PYG" | "USD" | "BRL") {
    setCurrency(v);
    const refRate = v === "USD" 
      ? exchangeRates.ratePYGtoUSD 
      : v === "BRL" 
        ? exchangeRates.ratePYGtoBRL 
        : 1;
    setCustomRate(refRate);
    
    // Automatically convert unit prices of already added items
    const updatedItems = items.map((item) => {
      if (!item.productId) return item;
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return item;
      const rawPrice = type === "SALES" ? Number(prod.price) : Number(prod.cost);
      const prodCurrency = (prod as any).currency || "PYG";
      const newPrice = convertPrice(rawPrice, prodCurrency, v, refRate);
      return { ...item, unitPrice: newPrice };
    });
    setItems(updatedItems);
  }

  function handleTypeChange(newType: "PURCHASE" | "SALES") {
    setType(newType);
    
    const updatedItems = items.map((item) => {
      if (!item.productId) return item;
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return item;
      const rawPrice = newType === "SALES" ? Number(prod.price) : Number(prod.cost);
      const prodCurrency = (prod as any).currency || "PYG";
      const newPrice = convertPrice(rawPrice, prodCurrency, currency, customRate);
      return { ...item, unitPrice: newPrice };
    });
    setItems(updatedItems);
  }


  function addItem() {
    setItems([...items, { productId: "", quantity: 1, unitPrice: 0, taxType: "IVA_10" }]);
  }

  function updateItem(index: number, field: string, value: any) {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    if (field === "productId") {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        // Convert product price (stored in its own currency in the DB) to the selected currency
        const rawPrice = type === "SALES" ? Number(prod.price) : Number(prod.cost);
        const prodCurrency = (prod as any).currency || "PYG";
        newItems[index].unitPrice = convertPrice(rawPrice, prodCurrency, currency, customRate);
        newItems[index].taxType = (prod as any).taxType || "IVA_10";
      }
    }
    setItems(newItems);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  // Calculate Subtotals & Totals
  const totalSelectedCurrency = items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);

  const totalPYG = currency === "PYG" ? totalSelectedCurrency : totalSelectedCurrency * customRate;
  const totalUSD = currency === "USD" ? totalSelectedCurrency : totalPYG / (exchangeRates.ratePYGtoUSD || 7800);

  const handleDirectPrint = (printType: "A4" | "80mm") => {
    const url = printType === "A4"
      ? (createdInvoiceSifen
        ? `/api/v1/invoices/${createdInvoiceId}/generate`
        : `/api/invoices/${createdInvoiceId}/pdf`)
      : `/api/invoices/${createdInvoiceId}/receipt`;

    const setPrinting = printType === "A4" ? setPrintingA4 : setPrintingReceipt;
    setPrinting(true);

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    iframe.src = url;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("Direct printing failed, opening in new tab", e);
        window.open(url, "_blank");
      } finally {
        setPrinting(false);
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }
    };

    iframe.onerror = () => {
      console.error("Failed to load PDF in iframe, opening in new tab");
      window.open(url, "_blank");
      setPrinting(false);
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };
  };

  const handleClosePrompt = () => {
    setShowPrintPrompt(false);
    setCreatedInvoiceId("");
    router.refresh();
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_original_invoice.${fileExt}`;
      const filePath = `purchases/${fileName}`;

      const { error } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (error) {
        throw new Error(error.message);
      }

      const { data } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);

      setAttachmentUrl(data.publicUrl);
    } catch (err: any) {
      alert("Erro ao fazer upload do anexo: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer || items.some((i) => !i.productId || i.quantity <= 0)) return;

    setLoading(true);
    try {
      // Calculate date objects
      const issuedAt = new Date();
      let finalDueDate: Date | undefined = undefined;
      if (paymentMethod === "A_PRAZO" && dueDate) {
        finalDueDate = new Date(dueDate);
      }

      // Convert item prices back to PYG (which is the database anchor currency)
      const invoiceData = {
        type,
        customerId: selectedCustomer,
        currency,
        exchangeRate: customRate,
        issuedAt,
        dueDate: finalDueDate,
        isSifen: type === "SALES" ? isSifen : false,
        documentNumber: type === "PURCHASE" ? documentNumber : undefined,
        timbrado: type === "PURCHASE" ? timbrado : undefined,
        attachmentUrl: type === "PURCHASE" ? attachmentUrl : undefined,
        notes: `Condição: ${paymentMethod === "A_VISTA" ? "À Vista" : "A Prazo"}. Câmbio: 1 ${currency} = ${customRate} PYG.`,
        items: items.map((i) => {
          // Convert price to PYG anchor for prisma storage consistency
          const unitPriceInPYG = currency === "PYG" ? i.unitPrice : i.unitPrice * customRate;
          return {
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: unitPriceInPYG,
            taxType: i.taxType,
          };
        }),
      };

      let created: any;
      if (invoice) {
        created = await updateInvoice(invoice.id, invoiceData);
      } else if (type === "PURCHASE") {
        created = await createPurchaseInvoice(invoiceData);
      } else {
        created = await createSalesInvoice(invoiceData);
      }

      // Reset fields
      if (!invoice) {
        setSelectedCustomer("");
        setDocumentNumber("");
        setTimbrado("");
        setAttachmentUrl("");
        setItems([{ productId: "", quantity: 1, unitPrice: 0, taxType: "IVA_10" }]);
      }
      setOpen(false);

      if (!invoice && type === "SALES" && created?.id) {
        setCreatedInvoiceId(created.id);
        setCreatedInvoiceSifen(isSifen);
        setShowPrintPrompt(true);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || "Erro ao criar fatura");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) openSheet();
      }}>
        <DialogTrigger asChild>
          {trigger || (
            <button
              className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] rounded-lg shadow-sm flex items-center gap-2 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Faturar Venda / Compra
            </button>
          )}
        </DialogTrigger>
        
        <DialogContent className="max-w-[1200px] w-[90vw] h-[85vh] overflow-hidden glass-pop-up p-0 rounded-2xl border border-border shadow-2xl flex flex-col">
        
        {/* Premium Header */}
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-gradient-to-r from-muted/50 to-muted/10">
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className="text-[20px] font-bold tracking-tight text-foreground flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                {invoice ? "Editar Fatura" : "Painel de Faturamento Global"}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground font-medium pt-1">
                Lançamento integrado com controle cambial, conciliação e SIFEN
              </DialogDescription>
            </div>
            
            {/* Purchase / Sales Switcher */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl border border-border">
              <button
                type="button"
                onClick={() => handleTypeChange("SALES")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  type === "SALES"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Venda
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("PURCHASE")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  type === "PURCHASE"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Compra
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body split in two columns */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            
            {/* Left Column: Config Panel */}
            <div className="space-y-5 bg-muted/20 p-5 rounded-2xl border border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Parâmetros Comerciais</h3>
              
              {/* Sifen Option (Sales Only) */}
              {type === "SALES" && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5" /> Tipo de Venda / Emissão
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSifen(true)}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        isSifen
                          ? "border-primary/50 bg-primary/10 text-primary font-bold shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-[12px]">Legal (SIFEN)</span>
                      <span className="text-[9px] opacity-70">Validação Tributária PY</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSifen(false)}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        !isSifen
                          ? "border-primary/50 bg-primary/10 text-primary font-bold shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-[12px]">Recibo Comum</span>
                      <span className="text-[9px] opacity-70">Documento Interno</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Client Selection */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {type === "SALES" ? "Cliente" : "Fornecedor"}
                </Label>
                <Select value={selectedCustomer} onValueChange={handleCustomerChange} required>
                  <SelectTrigger className="bg-card border-border text-[13px] h-[42px] rounded-xl shadow-sm">
                    <SelectValue placeholder={`Selecione o ${type === "SALES" ? "cliente" : "fornecedor"}`} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {type === "SALES" ? (
                      customers.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-[12px]">
                          {c.name} {c.document ? `(${c.document})` : ""} — {c.category?.toUpperCase()}
                        </SelectItem>
                      ))
                    ) : (
                      suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-[12px]">
                          {s.name} {s.document ? `(${s.document})` : ""} — {s.category?.toUpperCase()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Document Number and Timbrado for Purchase */}
              {type === "PURCHASE" && (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Nº Fatura
                    </Label>
                    <Input
                      type="text"
                      required
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="000-000-0000000"
                      className="bg-card border-border text-[13px] h-[42px] rounded-xl shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Nº Timbrado
                    </Label>
                    <Input
                      type="text"
                      required
                      value={timbrado}
                      onChange={(e) => setTimbrado(e.target.value)}
                      placeholder="12345678"
                      className="bg-card border-border text-[13px] h-[42px] rounded-xl shadow-sm"
                    />
                  </div>
                </div>
              )}

              {type === "PURCHASE" && (
                <div className="space-y-2 mt-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    Documento Original (PDF ou Imagem)
                  </Label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Input
                        type="file"
                        accept="application/pdf, image/*"
                        disabled={uploading}
                        onChange={handleFileChange}
                        className="bg-card border-border text-[13px] h-[42px] rounded-xl shadow-sm pt-2"
                      />
                    </div>
                    {uploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  {attachmentUrl && (
                    <div className="flex items-center gap-1.5 mt-1 bg-primary/5 p-2 rounded-lg border border-primary/10">
                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary font-bold hover:underline truncate max-w-[280px]"
                      >
                        Visualizar Anexo
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Condition */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5" /> Condição de Faturamento
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange("A_VISTA")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === "A_VISTA"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    À Vista
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange("A_PRAZO")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === "A_PRAZO"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    A Prazo
                  </button>
                </div>
              </div>

              {/* Due Date (Credit Only) */}
              {paymentMethod === "A_PRAZO" && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Data de Vencimento
                  </Label>
                  <Input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-card border-border text-[13px] h-[42px] rounded-xl shadow-sm"
                  />
                </div>
              )}

              {/* Currency Selector (linked to engine) */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" /> Moeda da Transação
                  </Label>
                  <Select value={currency} onValueChange={handleCurrencyChange}>
                    <SelectTrigger className="bg-card border-border text-[13px] h-[42px] rounded-xl shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="PYG">PYG - Guarani Paraguai (Gs)</SelectItem>
                      <SelectItem value="USD">USD - Dólar Americano ($)</SelectItem>
                      <SelectItem value="BRL">BRL - Real Brasileiro (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Manual Rate Input */}
                {currency !== "PYG" && (
                  <div className="space-y-1.5 bg-card border border-border p-3.5 rounded-xl">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center justify-between">
                      <span>Câmbio Manual</span>
                      <span className="text-[9px] text-muted-foreground">({currency} → PYG)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={customRate}
                      onChange={(e) => setCustomRate(Number(e.target.value))}
                      className="bg-background border-border text-[13px] h-[38px] rounded-lg shadow-sm"
                    />
                    <div className="text-[9px] text-amber-500 font-semibold bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                      Ref. Oficial: 1 {currency} = {currency === "USD" ? exchangeRates.ratePYGtoUSD : exchangeRates.ratePYGtoBRL} PYG
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Items and Subtotals */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Linhas de Itens</h3>
                
                {/* Items Container */}
                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_80px_130px_100px_40px] gap-2 items-center bg-card p-3 rounded-xl border border-border">
                      {/* Product Selector */}
                      <div>
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Produto</Label>
                        <Select
                          value={item.productId}
                          onValueChange={(v) => updateItem(index, "productId", v)}
                          required
                        >
                          <SelectTrigger className="bg-background border-border text-[13px] h-[36px] rounded-lg">
                            <SelectValue placeholder="Produto" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg">
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-[12px]">
                                {p.sku} - {p.name} {p.isService ? "(Serviço)" : `(Estoque: ${Number(p.currentStock)})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Qtd</Label>
                        <Input
                          type="number"
                          required
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", Number(e.target.value))
                          }
                          placeholder="Qtd"
                          className="bg-background border-border text-[13px] h-[36px] rounded-lg"
                        />
                      </div>

                      {/* Price (In selected currency) */}
                      <div>
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Preço ({currency})</Label>
                        <Input
                          type="number"
                          required
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(index, "unitPrice", Number(e.target.value))
                          }
                          placeholder="Preço"
                          className="bg-background border-border text-[13px] h-[36px] rounded-lg"
                        />
                      </div>

                      {/* Tax Type */}
                      <div>
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">IVA</Label>
                        <Select
                          value={item.taxType}
                          onValueChange={(v) => updateItem(index, "taxType", v)}
                          required
                        >
                          <SelectTrigger className="bg-background border-border text-[13px] h-[36px] rounded-lg">
                            <SelectValue placeholder="IVA" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg">
                            <SelectItem value="IVA_10">10%</SelectItem>
                            <SelectItem value="IVA_5">5%</SelectItem>
                            <SelectItem value="EXENTO">Exento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Remove Button */}
                      <div className="pt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Item Button */}
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-bold bg-primary/5 hover:bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Item
                </button>
              </div>

              {/* Dynamic Totals Panel */}
              <div className="bg-muted/30 border border-border p-4 rounded-2xl grid grid-cols-3 gap-4 items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total em {currency}</span>
                  <div className={`${geistMono.className} text-xl font-bold text-foreground`}>
                    {formatCurrency(totalSelectedCurrency, currency)}
                  </div>
                </div>
                
                {currency !== "PYG" && (
                  <div className="space-y-0.5 border-l border-border pl-4">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Equivalente PYG</span>
                    <div className={`${geistMono.className} text-sm font-bold text-foreground/80`}>
                      {formatCurrency(totalPYG, "PYG")}
                    </div>
                  </div>
                )}
                
                {currency !== "USD" && (
                  <div className="space-y-0.5 border-l border-border pl-4">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Equivalente USD</span>
                    <div className={`${geistMono.className} text-sm font-bold text-foreground/80`}>
                      {formatCurrency(totalUSD, "USD")}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Form Footer Action Bar */}
          <div className="p-6 border-t border-border bg-muted/20 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-5 h-[42px] rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted/80 hover:text-foreground active:scale-98 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground font-bold px-7 h-[42px] rounded-xl hover:bg-primary/95 transition-all flex items-center justify-center gap-2 text-xs shadow-md active:scale-98 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
              {loading ? "Gravando..." : invoice ? "Salvar Alterações" : `Confirmar ${type === "SALES" ? "Faturamento" : "Compra"}`}
            </button>
          </div>

        </form>
        </DialogContent>
      </Dialog>

      {/* Success Print Prompt Dialog */}
      <Dialog open={showPrintPrompt} onOpenChange={(isOpen) => {
        if (!isOpen) handleClosePrompt();
      }}>
        <DialogContent className="max-w-[480px] p-6 rounded-2xl glass-pop-up border border-border shadow-2xl">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2">
              <Printer className="w-5 h-5 text-primary animate-pulse" />
              Faturamento Concluído!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A venda foi registrada com sucesso. Como deseja imprimir o documento?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => handleDirectPrint("A4")}
              disabled={printingA4}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted/80 text-foreground transition-all active:scale-98"
            >
              {printingA4 ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : (
                <Printer className="w-6 h-6 text-primary" />
              )}
              <span className="text-xs font-bold">Imprimir A4</span>
            </button>

            <button
              onClick={() => handleDirectPrint("80mm")}
              disabled={printingReceipt}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted/80 text-foreground transition-all active:scale-98"
            >
              {printingReceipt ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : (
                <Receipt className="w-6 h-6 text-primary" />
              )}
              <span className="text-xs font-bold">Imprimir 80mm</span>
            </button>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleClosePrompt}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-muted-foreground transition-all active:scale-98"
            >
              Fechar sem Imprimir
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
