import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Truck,
  BookOpen,
  BarChart3,
  Settings,
  RefreshCw,
  ChevronRight,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  tenantId: string;
  collapsed?: boolean;
}

const navItems = [
  { icon: LayoutDashboard, key: "dashboard",  defaultLabel: "Dashboard",   href: "dashboard" },
  { icon: FileText,        key: "invoices",   defaultLabel: "Faturas",      href: "invoices" },
  { icon: Package,         key: "products",   defaultLabel: "Produtos",     href: "products" },
  { icon: Users,           key: "customers",  defaultLabel: "Clientes",     href: "customers" },
  { icon: Truck,           key: "suppliers",  defaultLabel: "Fornecedores", href: "suppliers" },
  { icon: BookOpen,        key: "accounting", defaultLabel: "Contabilidade",href: "accounting" },
  { icon: BarChart3,       key: "reports",    defaultLabel: "Relatórios",   href: "reports" },
];

const bottomItems = [
  { icon: RefreshCw, key: "cambio",   defaultLabel: "Câmbio",        href: "settings/exchange-rates" },
  { icon: Settings,  key: "settings", defaultLabel: "Configurações", href: "settings/team" },
];

export function Sidebar({ tenantId, collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const labelsMap: Record<string, Record<string, string>> = {
    pt: {
      dashboard: "Dashboard",
      invoices: "Faturas",
      products: "Produtos",
      customers: "Clientes",
      suppliers: "Fornecedores",
      accounting: "Contabilidade",
      reports: "Relatórios",
      cambio: "Câmbio",
      settings: "Configurações",
    },
    es: {
      dashboard: "Tablero",
      invoices: "Facturas",
      products: "Productos",
      customers: "Clientes",
      suppliers: "Proveedores",
      accounting: "Contabilidad",
      reports: "Reportes",
      cambio: "Cambio",
      settings: "Configuraciones",
    },
  };

  const getLabel = (key: string, defaultLabel: string) => {
    return labelsMap[language]?.[key] || defaultLabel;
  };

  const isActive = (href: string) =>
    pathname === `/${tenantId}/${href}` ||
    (href !== "dashboard" && pathname.startsWith(`/${tenantId}/${href}`));

  const NavLink = ({ icon: Icon, labelKey, defaultLabel, href }: { icon: any; labelKey: string; defaultLabel: string; href: string }) => {
    const active = isActive(href);
    const label = getLabel(labelKey, defaultLabel);
    const link = (
      <Link
        href={`/${tenantId}/${href}`}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-accent/50 hover:text-accent-foreground",
          active
            ? "bg-primary/10 text-primary border-r-2 border-primary"
            : "text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
        {!collapsed && active && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200 h-full",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-14 items-center border-b border-border px-3", collapsed ? "justify-center" : "gap-2")}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
          C
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-foreground">COOPER</span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink key={item.href} icon={item.icon} labelKey={item.key} defaultLabel={item.defaultLabel} href={item.href} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-border px-2 py-3 space-y-2">
        <div className="space-y-0.5">
          {bottomItems.map((item) => (
            <NavLink key={item.href} icon={item.icon} labelKey={item.key} defaultLabel={item.defaultLabel} href={item.href} />
          ))}
        </div>
        
        {!collapsed && (
          <div className="pt-2 flex items-center justify-between gap-1.5 border-t border-border/50">
            {/* Language Toggle Button */}
            <button
              type="button"
              onClick={() => setLanguage(language === "pt" ? "es" : "pt")}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg border border-border bg-background hover:bg-accent text-[11px] font-bold text-muted-foreground hover:text-foreground transition-all"
              title={language === "pt" ? "Cambiar a Español" : "Mudar para Português"}
            >
              <span className="text-sm leading-none">{language === "pt" ? "🇧🇷" : "🇵🇾"}</span>
              <span>{language === "pt" ? "PT" : "ES"}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg border border-border bg-background hover:bg-accent text-[11px] font-bold text-muted-foreground hover:text-foreground transition-all"
              title="Alternar Tema"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-yellow-500" />
                  <span>CLARO</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-slate-700" />
                  <span>ESCURO</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
