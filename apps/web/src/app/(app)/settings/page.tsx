"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/api";
import type { User } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatError, cn } from "@/lib/utils";
import { toast } from "sonner";
import { KeyRound, MonitorSmartphone, Save, ShieldCheck, Trash2, AlertCircle, AlertTriangle } from "lucide-react";

const RELIGION_LABELS: Record<string, string> = {
  christian: "Christian",
  muslim: "Muslim",
  "non-religious": "Non-religious",
  unspecified: "Not specified",
};

interface Session {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

const AI_ACCESS_KEYS = ["tasks", "goals", "projects", "calendar", "habits", "journal", "notes", "knowledge"] as const;
const CHANNEL_KEYS = ["in_app", "browser"] as const;

const TIMEZONES = [
  "Africa/Addis_Ababa",
  "Africa/Nairobi",
  "Africa/Cairo",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Paris",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-primary" : "bg-black/15 dark:bg-white/20",
      )}
      aria-pressed={on}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function Pill({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="glass inline-flex flex-wrap rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const { setTheme } = useTheme();
  const { t } = useLang();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [theme, setThemeLocal] = useState<string>(user?.theme ?? "system");
  const [calendarMode, setCalendarMode] = useState<string>(user?.calendar_mode ?? "gregorian");
  const [numeralMode, setNumeralMode] = useState<string>(user?.numeral_mode ?? "western");
  const [language, setLanguage] = useState<string>(user?.language ?? "en");
  const [timezone, setTimezone] = useState<string>(user?.timezone ?? "Africa/Addis_Ababa");
  const [quietStart, setQuietStart] = useState(user?.quiet_hours_start ?? "22:00");
  const [quietEnd, setQuietEnd] = useState(user?.quiet_hours_end ?? "07:00");

  const [aiAccess, setAiAccess] = useState<Record<string, boolean>>(user?.ai_access ?? {});
  const [channels, setChannels] = useState<Record<string, boolean>>(user?.notification_channels ?? {});

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const savePrefs = useMutation({
    mutationFn: () =>
      apiPatch<User>("/auth/me", {
        name: name.trim() || null,
        theme,
        calendar_mode: calendarMode,
        numeral_mode: numeralMode,
        language,
        timezone,
        quiet_hours_start: quietStart,
        quiet_hours_end: quietEnd,
      }),
    onSuccess: async () => {
      await refresh();
      setTheme(theme);
      toast.success(t("preferences_saved"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const saveAiAccess = useMutation({
    mutationFn: (v: Record<string, boolean>) => apiPatch<User>("/auth/me", { ai_access: v }),
    onSuccess: async () => {
      await refresh();
      toast.success(t("ai_access"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const saveChannels = useMutation({
    mutationFn: (v: Record<string, boolean>) =>
      apiPatch<User>("/auth/me", { notification_channels: v }),
    onSuccess: async () => {
      await refresh();
      toast.success(t("notification_channels"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      apiPost("/auth/password/change", { current_password: currentPw, new_password: newPw }),
    onSuccess: async () => {
      toast.success(t("password_changed"));
      await logout();
      setCurrentPw("");
      setNewPw("");
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const resendVerify = useMutation({
    mutationFn: () => apiPost("/auth/verify/resend", { email: user?.email }),
    onSuccess: () => toast.success(t("verification_sent")),
    onError: (err) => toast.error(formatError(err)),
  });

  const doVerify = useMutation({
    mutationFn: (token: string) => apiPost("/auth/verify/email", { token }),
    onSuccess: async () => {
      await refresh();
      setVerifyToken("");
      toast.success(t("email_verified_now"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiDelete("/auth/account"),
    onSuccess: async () => {
      await logout();
      toast.success(t("delete_account"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiGet<Session[]>("/auth/sessions"),
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => apiDelete(`/auth/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(t("session_revoked"));
    },
    onError: (err) => toast.error(formatError(err)),
  });

  const dirty =
    (name.trim() || null) !== (user?.name ?? null) ||
    theme !== (user?.theme ?? "system") ||
    calendarMode !== (user?.calendar_mode ?? "gregorian") ||
    numeralMode !== (user?.numeral_mode ?? "western") ||
    language !== (user?.language ?? "en") ||
    timezone !== (user?.timezone ?? "Africa/Addis_Ababa") ||
    quietStart !== (user?.quiet_hours_start ?? "22:00") ||
    quietEnd !== (user?.quiet_hours_end ?? "07:00");

  const row = "flex items-center justify-between gap-4 py-2.5";
  const label = "text-sm text-muted-foreground";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-8 pt-4">
      <header className="glass rounded-[28px] p-7 flex flex-wrap items-center justify-between gap-4 shadow-xl border-white/20 dark:border-white/5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
            {t("settings_title")}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm font-medium">
            {t("preferences")}
          </p>
        </div>
      </header>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("account")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className={row}>
            <span className={label}>{t("email")}</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-name">{t("name_optional")}</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("name_optional")}
            />
          </div>
          <div className={row}>
            <span className={label}>{t("email_verification")}</span>
            {user?.email_verified ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> {t("verified")}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-warning">{t("not_verified")}</span>
                <Button size="sm" variant="outline" onClick={() => resendVerify.mutate()} loading={resendVerify.isPending}>
                  {t("resend_link")}
                </Button>
              </div>
            )}
          </div>
          <div className={row}>
            <span className={label}>{t("religion")}</span>
            <div className="text-right">
              <span className="text-sm font-medium">
                {RELIGION_LABELS[user?.religion ?? "unspecified"]}
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set at registration · cannot be changed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("preferences")}</CardTitle>
          <CardDescription>{t("appearance_defaults")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className={row}>
            <span className={label}>{t("theme")}</span>
            <Pill
              options={[
                { value: "system", label: t("system") },
                { value: "light", label: t("light") },
                { value: "dark", label: t("dark") },
              ]}
              value={theme}
              onChange={(v) => {
                setThemeLocal(v);
                setTheme(v);
              }}
            />
          </div>
          <div className={row}>
            <span className={label}>{t("calendar_mode")}</span>
            <Pill
              options={[
                { value: "gregorian", label: "Gregorian" },
                { value: "ethiopian", label: t("ethiopian") },
                { value: "dual", label: t("dual") },
              ]}
              value={calendarMode}
              onChange={setCalendarMode}
            />
          </div>
          <div className={row}>
            <span className={label}>{t("numerals")}</span>
            <Pill
              options={[
                { value: "western", label: t("western") },
                { value: "geez", label: t("geez") },
                { value: "both", label: t("both") },
              ]}
              value={numeralMode}
              onChange={setNumeralMode}
            />
          </div>
          <div className={row}>
            <span className={label}>{t("language")}</span>
            <Pill
              options={[
                { value: "en", label: t("english") },
                { value: "am", label: t("amharic") },
              ]}
              value={language}
              onChange={setLanguage}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-tz">{t("timezone")}</Label>
            <select
              id="settings-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-10 rounded-2xl border border-border bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-qh-start">{t("quiet_hours_start")}</Label>
              <Input id="settings-qh-start" type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-qh-end">{t("quiet_hours_end")}</Label>
              <Input id="settings-qh-end" type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => savePrefs.mutate()} loading={savePrefs.isPending} disabled={!dirty} className="self-start">
            <Save className="h-4 w-4" /> {t("save_preferences")}
          </Button>
        </CardContent>
      </Card>

      {/* AI access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ai_access")}</CardTitle>
          <CardDescription>{t("ai_access_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {AI_ACCESS_KEYS.map((key) => (
            <div key={key} className={row}>
              <span className="text-sm capitalize">{key}</span>
              <Toggle
                on={aiAccess[key] ?? false}
                onChange={(v) => {
                  const next = { ...aiAccess, [key]: v };
                  setAiAccess(next);
                  saveAiAccess.mutate(next);
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notification channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("notification_channels")}</CardTitle>
          <CardDescription>{t("notification_channels_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {CHANNEL_KEYS.map((key) => (
            <div key={key} className={row}>
              <span className="text-sm capitalize">{key.replace("_", " ")}</span>
              <Toggle
                on={channels[key] ?? false}
                onChange={(v) => {
                  const next = { ...channels, [key]: v };
                  setChannels(next);
                  saveChannels.mutate(next);
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("security")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!user?.email_verified && (
            <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
              <p className="text-sm font-semibold">{t("verify_your_email")}</p>
              <div className="flex gap-2">
                <Input
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder={t("verification_token_placeholder")}
                  className="flex-1"
                />
                <Button onClick={() => verifyToken && doVerify.mutate(verifyToken)} loading={doVerify.isPending} disabled={!verifyToken}>
                  {t("verify")}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4" /> {t("change_password")}
            </p>
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder={t("current_password")} />
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t("new_password")} />
            <Button
              onClick={() => changePassword.mutate()}
              loading={changePassword.isPending}
              disabled={!currentPw || newPw.length < 8}
              className="self-start"
            >
              {t("change_password")}
            </Button>
            <p className="text-[12px] text-muted-foreground">
              {t("sessions_signed_out")}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MonitorSmartphone className="h-4 w-4" /> {t("active_sessions")}
            </p>
            {sessionsQuery.data?.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-3.5 py-2.5 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.user_agent?.split("(")[0].trim() || t("unknown_device")}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {s.ip ?? "?"} · {new Date(s.created_at).toLocaleString()}
                    {s.revoked_at ? ` · ${t("revoked")}` : ` · ${t("active")}`}
                  </p>
                </div>
                {!s.revoked_at && (
                  <button
                    onClick={() => revokeSession.mutate(s.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
                    aria-label={t("revoke")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {sessionsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("no_sessions")}</p>
            )}
          </div>

          {/* Danger zone - Delete Account */}
          <div className="flex flex-col gap-3 pt-4 border-t border-black/10 dark:border-white/10">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> {t("delete_account")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("delete_account_desc")}
            </p>
            <Button
              variant="destructive"
              className="self-start"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <AlertCircle className="h-4 w-4" /> {t("delete_account")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h3 className="mt-3 text-lg font-semibold">{t("delete_account")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("delete_account_desc")}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                loading={deleteAccount.isPending}
                onClick={() => {
                  deleteAccount.mutate();
                  setShowDeleteConfirm(false);
                }}
              >
                {t("delete_account")}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}