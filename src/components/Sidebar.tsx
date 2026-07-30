import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "next-intl";
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
  Wallet,
  ClipboardList,
  Boxes,
  ShoppingCart,
  ShieldCheck,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrazilFlag, ParaguayFlag } from "@/components/icons/Flags";
import { navFor } from "@/modules/registry";

interface SidebarProps {
  tenantId: string;
  /** Módulos ativos do cliente. A navegação é núcleo + módulos, ordenada. */
  modules: string[];
  collapsed?: boolean;
}

// A navegação principal já não é uma lista fixa: vem de navFor(modules), que
// compõe o núcleo com os módulos contratados pelo cliente (Projeto 1, Fase 1).
const bottomItems = [
  { icon: RefreshCw,   key: "cambio",   href: "settings/exchange-rates" },
  { icon: ShieldCheck, key: "fiscal",   href: "settings/fiscal" },
  { icon: Settings,    key: "settings", href: "settings/team" },
];

export function Sidebar({ tenantId, modules, collapsed = false }: SidebarProps) {
  const navItems = navFor(modules);
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const t = useTranslations("nav");
  const tH = useTranslations("header");
  const { theme, setTheme } = useTheme();

  const isActive = (href: string) =>
    pathname === `/${tenantId}/${href}` ||
    (href !== "dashboard" && pathname.startsWith(`/${tenantId}/${href}`));

  const NavLink = ({ icon: Icon, labelKey, href }: { icon: any; labelKey: string; href: string }) => {
    const active = isActive(href);
    const label = t(labelKey);
    const link = (
      <Link
        href={`/${tenantId}/${href}`}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 group",
          active
            ? "bg-[#2e3f53] text-white border-r-2 border-[#0a6ed1]"
            : "text-[#94a3b8] hover:bg-[#253548] hover:text-white"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-white" : "text-[#94a3b8] group-hover:text-white")} />
        {!collapsed && <span className="truncate">{label}</span>}
        {!collapsed && active && <ChevronRight className="ml-auto h-3 w-3 opacity-80" />}
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
        "flex flex-col border-r border-[#2e3f53] bg-[#1d2d3e] transition-all duration-200 h-full text-slate-300",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-14 items-center border-b border-[#2e3f53] px-3", collapsed ? "justify-center" : "gap-2")}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#0a6ed1] text-white text-xs font-bold shadow-sm">
          A
        </div>
        {!collapsed && (
          <span className="font-serif text-sm font-semibold tracking-tight text-white">AXIS Store</span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink key={item.href} icon={item.icon} labelKey={item.key} href={item.href} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-[#2e3f53] px-2 py-3 space-y-2">
        <div className="space-y-0.5">
          {bottomItems.map((item) => (
            <NavLink key={item.href} icon={item.icon} labelKey={item.key} href={item.href} />
          ))}
        </div>
        
        {!collapsed && (
          <div className="pt-2 flex items-center justify-between gap-1.5 border-t border-[#2e3f53]/60">
            {/* Language Toggle Button */}
            <button
              type="button"
              onClick={() => setLanguage(language === "pt" ? "es" : "pt")}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg border border-[#2e3f53] bg-[#152332] hover:bg-[#253548] hover:border-[#384b60] text-[11px] font-bold text-slate-400 hover:text-white transition-all shadow-inner cursor-pointer"
              title={tH("switchLanguage")}
            >
              {language === "pt" ? (
                <BrazilFlag className="w-4 h-3 rounded-sm object-cover shrink-0" />
              ) : (
                <ParaguayFlag className="w-4 h-3 rounded-sm object-cover shrink-0" />
              )}
              <span>{language === "pt" ? "PT" : "ES"}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg border border-[#2e3f53] bg-[#152332] hover:bg-[#253548] hover:border-[#384b60] text-[11px] font-bold text-slate-400 hover:text-white transition-all shadow-inner cursor-pointer"
              title={tH("toggleTheme")}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-yellow-500" />
                  <span>{tH("themeLight")}</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-slate-400" />
                  <span>{tH("themeDark")}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
