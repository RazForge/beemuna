"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatError, cn } from "@/lib/utils";
import { toast } from "sonner";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [religion, setReligion] = useState<string>("christian");
  const [loading, setLoading] = useState(false);

  const PERSPECTIVES = [
    { value: "christian", label: t("ai_perspective_christian"), hint: "Guidance from a Christian perspective when relevant" },
    { value: "muslim", label: t("ai_perspective_muslim"), hint: "Guidance from an Islamic perspective when relevant" },
    { value: "jewish", label: t("ai_perspective_jewish"), hint: "Guidance from a Jewish perspective when relevant" },
    { value: "hindu", label: t("ai_perspective_hindu"), hint: "Guidance from a Hindu perspective when relevant" },
    { value: "buddhist", label: t("ai_perspective_buddhist"), hint: "Guidance from a Buddhist perspective when relevant" },
    { value: "secular", label: t("ai_perspective_secular"), hint: "Practical reasoning without religious framing" },
    { value: "unspecified", label: "Prefer not to specify", hint: "Neutral perspective, no religious context" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name || undefined, religion);
      toast.success(t("account_created"));
      router.push("/dashboard");
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t("create_account")}</CardTitle>
        <CardDescription>{t("create_account_subtitle")}</CardDescription>
      </CardHeader>
      <div className="relative px-6 pt-1">
        <GoogleAuthButton />
        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name_optional")}</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder={t("name_optional")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t("password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("ai_perspective")}</Label>
            <p className="text-[12px] text-muted-foreground">
              What perspective would you like BEMUNNA to consider when giving personal advice?
            </p>
            <div className="flex flex-col gap-2">
              {PERSPECTIVES.map((r) => (
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
                  <span className="block text-[14px] font-semibold">{r.label}</span>
                  <span className="block text-[12px] text-muted-foreground">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" loading={loading}>
            {t("create_account")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("already_have_account")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("sign_in")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
