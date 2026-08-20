import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, MapPinned, Table, LogOut, Vote, UserCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Início", icon: Home, desc: "Painel e totais" },
  { to: "/planilha", label: "Pesquisa", icon: Table, desc: "Digitação e fichas" },
  { to: "/mapa", label: "Mapa", icon: MapPinned, desc: "Camocim georreferenciado" },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      {/* ========================================================= */}
      {/* BARRA LATERAL (SIDEBAR) - DESKTOP & TABLET                */}
      {/* ========================================================= */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card/60 sticky top-0 h-screen shrink-0 justify-between">
        <div className="flex flex-col">
          {/* Logo / Marca */}
          <div className="p-4 border-b border-border flex items-center gap-2.5">
            <div className="size-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">
              <Vote className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-black tracking-wider uppercase leading-none">
                PESQUISA 2026
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Camocim — CE
              </p>
            </div>
          </div>

          {/* Links de Navegação Lateral */}
          <nav className="p-2.5 space-y-1">
            {NAV.map(({ to, label, icon: Icon, desc }) => {
              const active = to === "/" ? pathname === "/" : pathname.startsWith(to);

              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-xs font-bold transition-all border",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "stroke-[2.5]" : "stroke-[1.8]")} />
                  <div className="flex flex-col">
                    <span className="leading-none">{label}</span>
                    <span
                      className={cn(
                        "text-[9px] font-normal mt-0.5 leading-tight",
                        active ? "text-primary-foreground/80" : "text-muted-foreground/70"
                      )}
                    >
                      {desc}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Sidebar com Usuário & Logout */}
        <div className="p-3 border-t border-border bg-muted/10 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <UserCheck className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {session.user?.email || "Operador"}
            </span>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 border border-destructive/30 transition-colors"
          >
            <LogOut className="size-3.5" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* CONTEÚDO PRINCIPAL (EXPANDIDO)                             */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Cabeçalho do Conteúdo */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-black tracking-tight uppercase">{title}</h1>
          </div>

          {/* Logout para Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button
              aria-label="Sair"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="p-1.5 text-muted-foreground hover:bg-muted border border-border"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Conteúdo com máxima largura e liberdade de espaço */}
        <main className="flex-1 p-3 md:p-6 w-full max-w-full overflow-x-auto">{children}</main>

        {/* Barra de Navegação Inferior para Mobile */}
        <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
          <div className="grid grid-cols-3">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors",
                    active ? "text-primary bg-primary/5" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
