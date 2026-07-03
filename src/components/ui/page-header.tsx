import * as React from "react";

/**
 * Cabeçalho padrão de página — o mesmo em todos os módulos do ERP.
 * Título + subtítulo à esquerda, ações (botões) à direita; empilha no mobile.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>
      )}
    </div>
  );
}
