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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

const dockItems = [
  { labelKey: "nav_home", href: "/dashboard", icon: Home },
  { labelKey: "nav_projects", href: "/projects", icon: FolderKanban },
  { labelKey: "nav_journal", href: "/journal", icon: BookOpen },
  { labelKey: "nav_ai", href: "/ai", icon: Bot },
  { labelKey: "nav_goals", href: "/goals", icon: Target },
  { labelKey: "nav_journey", href: "/journey", icon: TrendingUp },
  { labelKey: "nav_knowledge", href: "/knowledge", icon: Brain },
];

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [showNotifs, setShowNotifs] = useState(false);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
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
    <TooltipProvider delayDuration={300}>
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
                      <button
                        onClick={() => readAllMutation.mutate()}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {t("mark_all_read")}
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifs(false)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {notifsQuery.data?.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markOneRead.mutate(n.id)}
                      className={cn(
                        "cursor-pointer rounded-xl p-3 transition-colors text-left",
                        n.read_at ? "opacity-50" : "bg-primary/5 hover:bg-primary/10",
                      )}
                    >
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      )}
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

      <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="glass flex items-center gap-1 rounded-2xl p-2"
        >
          {dockItems.map(({ labelKey, href, icon: Icon }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  aria-label={t(labelKey)}
                  className={cn("dock-item", isActive(href) && "dock-item-active")}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive(href) ? 2.5 : 2} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {t(labelKey)}
              </TooltipContent>
            </Tooltip>
          ))}

          <div className="mx-1 h-6 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowNotifs(!showNotifs)}
                className={cn("dock-item relative", showNotifs && "text-primary bg-primary/10")}
                aria-label="Notifications"
              >
                <motion.span
                  animate={{ scale: unreadCount > 0 ? [1, 1.2, 1] : 1 }}
                  transition={{ repeat: unreadCount > 0 ? Infinity : 0, duration: 1.8 }}
                >
                  <Bell className="h-[18px] w-[18px]" />
                </motion.span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("nav_notifications")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={cn("dock-item", isActive("/settings") && "dock-item-active")}
                aria-label={t("nav_settings")}
              >
                <Settings className="h-[18px] w-[18px]" strokeWidth={isActive("/settings") ? 2.5 : 2} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("nav_settings")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleLogout}
                className="dock-item hover:!text-destructive"
                aria-label={t("nav_sign_out")}
              >
                <LogOut className="h-[18px] w-[18px]" />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("nav_sign_out")}
            </TooltipContent>
          </Tooltip>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
