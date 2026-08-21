"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { apiPost, apiPatch } from "@/lib/api";
import { formatError, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

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

const RELIGIONS = [
  { value: "christian", label: "Christian" },
  { value: "muslim", label: "Muslim" },
  { value: "other", label: "Other / Prefer not to say" },
] as const;

export default function CompleteProfilePage() {
  const { user, refresh } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "Africa/Addis_Ababa");
  const [religion, setReligion] = useState<"christian" | "muslim" | "other">(
    (user?.religion as "christian" | "muslim" | "other") ?? "christian"
  );

  const completeProfile = useMutation({
    mutationFn: () =>
      apiPost("/auth/profile/complete", {
        name: name.trim() || null,
        city: city.trim() || null,
        timezone,
        religion,
      }),
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      router.push("/dashboard");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to complete profile"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    completeProfile.mutate();
  };

  return (
    <div className="mx-auto max-w-md pt-12 pb-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("complete_profile")}</h1>
        <p className="mt-2 text-muted-foreground">{t("complete_profile_desc")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t("name_optional")}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("name_optional")}
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">{t("city_placeholder")}</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("city_placeholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">{t("timezone")}</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-full border border-input bg-card px-4 py-2.5 text-sm focus-ring"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>{t("religion")}</Label>
          <div className="flex flex-col gap-2">
            {RELIGIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReligion(r.value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-all",
                  religion === r.value
                    ? "border-primary bg-primary/10"
                    : "border-black/10 hover:border-black/20 dark:border-white/15 dark:hover:border-white/30",
                )}
              >
                <span className="block text-sm font-semibold">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" loading={completeProfile.isPending} disabled={!name.trim()}>
          <Save className="h-4 w-4 mr-2" /> {t("save")}
        </Button>
      </form>
    </div>
  );
}