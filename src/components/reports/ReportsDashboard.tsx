"use client";

import React, { useState, useEffect } from "react";
import { getReportData, ReportItem } from "@/app/actions/reports";
import { useLanguage } from "@/components/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Printer, BarChart3, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function ReportsDashboard() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<
    "sales" | "purchases" | "inventory"
  >("sales");
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [data, setData] = useState<ReportItem[]>([]);

  const labels = {
    pt: {
      title: "Relatórios",
      subtitle: "Análise comercial, compras e controle de estoque",
      type: "Tipo de Relatório",
      sales: "Relatório de Vendas",
      purchases: "Relatório de Compras",
      inventory: "Relatório de Estoque",
      startDate: "Data Inicial",
      endDate: "Data Final",
      filter: "Filtrar",
      print: "Imprimir",
      date: "Data",
      customer: "Cliente",
      supplier: "Fornecedor",
      product: "Produto / Descrição",
      total: "Total",
      quantity: "Quantidade",
      movementType: "Tipo",
      loading: "Carregando...",
      noData: "Nenhum registro encontrado para o período",
      count: "Quantidade Total",
    },
    es: {
      title: "Informes",
      subtitle: "Análisis comercial, compras e inventario",
      type: "Tipo de Informe",
      sales: "Informe de Ventas",
      purchases: "Informe de Compras",
      inventory: "Informe de Inventario",
      startDate: "Fecha Inicial",
      endDate: "Fecha Final",
      filter: "Filtrar",
      print: "Imprimir",
      date: "Fecha",
      customer: "Cliente",
      supplier: "Proveedor",
      product: "Producto / Descripción",
      total: "Total",
      quantity: "Cantidad",
      movementType: "Tipo",
      loading: "Cargando...",
      noData: "No se encontraron registros para el período",
      count: "Cantidad Total",
    },
  };

  const t = (key: keyof typeof labels.pt) => {
    return labels[language as "pt" | "es"]?.[key] || labels.pt[key];
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getReportData(reportType, startDate, endDate);
      setData(res);
    } catch (err) {
      console.error("Error loading report data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const handlePrint = () => {
    window.print();
  };

  // Calculate currency totals (grouped by currency) for sales and purchases
  const currencyTotals = data.reduce((acc, row) => {
    if (reportType !== "sales" && reportType !== "purchases") return acc;
    const curr = row.currency || "PYG";
    acc[curr] = (acc[curr] || 0) + row.total;
    return acc;
  }, {} as Record<string, number>);

  // Calculate totals for inventory movements
  const totalEntrada = data
    .filter(row => row.currency === "ENTRADA")
    .reduce((sum, row) => sum + row.total, 0);

  const totalSaida = data
    .filter(row => row.currency === "SAÍDA")
    .reduce((sum, row) => sum + row.total, 0);

  const getReportTitle = () => {
    switch (reportType) {
      case "sales": return t("sales");
      case "purchases": return t("purchases");
      case "inventory": return t("inventory");
      default: return "";
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Print-Only Premium Document Header */}
      <div className="print-only mb-8">
        <div className="flex justify-between items-end border-b-2 border-primary pb-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-primary font-bold">AXIS STORE</span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1 uppercase">
              {getReportTitle()}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1">
              Período: {startDate.split("-").reverse().join("/")} a {endDate.split("-").reverse().join("/")}
            </p>
          </div>
          <div className="text-right text-[10px] text-muted-foreground font-mono">
            <div>Gerado em: {new Date().toLocaleDateString(language === 'pt' ? 'pt-BR' : 'es-PY')} {new Date().toLocaleTimeString(language === 'pt' ? 'pt-BR' : 'es-PY', {hour: '2-digit', minute:'2-digit'})}</div>
            <div>Status: Consolidado</div>
          </div>
        </div>
      </div>

      {/* Header aligned with AXIS styling (hidden on print) */}
      <div className="no-print">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("subtitle")}
        </p>
      </div>

      {/* Filters Card */}
      <Card className="rounded-xl border border-border bg-card shadow-sm no-print">
        <CardContent className="p-4 flex flex-wrap gap-3 sm:gap-4 items-end">
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {t("type")}
            </span>
            <Select
              value={reportType}
              onValueChange={(val: any) => setReportType(val)}
            >
              <SelectTrigger className="w-full sm:w-[220px] rounded-lg border-border bg-card h-10 sm:h-9 text-[13px] font-medium shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card">
                <SelectItem value="sales" className="text-[13px]">{t("sales")}</SelectItem>
                <SelectItem value="purchases" className="text-[13px]">{t("purchases")}</SelectItem>
                <SelectItem value="inventory" className="text-[13px]">{t("inventory")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[45%] sm:min-w-0 sm:flex-none">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {t("startDate")}
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-10 sm:h-9 px-3 rounded-lg border border-border bg-card text-[13px] font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[45%] sm:min-w-0 sm:flex-none">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {t("endDate")}
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 sm:h-9 px-3 rounded-lg border border-border bg-card text-[13px] font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            onClick={fetchReport}
            disabled={loading}
            className="rounded-lg bg-primary text-primary-foreground h-9 px-4 text-xs font-bold shadow-sm flex items-center gap-2 active:scale-98 transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Filter className="w-4 h-4" />
            )}
            {t("filter")}
          </Button>

          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={loading}
            className="rounded-lg border-border h-9 px-4 text-xs font-bold shadow-sm flex items-center gap-2 active:scale-98 transition-all ml-auto"
          >
            <Printer className="w-4 h-4 mr-2" />
            {t("print")}
          </Button>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-4 no-print">
          <CardTitle className="text-[14px] font-bold text-foreground/80 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {getReportTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold w-[120px]">
                  {t("date")}
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  {reportType === "sales"
                    ? t("customer")
                    : reportType === "purchases"
                    ? t("supplier")
                    : t("product")}
                </TableHead>
                {reportType === "inventory" && (
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold w-[150px]">
                    {t("movementType")}
                  </TableHead>
                )}
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right w-[180px]">
                  {reportType === "inventory" ? t("quantity") : t("total")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={reportType === "inventory" ? 4 : 3}
                    className="text-center py-20"
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
                      {t("loading")}
                    </span>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={reportType === "inventory" ? 4 : 3}
                    className="text-center py-20"
                  >
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
                      {t("noData")}
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={row.id} className="transition-colors">
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {row.date.split("-").reverse().join("/")}
                    </TableCell>
                    <TableCell className="text-[12px] text-foreground/75 font-medium">
                      {row.details}
                    </TableCell>
                    {reportType === "inventory" && (
                      <TableCell className="text-[12px]">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize"
                          style={{
                            backgroundColor:
                              row.currency === "ENTRADA"
                                ? "var(--badge-posted-bg)"
                                : "#fee2e2",
                            color:
                              row.currency === "ENTRADA"
                                ? "var(--badge-posted-text)"
                                : "#991b1b",
                          }}
                        >
                          {row.currency}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right font-mono font-bold text-[12px] text-foreground/80">
                      {reportType === "inventory"
                        ? row.total.toFixed(2)
                        : formatCurrency(row.total, row.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dynamic Summary Totals Card */}
      {data.length > 0 && (
        <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-5 flex flex-wrap justify-end gap-8 bg-gradient-to-r from-muted/20 to-muted/5 print:bg-transparent print:border-t print:border-border">
            {reportType === "sales" || reportType === "purchases" ? (
              Object.entries(currencyTotals).map(([curr, total]) => (
                <div key={curr} className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                    Total {curr}
                  </span>
                  <span className="text-lg font-bold text-primary print:text-black mt-1 block">
                    {formatCurrency(total, curr)}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                    Total Entradas
                  </span>
                  <span className="text-lg font-bold text-primary print:text-black mt-1 block">
                    {totalEntrada.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                    Total Saídas
                  </span>
                  <span className="text-lg font-bold text-destructive print:text-black mt-1 block">
                    {totalSaida.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
