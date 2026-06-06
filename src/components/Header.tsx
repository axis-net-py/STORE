import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, User, Menu, Sun, Moon, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/language-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  tenantId: string;
  onToggleSidebar?: () => void;
}

export function Header({ tenantId, onToggleSidebar }: HeaderProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Left */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleSidebar}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest hidden sm:block">
          {(session?.user as any)?.tenantName || tenantId}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-sans text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
          onClick={() => setLanguage(language === "pt" ? "es" : "pt")}
          title={language === "pt" ? "Cambiar a Español" : "Mudar para Português"}
        >
          <span className="text-sm leading-none">{language === "pt" ? "🇧🇷" : "🇵🇾"}</span>
          <span>{language.toUpperCase()}</span>
        </Button>

        {/* Theme Switcher */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={language === "pt" ? "Alternar tema" : "Alternar tema"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-yellow-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700" />
          )}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{session?.user?.name ?? "Usuário"}</p>
                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {language === "pt" ? "Sair" : "Salir"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
