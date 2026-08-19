import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, MapPinned, PlusCircle, Search, Layers, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/enderecos", label: "Endereços", icon: Layers },
  { to: "/novo", label: "Novo", icon: PlusCircle },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/mapa", label: "Mapa", icon: MapPinned },
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
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          <button
            aria-label="Sair"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-6", active && "stroke-[2.4]")} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
