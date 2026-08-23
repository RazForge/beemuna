"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  BookOpen,
  FileText,
  Activity,
  CalendarDays,
  Timer,
  Brain,
  Bot,
  Clock,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Timeline", href: "/timeline", icon: Clock },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Journal", href: "/journal", icon: BookOpen },
  { label: "Notes", href: "/notes", icon: FileText },
  { label: "Habits", href: "/habits", icon: Activity },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Focus", href: "/focus", icon: Timer },
  { label: "Knowledge", href: "/knowledge", icon: Brain },
  { label: "AI", href: "/ai", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    toast.success("Signed out");
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="text-lg font-bold tracking-tight text-primary">BE&apos;EMUNA</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="h-3 w-3 opacity-50" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3 space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-medium text-foreground">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
