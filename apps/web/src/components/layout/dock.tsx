"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BookOpen,
  Target,
  TrendingUp,
  Brain,
  Bot,
  CalendarDays,
  Settings,
  LogOut,
  X,
  FolderKanban,
  MoreHorizontal,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";

const mainItems = [
  { labelKey: "nav_home", href: "/dashboard", icon: Home },
  { labelKey: "nav_journal", href: "/journal", icon: BookOpen },
  { labelKey: "nav_reminders", href: "/reminders", icon: Clock },
  { labelKey: "nav_calendar", href: "/calendar", icon: CalendarDays },
  { labelKey: "nav_ai", href: "/ai", icon: Bot },
];

const moreItems = [
  { labelKey: "nav_projects", href: "/projects", icon: FolderKanban },
  { labelKey: "nav_goals", href: "/goals", icon: Target },
  { labelKey: "nav_journey", href: "/journey", icon: TrendingUp },
  { labelKey: "nav_knowledge", href: "/knowledge", icon: Brain },
  { labelKey: "nav_settings", href: "/settings", icon: Settings },
];

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLang();
  const [showMore, setShowMore] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleLogout() {
    await logout();
    toast.success(t("signed_out"));
    router.push("/login");
  }

  return (
    <>
      {/* More menu (mobile) */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
            >
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-2 shadow-xl">
                {moreItems.map(({ labelKey, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      isActive(href) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {t(labelKey)}
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={() => { setShowMore(false); handleLogout(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  {t("nav_sign_out")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom dock */}
      <div className="fixed inset-x-0 bottom-0 z-50 safe-area-pb">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 px-4 py-2">
          {mainItems.map(({ labelKey, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-full px-3.5 py-2 text-[10px] font-medium transition-all duration-200",
                isActive(href) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="relative z-10 h-5 w-5" strokeWidth={isActive(href) ? 2.5 : 2} />
              <span className="relative z-10 leading-none">{t(labelKey)}</span>
            </Link>
          ))}

          {/* More */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-full px-3.5 py-2 text-[10px] font-medium transition-all duration-200",
              showMore ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className="relative z-10 h-5 w-5" />
            <span className="relative z-10 leading-none">More</span>
          </button>
        </div>
      </div>
    </>
  );
}
