"use client";

import { useState } from "react";
import { Search, FileText, Calendar, Building2, HelpCircle, FileSignature } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { ContractSheet } from "./ContractSheet";
import type { Contract, Harvest } from "@prisma/client";
import { formatCurrency } from "@/lib/format";

const translations = {
  pt: {
    searchPlaceholder: "Buscar por número do contrato, silo ou grão...",
    noContracts: "Nenhum contrato encontrado.",
    number: "Nº Contrato",
    silo: "Silo",
    grain: "Grão / Cultura",
    qty: "Qtd. Vendida",
    price: "Preço Unitário",
    total: "Valor Total Est.",
    delivery: "Entrega",
    status: "Status",
    safra: "Safra",
    active: "Ativo",
    completed: "Entregue",
    cancelled: "Cancelado",
    ton: "t",
    bag: "sc",
    kg: "kg"
  },
  es: {
    searchPlaceholder: "Buscar por nro de contrato, silo o grano...",
    noContracts: "Ningún contrato encontrado.",
    number: "Nº Contrato",
    silo: "Silo",
    grain: "Grano / Cosecha",
    qty: "Cant. Vendida",
    price: "Precio Unit.",
    total: "Valor Total Est.",
    delivery: "Entrega",
    status: "Estado",
    safra: "Cosecha",
    active: "Activo",
    completed: "Entregado",
    cancelled: "Cancelado",
    ton: "t",
    bag: "sc",
    kg: "kg"
  }
};

export function ContractList({
  contracts,
  harvests,
  tenantId,
}: {
  contracts: (Contract & { harvest?: { name: string } | null })[];
  harvests: Harvest[];
  tenantId: string;
}) {
  const { language } = useLanguage();
  const currentLang = (language === 'es' || language === 'pt') ? language : 'pt';
  const t = translations[currentLang];

  const [search, setSearch] = useState("");

  const filteredContracts = contracts.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.contractNumber.toLowerCase().includes(term) ||
      c.siloName.toLowerCase().includes(term) ||
      c.grainType.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {t.active}
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {t.completed}
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            {t.cancelled}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  const getUnitSymbol = (unit: string) => {
    if (unit === "TON") return t.ton;
    if (unit === "BAG") return t.bag;
    if (unit === "KG") return t.kg;
    return unit.toLowerCase();
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border/80 rounded-[8px] pl-10 pr-4 min-h-[44px] text-[14px] font-medium placeholder:text-muted-foreground/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      {filteredContracts.length === 0 ? (
        <div className="border border-border/60 rounded-[12px] p-12 text-center bg-card/30 backdrop-blur-sm">
          <FileSignature className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-3" />
          <h3 className="text-sm font-semibold text-foreground">{t.noContracts}</h3>
        </div>
      ) : (
        <>
          {/* Desktop Table: Shown on medium screens and up */}
          <div className="hidden md:block overflow-hidden border border-border/60 rounded-[12px] bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.number}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.silo}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.grain}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.qty}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.price}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.total}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.delivery}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.safra}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary">{t.status}</th>
                    <th className="p-4 text-[11px] font-bold uppercase tracking-widest text-primary text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredContracts.map((c) => {
                    const totalEst = Number(c.quantity) * Number(c.pricePerUnit);
                    return (
                      <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 text-[13px] font-semibold text-foreground">{c.contractNumber}</td>
                        <td className="p-4 text-[13px] font-medium text-foreground">{c.siloName}</td>
                        <td className="p-4 text-[13px] font-medium text-foreground capitalize">{c.grainType}</td>
                        <td className="p-4 text-[13px] font-medium text-foreground">
                          {Number(c.quantity).toLocaleString()} {getUnitSymbol(c.unit)}
                        </td>
                        <td className="p-4 text-[13px] font-mono font-bold text-foreground">
                          {formatCurrency(Number(c.pricePerUnit), c.currency as any)}
                        </td>
                        <td className="p-4 text-[13px] font-mono font-bold text-primary dark:text-[#4ade80]">
                          {formatCurrency(totalEst, c.currency as any)}
                        </td>
                        <td className="p-4 text-[13px] font-medium text-muted-foreground">
                          {c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString() : "-"}
                        </td>
                        <td className="p-4 text-[13px] font-medium text-muted-foreground">
                          {c.harvest?.name || "-"}
                        </td>
                        <td className="p-4">{getStatusBadge(c.status)}</td>
                        <td className="p-4 text-right">
                          <ContractSheet tenantId={tenantId} contract={c} harvests={harvests} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View: Shown on small screens, hidden on md and up */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredContracts.map((c) => {
              const totalEst = Number(c.quantity) * Number(c.pricePerUnit);
              return (
                <div 
                  key={c.id} 
                  className="border border-border/80 rounded-[12px] bg-card/65 backdrop-blur-md p-5 shadow-sm space-y-4 hover:shadow-md transition-all active:scale-[0.99]"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                    <div>
                      <div className="text-[14px] font-bold text-foreground">{c.contractNumber}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-primary" />
                        {c.siloName}
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(c.status)}
                    </div>
                  </div>

                  {/* Card Content details */}
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block">Grão / Cultura</span>
                      <span className="font-semibold text-foreground capitalize mt-0.5 block">{c.grainType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block">Qtd. Contratada</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {Number(c.quantity).toLocaleString()} {getUnitSymbol(c.unit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block">Preço Acordado</span>
                      <span className="font-mono font-bold text-foreground mt-0.5 block">
                        {formatCurrency(Number(c.pricePerUnit), c.currency as any)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block">Estimativa Total</span>
                      <span className="font-mono font-extrabold text-primary dark:text-[#4ade80] mt-0.5 block">
                        {formatCurrency(totalEst, c.currency as any)}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer details */}
                  <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{c.deliveryDate ? new Date(c.deliveryDate).toLocaleDateString() : "-"}</span>
                    </div>
                    <div>
                      <span>{c.harvest?.name ? `Safra: ${c.harvest.name}` : ""}</span>
                    </div>
                  </div>

                  {/* Mobile Actions - large tap targets */}
                  <div className="pt-2 flex justify-end">
                    <ContractSheet tenantId={tenantId} contract={c} harvests={harvests} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
