import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Barra de filtros padrão do ERP — card com micro-labels em caixa alta
 * acima de cada controle (mesmo padrão da Contabilidade).
 *
 * Uso:
 *   <FilterBar>
 *     <FilterField label="Buscar" grow><Input ... /></FilterField>
 *     <FilterField label="Tipo"><Select ... /></FilterField>
 *   </FilterBar>
 */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm p-3.5 md:p-4",
        "flex flex-wrap gap-3 md:gap-4 items-end",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
  grow = false,
  className,
}: {
  label: string;
  children: React.ReactNode;
  /** Ocupa o espaço restante da linha (ideal para o campo de busca). */
  grow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 w-full",
        grow ? "sm:flex-1 sm:min-w-[220px]" : "sm:w-auto",
        className
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
        {label}
      </span>
      {children}
    </div>
  );
}
