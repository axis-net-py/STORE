"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceActions } from "@/components/InvoiceActions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type InvoiceSortField = "type" | "customer" | "documentNumber" | "issuedAt" | "status" | "sifenStatus" | "totalAmount";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const sifenStatusLabels: Record<string, string> = {
  PENDING: "Pendente Sifen",
  APPROVED: "Aprovado Sifen",
  REJECTED: "Rejeitado Sifen",
  CANCELLED: "Cancelado Sifen",
  RECIBO_COMUN: "Recibo Comum",
};

export function InvoiceList({ invoices, tenantId }: { invoices: any[]; tenantId: string }) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSifenStatus, setSelectedSifenStatus] = useState("all");

  const [sortField, setSortField] = useState<InvoiceSortField | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const SortIcon = ({ field }: { field: InvoiceSortField }) =>
    sortField !== field ? null : sortOrder === "asc"
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-primary" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-primary" />;

  const handleSort = (field: InvoiceSortField) => {
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

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar por cliente ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-[38px] rounded-lg border-border bg-card"
          />
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[140px] h-[38px] rounded-lg bg-card">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="SALES">Venda</SelectItem>
              <SelectItem value="PURCHASE">Compra</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px] h-[38px] rounded-lg bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="APPROVED">Aprovada</SelectItem>
              <SelectItem value="CANCELLED">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedSifenStatus} onValueChange={setSelectedSifenStatus}>
            <SelectTrigger className="w-[160px] h-[38px] rounded-lg bg-card">
              <SelectValue placeholder="Status SET (Sifen)" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos Sifen</SelectItem>
              <SelectItem value="none">Não enviado</SelectItem>
              <SelectItem value="RECIBO_COMUN">Recibo Comum</SelectItem>
              <SelectItem value="PENDING">Pendente Sifen</SelectItem>
              <SelectItem value="APPROVED">Aprovado Sifen</SelectItem>
              <SelectItem value="REJECTED">Rejeitado Sifen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {sortedInvoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search ? "Nenhuma fatura encontrada" : "Nenhuma fatura cadastrada"}
            description={search ? `Nenhum resultado para "${search}".` : "Crie a primeira fatura de venda ou compra."}
          />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("type")} className="cursor-pointer hover:bg-muted/50 select-none">
                Tipo<SortIcon field="type" />
              </TableHead>
              <TableHead onClick={() => handleSort("customer")} className="cursor-pointer hover:bg-muted/50 select-none">
                Cliente<SortIcon field="customer" />
              </TableHead>
              <TableHead onClick={() => handleSort("documentNumber")} className="cursor-pointer hover:bg-muted/50 select-none">
                Fatura<SortIcon field="documentNumber" />
              </TableHead>
              <TableHead onClick={() => handleSort("issuedAt")} className="cursor-pointer hover:bg-muted/50 select-none">
                Data<SortIcon field="issuedAt" />
              </TableHead>
              <TableHead onClick={() => handleSort("status")} className="cursor-pointer hover:bg-muted/50 select-none">
                Status<SortIcon field="status" />
              </TableHead>
              <TableHead onClick={() => handleSort("sifenStatus")} className="cursor-pointer hover:bg-muted/50 select-none">
                Status SET<SortIcon field="sifenStatus" />
              </TableHead>
              <TableHead onClick={() => handleSort("totalAmount")} className="text-right cursor-pointer hover:bg-muted/50 select-none">
                Total<SortIcon field="totalAmount" />
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedInvoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Badge variant={inv.type === "PURCHASE" ? "default" : "secondary"}>
                      {inv.type === "PURCHASE" ? "Compra" : "Venda"}
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
                          title="Visualizar documento original"
                          className="inline-flex text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(inv.issuedAt), "dd/MM/yyyy", {
                      locale: ptBR,
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
                        ? "Aprovada"
                        : inv.status === "CANCELLED"
                        ? "Cancelada"
                        : "Pendente"}
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
                      {sifenStatusLabels[inv.sifenStatus] || inv.sifenStatus || "Não enviado"}
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
              ))}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}
