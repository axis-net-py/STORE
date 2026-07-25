"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CertificationSheet } from "@/modules/farm/components/CertificationSheet";
import { AlertTriangle } from "lucide-react";
import type { Certification } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    name: "Nome",
    issuingBody: "Órgão Emissor",
    number: "Número",
    expiryDate: "Validade",
    status: "Status",
    actions: "Ações",
    empty: "Nenhuma certificação cadastrada.",
    statusActive: "Ativa",
    statusExpiring: "Vencendo",
    statusExpiringSoon: "Vence em breve",
    statusExpired: "Vencida",
    statusPending: "Pendente",
    locale: "pt-BR",
  },
  es: {
    name: "Nombre",
    issuingBody: "Organismo Emisor",
    number: "Número",
    expiryDate: "Vencimiento",
    status: "Estado",
    actions: "Acciones",
    empty: "No hay certificaciones registradas.",
    statusActive: "Activa",
    statusExpiring: "Venciendo",
    statusExpiringSoon: "Vence pronto",
    statusExpired: "Vencida",
    statusPending: "Pendiente",
    locale: "es-PY",
  },
} as const;

function formatDate(date: Date | string | null, locale: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString(locale, { timeZone: "UTC" });
}

function daysUntil(date: Date | string) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function CertificationList({ certifications }: { certifications: Certification[] }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{s.name}</TableHead>
            <TableHead>{s.issuingBody}</TableHead>
            <TableHead>{s.number}</TableHead>
            <TableHead>{s.expiryDate}</TableHead>
            <TableHead>{s.status}</TableHead>
            <TableHead className="text-right">{s.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certifications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {s.empty}
              </TableCell>
            </TableRow>
          ) : (
            certifications.map((cert) => {
              const expiringSoon = cert.expiryDate && cert.status === "ACTIVE" && daysUntil(cert.expiryDate) <= 30 && daysUntil(cert.expiryDate) >= 0;
              const expired = cert.expiryDate && daysUntil(cert.expiryDate) < 0 && cert.status !== "EXPIRED";
              return (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">{cert.name}</TableCell>
                  <TableCell>{cert.issuingBody || "-"}</TableCell>
                  <TableCell>{cert.certificateNumber || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {formatDate(cert.expiryDate, s.locale)}
                      {(expiringSoon || expired) && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    {cert.status === "ACTIVE" ? (
                      expiringSoon || expired ? (
                        <Badge className="bg-amber-600 hover:bg-amber-600/90 text-white border-none">
                          {expired ? s.statusExpiring : s.statusExpiringSoon}
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{s.statusActive}</Badge>
                      )
                    ) : cert.status === "EXPIRED" ? (
                      <Badge variant="destructive">{s.statusExpired}</Badge>
                    ) : (
                      <Badge variant="secondary">{s.statusPending}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <CertificationSheet certification={cert} />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
