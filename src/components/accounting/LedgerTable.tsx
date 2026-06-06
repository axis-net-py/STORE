"use client";

import React, { useState, useMemo } from 'react';
import { getJournalEntries, getLedgerEntries, getLedgerEntriesWithShadow, getTrialBalance, postInvoiceToLedger, voidJournalEntry } from '@/app/actions/accounting';
import { getAccounts } from '@/app/actions/accounting';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Loader2, FileText, Scale, Ban, Eye, CalendarIcon, Download, Filter, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, es } from 'date-fns/locale';
import { Decimal } from '@prisma/client/runtime/library';
import { pdf } from '@react-pdf/renderer';
import LedgerPDF from '@/components/accounting/LedgerPDF';

// ─── Types ──────────────────────────────────────────────────────

interface JournalEntry {
  id: string;
  tenantId: string;
  number: string;
  date: Date;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  postedAt: Date | null;
  createdBy: string;
  lines: JournalLine[];
}

interface JournalLine {
  id: string;
  tenantId: string;
  journalEntryId: string;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: Decimal;
  currency: string;
  exchangeRate: Decimal;
  amountUSD: Decimal;
  account: {
    id: string;
    code: string;
    namePt: string;
    nameEs: string;
    type: string;
  };
}

// ─── Main Component ─────────────────────────────────────────────

export default function LedgerTable({ tenantId }: { tenantId: string }) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showShadow, setShowShadow] = useState(false);

  const [sortField, setSortField] = useState<"number" | "date" | "description" | "referenceType" | "status" | "debit" | "credit" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const locale = language === 'pt' ? ptBR : es;

  // Local translations mapping
  const labels = {
    pt: {
      status: "Status",
      allStatus: "Todos os Status",
      posted: "Lançado",
      draft: "Rascunho",
      voided: "Cancelado",
      startDate: "Data Inicial",
      endDate: "Data Final",
      pickDate: "Escolher data",
      shadowUsd: "Equivalente USD",
      journalEntries: "Lançamentos Contábeis",
      number: "Número",
      date: "Data",
      description: "Descrição",
      reference: "Referência",
      debitPyg: "Débito (PYG)",
      creditPyg: "Crédito (PYG)",
      debitUsd: "Débito (USD)",
      creditUsd: "Crédito (USD)",
      actions: "Ações",
      loading: "Carregando...",
      noEntries: "Nenhum lançamento encontrado",
      entryDetails: "Detalhes do Lançamento",
      accountCode: "Código da Conta",
      accountName: "Nome da Conta",
      type: "Tipo",
      amountPyg: "Valor (PYG)",
      amountUsd: "Valor (USD)",
      toastLoadFailed: "Falha ao carregar lançamentos contábeis",
      toastPostSuccess: "Fatura lançada na contabilidade com sucesso",
      toastPostFailed: "Falha ao lançar fatura",
      toastVoidSuccess: "Lançamento cancelado com sucesso",
      toastVoidFailed: "Falha ao cancelar lançamento",
      pdfDownloadSuccess: "PDF baixado com sucesso",
      pdfDownloadFailed: "Falha ao gerar PDF",
      debit: "DÉBITO",
      credit: "CRÉDITO",
      filterBtn: "Filtrar"
    },
    es: {
      status: "Estado",
      allStatus: "Todos los Estados",
      posted: "Asentado",
      draft: "Borrador",
      voided: "Anulado",
      startDate: "Fecha Inicial",
      endDate: "Fecha Final",
      pickDate: "Seleccionar fecha",
      shadowUsd: "Equivalente USD",
      journalEntries: "Asientos Contables",
      number: "Número",
      date: "Fecha",
      description: "Descripción",
      reference: "Referencia",
      debitPyg: "Débito (PYG)",
      creditPyg: "Crédito (PYG)",
      debitUsd: "Débito (USD)",
      creditUsd: "Crédito (USD)",
      actions: "Acciones",
      loading: "Cargando...",
      noEntries: "No se encontraron asientos",
      entryDetails: "Detalles del Asiento",
      accountCode: "Código de Cuenta",
      accountName: "Nombre de Cuenta",
      type: "Tipo",
      amountPyg: "Monto (PYG)",
      amountUsd: "Monto (USD)",
      toastLoadFailed: "Error al cargar asientos contables",
      toastPostSuccess: "Factura asentada en contabilidad con éxito",
      toastPostFailed: "Error al asentar factura",
      toastVoidSuccess: "Asiento anulado con éxito",
      toastVoidFailed: "Error al anular asiento",
      pdfDownloadSuccess: "PDF descargado con éxito",
      pdfDownloadFailed: "Error al generar PDF",
      debit: "DÉBITO",
      credit: "CRÉDITO",
      filterBtn: "Filtrar"
    }
  };

  const getLabel = (key: keyof typeof labels.pt) => {
    return labels[language as "pt" | "es"]?.[key] || labels.pt[key];
  };

  const getReferenceTypeLabel = (type: string | null) => {
    if (!type) return "-";
    const map: Record<string, Record<string, string>> = {
      invoice: {
        pt: "Fatura",
        es: "Factura"
      }
    };
    const lang = (language === "es" ? "es" : "pt") as "pt" | "es";
    return map[type.toLowerCase()]?.[lang] || type;
  };

  // Load journal entries
  const loadEntries = async () => {
    setLoading(true);
    try {
      const filters = {
        ...(statusFilter !== 'all' && { status: statusFilter as any }),
        ...(startDate && endDate && { startDate, endDate }),
      };

      const data = showShadow
        ? await getLedgerEntriesWithShadow(filters)
        : await getJournalEntries(filters);

      setEntries(data as any);
      setFilteredEntries(data as any);
    } catch (error) {
      toast.error(getLabel('toastLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Generate and download PDF
  const handlePDFExport = async () => {
    try {
      setLoading(true);
      const filters = {
        ...(statusFilter !== 'all' && { status: statusFilter as any }),
        ...(startDate && endDate && { startDate, endDate }),
      };

      const data = await getJournalEntries(filters) as any[];
      const period = startDate && endDate
        ? `${format(startDate, 'dd/MM/yyyy')} ${language === 'pt' ? 'até' : 'hasta'} ${format(endDate, 'dd/MM/yyyy')}`
        : (language === 'pt' ? 'Todos os Períodos' : 'Todos los Periodos');

      const blob = await pdf(
        <LedgerPDF
          entries={data}
          period={period}
          language={language}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledger-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(getLabel('pdfDownloadSuccess'));
    } catch (error: any) {
      toast.error(getLabel('pdfDownloadFailed') + ': ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: "number" | "date" | "description" | "referenceType" | "status" | "debit" | "credit") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const renderSortIndicator = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▴" : " ▾";
  };

  // Apply filters and sorting
  useMemo(() => {
    let filtered = [...entries];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    if (startDate && endDate) {
      filtered = filtered.filter(e => {
        const d = new Date(e.date);
        return d >= startDate && d <= endDate;
      });
    }

    if (sortField) {
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (sortField === "debit") {
          aVal = a.lines.filter(l => l.type === 'DEBIT').reduce((acc, l) => acc + Number(l.amount), 0);
          bVal = b.lines.filter(l => l.type === 'DEBIT').reduce((acc, l) => acc + Number(l.amount), 0);
        } else if (sortField === "credit") {
          aVal = a.lines.filter(l => l.type === 'CREDIT').reduce((acc, l) => acc + Number(l.amount), 0);
          bVal = b.lines.filter(l => l.type === 'CREDIT').reduce((acc, l) => acc + Number(l.amount), 0);
        } else if (sortField === "date") {
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
        } else {
          aVal = String(a[sortField] || "").toLowerCase();
          bVal = String(b[sortField] || "").toLowerCase();
        }

        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredEntries(filtered);
  }, [entries, statusFilter, startDate, endDate, sortField, sortOrder]);

  React.useEffect(() => {
    loadEntries();
  }, []);

  // Handle post invoice to ledger
  const handlePostInvoice = async (invoiceId: string) => {
    try {
      const result = await postInvoiceToLedger(invoiceId);
      if (result.success) {
        toast.success(getLabel('toastPostSuccess'));
        loadEntries();
      } else {
        toast.error((result as any).error || getLabel('toastPostFailed'));
      }
    } catch (error: any) {
      toast.error(error.message || getLabel('toastPostFailed'));
    }
  };

  // Handle void entry
  const handleVoidEntry = async (entryId: string) => {
    try {
      const result = await voidJournalEntry(entryId, 'Correction');
      if (result.success) {
        toast.success(getLabel('toastVoidSuccess'));
        loadEntries();
      } else {
        toast.error((result as any).error || getLabel('toastVoidFailed'));
      }
    } catch (error: any) {
      toast.error(error.message || getLabel('toastVoidFailed'));
    }
  };

  // Status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'POSTED':
        return (
          <span 
            className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: 'var(--badge-posted-bg)', color: 'var(--badge-posted-text)' }}
          >
            {getLabel('posted')}
          </span>
        );
      case 'DRAFT':
        return (
          <span 
            className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-bold !bg-yellow-100 !text-yellow-800 dark:!bg-yellow-900/30 dark:!text-yellow-400"
            style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
          >
            {getLabel('draft')}
          </span>
        );
      case 'VOIDED':
        return (
          <span 
            className="inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-bold !bg-red-100 !text-red-800 dark:!bg-red-900/30 dark:!text-red-400"
            style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
          >
            {getLabel('voided')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  // Format currency for PYG (no decimals)
  const formatPYG = (amount: Decimal | number) => {
    const num = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  // Format currency for USD
  const formatUSD = (amount: Decimal | number) => {
    const num = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{getLabel('status')}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-lg border-border bg-card h-9 text-[13px] font-medium shadow-sm">
                <SelectValue placeholder={getLabel('allStatus')} />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card">
                <SelectItem value="all" className="text-[13px]">{getLabel('allStatus')}</SelectItem>
                <SelectItem value="DRAFT" className="text-[13px]">{getLabel('draft')}</SelectItem>
                <SelectItem value="POSTED" className="text-[13px]">{getLabel('posted')}</SelectItem>
                <SelectItem value="VOIDED" className="text-[13px]">{getLabel('voided')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{getLabel('startDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] rounded-lg border-border bg-card h-9 text-[13px] justify-start text-left font-medium">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP', { locale }) : getLabel('pickDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-lg border-border bg-card" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{getLabel('endDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] rounded-lg border-border bg-card h-9 text-[13px] justify-start text-left font-medium">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP', { locale }) : getLabel('pickDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-lg border-border bg-card" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={loadEntries} disabled={loading} className="rounded-lg bg-primary text-primary-foreground h-9 px-4 text-xs font-bold shadow-sm flex items-center gap-2 active:scale-98 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            {getLabel('filterBtn')}
          </Button>

          <Button
            variant={showShadow ? "default" : "outline"}
            className="rounded-lg border-border h-9 px-4 text-xs font-bold shadow-sm flex items-center gap-2 active:scale-98 transition-all"
            onClick={() => { setShowShadow(!showShadow); setTimeout(() => loadEntries(), 0); }}
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {getLabel('shadowUsd')}
          </Button>

          <Button variant="outline" className="rounded-lg border-border h-9 px-4 text-xs font-bold shadow-sm flex items-center gap-2 active:scale-98 transition-all ml-auto" onClick={handlePDFExport} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            PDF
          </Button>
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-[14px] font-bold text-foreground/80 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            {getLabel('journalEntries')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead onClick={() => handleSort("number")} className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold cursor-pointer hover:bg-muted/50 select-none">
                  {getLabel('number')}{renderSortIndicator("number")}
                </TableHead>
                <TableHead onClick={() => handleSort("date")} className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold cursor-pointer hover:bg-muted/50 select-none">
                  {getLabel('date')}{renderSortIndicator("date")}
                </TableHead>
                <TableHead onClick={() => handleSort("description")} className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold cursor-pointer hover:bg-muted/50 select-none">
                  {getLabel('description')}{renderSortIndicator("description")}
                </TableHead>
                <TableHead onClick={() => handleSort("referenceType")} className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold cursor-pointer hover:bg-muted/50 select-none">
                  {getLabel('reference')}{renderSortIndicator("referenceType")}
                </TableHead>
                <TableHead onClick={() => handleSort("status")} className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold cursor-pointer hover:bg-muted/50 select-none">
                  {getLabel('status')}{renderSortIndicator("status")}
                </TableHead>
                <TableHead onClick={() => handleSort("debit")} className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right cursor-pointer hover:bg-muted/50 select-none">
                  {getLabel('debitPyg')}{renderSortIndicator("debit")}
                </TableHead>
                <TableHead onClick={() => handleSort("credit")} className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right cursor-pointer hover:bg-muted/50 select-none">
                  {getLabel('creditPyg')}{renderSortIndicator("credit")}
                </TableHead>
                {showShadow && (
                  <>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right">{getLabel('debitUsd')}</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right">{getLabel('creditUsd')}</TableHead>
                  </>
                )}
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-center">{getLabel('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={showShadow ? 10 : 8} className="text-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">{getLabel('loading')}</span>
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showShadow ? 10 : 8} className="text-center py-20">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">{getLabel('noEntries')}</span>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const debitTotal = entry.lines
                    .filter(l => l.type === 'DEBIT')
                    .reduce((acc, l) => acc + Number(l.amount), 0);
                  const creditTotal = entry.lines
                    .filter(l => l.type === 'CREDIT')
                    .reduce((acc, l) => acc + Number(l.amount), 0);

                  const debitTotalUSD = showShadow ? entry.lines
                    .filter(l => l.type === 'DEBIT')
                    .reduce((acc, l) => acc + Number(l.amountUSD || 0), 0) : 0;
                  const creditTotalUSD = showShadow ? entry.lines
                    .filter(l => l.type === 'CREDIT')
                    .reduce((acc, l) => acc + Number(l.amountUSD || 0), 0) : 0;

                  return (
                    <TableRow key={entry.id} className="transition-colors">
                      <TableCell className="font-mono text-[12px] font-bold text-foreground/70">{entry.number}</TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {format(new Date(entry.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-[12px] text-foreground/70 max-w-[300px] truncate">{entry.description}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono">{getReferenceTypeLabel(entry.referenceType)}</TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-[12px] text-primary dark:text-[#4ade80]">
                        {formatPYG(debitTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-[12px] text-red-600 dark:text-red-400">
                        {formatPYG(creditTotal)}
                      </TableCell>
                      {showShadow && (
                        <>
                          <TableCell className="text-right font-mono font-medium text-[12px] text-primary/70 dark:text-[#4ade80]/70">
                            {formatUSD(debitTotalUSD)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-[12px] text-red-600/70">
                            {formatUSD(creditTotalUSD)}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg h-7 w-7 p-0"
                            onClick={() => { setSelectedEntry(entry); setShowEntryDialog(true); }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {entry.status === 'POSTED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-lg h-7 w-7 p-0 text-red-500 hover:text-red-700"
                              onClick={() => handleVoidEntry(entry.id)}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
        <DialogContent className="sm:max-w-[75vw] w-[95vw] max-h-[92vh] overflow-hidden glass-pop-up p-0 rounded-2xl border border-border shadow-2xl flex flex-col">
          <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-gradient-to-r from-muted/50 to-muted/10">
            <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {selectedEntry?.number} — {getLabel('entryDetails')}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="p-6 space-y-6 overflow-y-auto max-h-[64vh]">
              <div className="grid grid-cols-2 gap-4 text-[13px] bg-muted/20 p-5 rounded-2xl border border-border/50">
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">{getLabel('date')}</span>
                  <p className="font-mono font-bold text-foreground/75 mt-1">
                    {format(new Date(selectedEntry.date), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">{getLabel('status')}</span>
                  <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">{getLabel('description')}</span>
                  <p className="font-medium text-foreground/75 mt-1">{selectedEntry.description}</p>
                </div>
              </div>

              {/* Journal Lines */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{getLabel('accountCode')}</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{getLabel('accountName')}</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{getLabel('type')}</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right">{getLabel('amountPyg')}</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right">{getLabel('amountUsd')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEntry.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono text-[12px] font-bold text-foreground/70">{line.account.code}</TableCell>
                        <TableCell className="text-[12px] text-foreground/70">
                          {language === 'pt' ? line.account.namePt : line.account.nameEs}
                        </TableCell>
                        <TableCell>
                          <span 
                            className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                              line.type === 'DEBIT'
                                ? ''
                                : '!bg-red-100 !text-red-800 dark:!bg-red-900/30 dark:!text-red-400'
                            }`}
                            style={{
                              backgroundColor: line.type === 'DEBIT' ? 'var(--badge-posted-bg)' : '#fee2e2',
                              color: line.type === 'DEBIT' ? 'var(--badge-posted-text)' : '#991b1b'
                            }}
                          >
                            {line.type === 'DEBIT' ? getLabel('debit') : getLabel('credit')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[12px] font-bold text-foreground/70">
                          {formatPYG(line.amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[12px] text-muted-foreground">
                          {line.amountUSD ? formatUSD(line.amountUSD) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
