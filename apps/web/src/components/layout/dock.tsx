"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  { labelKey: "nav_journal", href: "/journal", icon: BookOpen },
  { labelKey: "nav_calendar", href: "/calendar", icon: CalendarDays },
  { labelKey: "nav_ai", href: "/ai", icon: Bot },
  { labelKey: "nav_goals", href: "/goals", icon: Target },
  { labelKey: "nav_growth", href: "/timeline", icon: TrendingUp },
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
      {showNotifs && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <div className="w-80 rounded-[22px] bg-card p-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("nav_notifications")}</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs text-primary hover:underline"
              >
                {t("mark_all_read")}
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {notifsQuery.data?.map((n) => (
              <div
                key={n.id}
                onClick={() => markOneRead.mutate(n.id)}
                className={cn(
                  "cursor-pointer rounded-xl p-2.5 transition-colors text-left",
                  n.read_at ? "opacity-50" : "bg-primary/10"
                )}
              >
                <p className="text-xs font-semibold">{n.title}</p>
                {n.body && <p className="text-[11px] text-muted-foreground mt-0.5">{n.body}</p>}
              </div>
            ))}
            {notifsQuery.data?.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">{t("no_notifications")}</p>
            )}
          </div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="glass flex items-center gap-1.5 rounded-full p-2.5 border-white/20 dark:border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.25)]"
        >
        {dockItems.map(({ labelKey, href, icon: Icon }) => (
          <Tooltip key={href}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                aria-label={t(labelKey)}
                className={cn("dock-item", isActive(href) && "dock-item-active")}
              >
                <Icon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">{t(labelKey)}</TooltipContent>
          </Tooltip>
        ))}

        <div className="mx-1 h-7 w-px bg-black/10 dark:bg-white/10" />

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowNotifs(!showNotifs)}
              className={cn("dock-item relative", showNotifs && "text-primary")}
              aria-label="Notifications"
            >
              <motion.span
                animate={{ scale: unreadCount > 0 ? [1, 1.25, 1] : 1 }}
                transition={{ repeat: unreadCount > 0 ? Infinity : 0, duration: 1.6 }}
              >
                <Bell className="h-5 w-5" />
              </motion.span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("nav_notifications")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/settings" className={cn("dock-item", isActive("/settings") && "dock-item-active")} aria-label={t("nav_settings")}>
              <Settings className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">{t("nav_settings")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              className="dock-item hover:!text-red-500"
              aria-label={t("nav_sign_out")}
            >
              <LogOut className="h-5 w-5" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("nav_sign_out")}</TooltipContent>
        </Tooltip>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}