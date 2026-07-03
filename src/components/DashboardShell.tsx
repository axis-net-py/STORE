"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { LayoutDashboard, FileText, Package, Wallet, Menu } from "lucide-react";

interface DashboardShellProps {
  tenantId: string;
  children: React.ReactNode;
}

export function DashboardShell({ tenantId, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const { language } = useLanguage();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const mobileLabels: Record<string, Record<string, string>> = {
    pt: {
      dashboard: "Início",
      invoices: "Faturas",
      products: "Produtos",
      finance: "Financeiro",
      menu: "Mais"
    },
    es: {
      dashboard: "Inicio",
      invoices: "Facturas",
      products: "Productos",
      finance: "Finanzas",
      menu: "Más"
    }
  };

  const getMobileLabel = (key: string) => {
    return mobileLabels[language]?.[key] || key;
  };

  const isTabActive = (href: string) => {
    if (href === "dashboard") {
      return pathname.endsWith("/dashboard");
    }
    return pathname.includes(`/${href}`);
  };

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-background relative w-full">
      {/* Backdrop for Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 backdrop-blur-sm md:hidden transition-all duration-300 cursor-pointer animate-in fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Drawer Container */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-20",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <Sidebar tenantId={tenantId} collapsed={isMobile ? false : collapsed} />
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-1 flex-col overflow-hidden w-full min-w-0">
        <Header
          tenantId={tenantId}
          onToggleSidebar={() => {
            if (window.innerWidth < 768) {
              setMobileOpen((prev) => !prev);
            } else {
              setCollapsed((c) => !c);
            }
          }}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-24 md:pb-6 w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border flex justify-around items-center h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] md:hidden px-2 shadow-lg">
        <Link
          href={`/${tenantId}/dashboard`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all",
            isTabActive("dashboard")
              ? "text-primary scale-105 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] tracking-wide">{getMobileLabel("dashboard")}</span>
        </Link>

        <Link
          href={`/${tenantId}/invoices`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all",
            isTabActive("invoices")
              ? "text-primary scale-105 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] tracking-wide">{getMobileLabel("invoices")}</span>
        </Link>

        <Link
          href={`/${tenantId}/products`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all",
            isTabActive("products")
              ? "text-primary scale-105 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Package className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] tracking-wide">{getMobileLabel("products")}</span>
        </Link>

        <Link
          href={`/${tenantId}/finance`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all",
            isTabActive("finance")
              ? "text-primary scale-105 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Wallet className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] tracking-wide">{getMobileLabel("finance")}</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all",
            mobileOpen
              ? "text-primary scale-105 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Menu className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] tracking-wide">{getMobileLabel("menu")}</span>
        </button>
      </nav>
    </div>
  );
}

