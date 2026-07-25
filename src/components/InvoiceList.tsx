"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceActions } from "@/components/InvoiceActions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Paperclip } from "lucide-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n/date-locale";

const sifenStatusKeys: Record<string, string> = {
  PENDING: "sifenPending",
  APPROVED: "sifenApproved",
  REJECTED: "sifenRejected",
  CANCELLED: "sifenCancelled",
  RECIBO_COMUN: "sifenReceipt",
};

export function InvoiceList({ invoices, tenantId }: { invoices: any[]; tenantId: string }) {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const dateLocale = useDateLocale();
  const sifenLabel = (s: string) =>
    sifenStatusKeys[s] ? t(sifenStatusKeys[s]) : s || t("sifenNotSent");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSifenStatus, setSelectedSifenStatus] = useState("all");

  const [sortField, setSortField] = useState<"type" | "customer" | "documentNumber" | "issuedAt" | "status" | "sifenStatus" | "totalAmount" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "type" | "customer" | "documentNumber" | "issuedAt" | "status" | "sifenStatus" | "totalAmount") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const term = search.toLowerCase();
    const customerName = inv.customer?.name?.toLowerCase() || "";
    const supplierName = inv.supplier?.name?.toLowerCase() || "";
    const docNum = inv.documentNumber?.toLowerCase() || "";

    const matchesSearch =
      customerName.includes(term) ||
      supplierName.includes(term) ||
      docNum.includes(term);

    const matchesType =
      selectedType === "all" || inv.type === selectedType;

    const matchesStatus =
      selectedStatus === "all" || inv.status === selectedStatus;

    const matchesSifenStatus =
      selectedSifenStatus === "all" ||
      (selectedSifenStatus === "none" && !inv.sifenStatus) ||
      (selectedSifenStatus === "RECIBO_COMUN" && inv.sifenStatus === "RECIBO_COMUN") ||
      (selectedSifenStatus === "APPROVED" && inv.sifenStatus === "APPROVED") ||
      (selectedSifenStatus === "REJECTED" && inv.sifenStatus === "REJECTED") ||
      (selectedSifenStatus === "PENDING" && inv.sifenStatus === "PENDING");

    return matchesSearch && matchesType && matchesStatus && matchesSifenStatus;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (!sortField) return 0;

    let aVal: any;
    let bVal: any;

    if (sortField === "customer") {
      aVal = (a.customer?.name || a.supplier?.name || "").toLowerCase();
      bVal = (b.customer?.name || b.supplier?.name || "").toLowerCase();
    } else if (sortField === "totalAmount") {
      aVal = Number(a.totalAmount);
      bVal = Number(b.totalAmount);
    } else if (sortField === "issuedAt") {
      aVal = new Date(a.issuedAt).getTime();
      bVal = new Date(b.issuedAt).getTime();
    } else {
      aVal = String(a[sortField] || "").toLowerCase();
      bVal = String(b[sortField] || "").toLowerCase();
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const renderSortIndicator = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▴" : " ▾";
  };

  return (
    <div className="space-y-4">
      {/* Barra de filtros padrão */}
      <FilterBar>
        <FilterField label={tc("search")} grow>
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 sm:h-9 rounded-lg border-border bg-card text-[13px]"
          />
        </FilterField>
        <FilterField label={t("type")}>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-[160px] h-10 sm:h-9 rounded-lg bg-card text-[13px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="SALES">{t("sale")}</SelectItem>
              <SelectItem value="PURCHASE">{t("purchase")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t("status")}>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[160px] h-10 sm:h-9 rounded-lg bg-card text-[13px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="PENDING">{t("pending")}</SelectItem>
              <SelectItem value="APPROVED">{t("approved")}</SelectItem>
              <SelectItem value="CANCELLED">{t("cancelled")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t("sifenStatus")}>
          <Select value={selectedSifenStatus} onValueChange={setSelectedSifenStatus}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9 rounded-lg bg-card text-[13px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">{t("sifenAll")}</SelectItem>
              <SelectItem value="none">{t("sifenNotSent")}</SelectItem>
              <SelectItem value="RECIBO_COMUN">{t("sifenReceipt")}</SelectItem>
              <SelectItem value="PENDING">{t("sifenPending")}</SelectItem>
              <SelectItem value="APPROVED">{t("sifenApproved")}</SelectItem>
              <SelectItem value="REJECTED">{t("sifenRejected")}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2.5">
        {sortedInvoices.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          sortedInvoices.map((inv: any) => (
            <div key={inv.id} className="rounded-lg border border-border bg-card p-3.5 active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {inv.customer?.name || inv.supplier?.name || "N/A"}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
                    {inv.documentNumber || inv.id.slice(-8)}
                    {inv.attachmentUrl && (
                      <a href={inv.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                        <Paperclip className="h-3 w-3" />
                      </a>
                    )}
                  </p>
                </div>
                <Badge variant={inv.type === "PURCHASE" ? "default" : "secondary"} className="shrink-0">
                  {inv.type === "PURCHASE" ? t("purchase") : t("sale")}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={inv.status === "APPROVED" ? "default" : inv.status === "CANCELLED" ? "destructive" : "outline"}
                  className="text-[10px]"
                >
                  {inv.status === "APPROVED" ? t("approved") : inv.status === "CANCELLED" ? t("cancelled") : t("pending")}
                </Badge>
                <Badge
                  variant={inv.sifenStatus === "APPROVED" ? "default" : inv.sifenStatus === "REJECTED" ? "destructive" : "outline"}
                  className="text-[10px]"
                >
                  {sifenLabel(inv.sifenStatus)}
                </Badge>
              </div>

              <div className="mt-2.5 flex items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(inv.issuedAt), "dd/MM/yyyy", { locale: dateLocale })}
                  </p>
                  <p className="text-base font-bold tabular-nums">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: inv.currency || "PYG",
                      minimumFractionDigits: inv.currency === "PYG" ? 0 : 2,
                      maximumFractionDigits: inv.currency === "PYG" ? 0 : 2,
                    }).format(Number(inv.totalAmount))}
                  </p>
                </div>
                <InvoiceActions invoice={inv} tenantId={tenantId} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("type")} className="cursor-pointer hover:bg-muted/50 select-none">
                {t("type")}{renderSortIndicator("type")}
              </TableHead>
              <TableHead onClick={() => handleSort("customer")} className="cursor-pointer hover:bg-muted/50 select-none">
                {t("customer")}{renderSortIndicator("customer")}
              </TableHead>
              <TableHead onClick={() => handleSort("documentNumber")} className="cursor-pointer hover:bg-muted/50 select-none">
                {t("invoice")}{renderSortIndicator("documentNumber")}
              </TableHead>
              <TableHead onClick={() => handleSort("issuedAt")} className="cursor-pointer hover:bg-muted/50 select-none">
                {t("date")}{renderSortIndicator("issuedAt")}
              </TableHead>
              <TableHead onClick={() => handleSort("status")} className="cursor-pointer hover:bg-muted/50 select-none">
                {t("status")}{renderSortIndicator("status")}
              </TableHead>
              <TableHead onClick={() => handleSort("sifenStatus")} className="cursor-pointer hover:bg-muted/50 select-none">
                {t("sifenColumn")}{renderSortIndicator("sifenStatus")}
              </TableHead>
              <TableHead onClick={() => handleSort("totalAmount")} className="text-right cursor-pointer hover:bg-muted/50 select-none">
                {t("total")}{renderSortIndicator("totalAmount")}
              </TableHead>
              <TableHead className="text-right">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              sortedInvoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Badge variant={inv.type === "PURCHASE" ? "default" : "secondary"}>
                      {inv.type === "PURCHASE" ? t("purchase") : t("sale")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {inv.customer?.name || inv.supplier?.name || "N/A"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span>{inv.documentNumber || "-"}</span>
                      {inv.attachmentUrl && (
                        <a
                          href={inv.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t("viewOriginal")}
                          className="inline-flex text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(inv.issuedAt), "dd/MM/yyyy", {
                      locale: dateLocale,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        inv.status === "APPROVED"
                          ? "default"
                          : inv.status === "CANCELLED"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {inv.status === "APPROVED"
                        ? t("approved")
                        : inv.status === "CANCELLED"
                        ? t("cancelled")
                        : t("pending")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        inv.sifenStatus === "APPROVED"
                          ? "default"
                          : inv.sifenStatus === "REJECTED"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {sifenLabel(inv.sifenStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: inv.currency || "PYG",
                      minimumFractionDigits: inv.currency === "PYG" ? 0 : 2,
                      maximumFractionDigits: inv.currency === "PYG" ? 0 : 2,
                    }).format(Number(inv.totalAmount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <InvoiceActions invoice={inv} tenantId={tenantId} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
