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
  Bell,
  Settings,
  LogOut,
  X,
  FolderKanban,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

const mainItems = [
  { labelKey: "nav_home", href: "/dashboard", icon: Home },
  { labelKey: "nav_journal", href: "/journal", icon: BookOpen },
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

const glassStyle = {
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.5)",
  boxShadow: "0 2px 12px -2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)",
};

const glassGradient = "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)";

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const notifsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationItem[]>("/reminders/notifications?limit=10"),
    refetchInterval: 30000,
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiPost("/reminders/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(t("all_caught_up"));
    },
  });

  const markOneRead = useMutation({
    mutationFn: (id: string) => apiPost(`/reminders/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleLogout() {
    await logout();
    toast.success(t("signed_out"));
    router.push("/login");
  }

  const unreadCount = notifsQuery.data?.filter((n) => !n.read_at).length ?? 0;

  return (
    <>
      {/* Notification panel */}
      <AnimatePresence>
        {showNotifs && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowNotifs(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
            >
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                  <h3 className="text-sm font-semibold">{t("nav_notifications")}</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={() => readAllMutation.mutate()} className="text-xs font-medium text-primary hover:underline">
                        {t("mark_all_read")}
                      </button>
                    )}
                    <button onClick={() => setShowNotifs(false)} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {notifsQuery.data?.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markOneRead.mutate(n.id)}
                      className={cn("cursor-pointer rounded-xl p-3 transition-colors text-left", n.read_at ? "opacity-50" : "bg-primary/5 hover:bg-primary/10")}
                    >
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    </div>
                  ))}
                  {notifsQuery.data?.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t("no_notifications")}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              "relative flex flex-col items-center gap-0.5 rounded-2xl px-3.5 py-2 text-[10px] font-medium transition-all duration-200",
              isActive(href) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            >
              <Icon className="relative z-10 h-5 w-5" strokeWidth={isActive(href) ? 2.5 : 2} />
              <span className="relative z-10 leading-none">{t(labelKey)}</span>
            </Link>
          ))}

          {/* Notifications */}
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-2xl px-3.5 py-2 text-[10px] font-medium transition-all duration-200",
              showNotifs ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="relative z-10">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive shadow-sm" />
              )}
            </div>
            <span className="relative z-10 leading-none">{t("nav_notifications")}</span>
          </button>

          {/* More */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-2xl px-3.5 py-2 text-[10px] font-medium transition-all duration-200",
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
