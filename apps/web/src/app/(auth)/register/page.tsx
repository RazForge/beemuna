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
import { formatError, cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [religion, setReligion] = useState<string | null>(null);
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
      await register(email, password, name || undefined, religion || "unspecified");
      toast.success(t("account_created"));
      router.push("/dashboard");
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <GoogleAuthButton />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">
              {t("name_optional")}
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder={t("name_optional")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              {t("email")}
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">
              {t("password")}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t("password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("ai_perspective")}</Label>
            <p className="text-xs text-muted-foreground">
              What perspective would you like BEMUNNA to consider when giving personal advice?
            </p>
            <div className="grid gap-2">
              {PERSPECTIVES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReligion(r.value)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition-all",
                    religion === r.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block mt-0.5 text-xs text-muted-foreground">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" loading={loading} disabled={!religion}>
            {t("create_account")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("already_have_account")}{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t("sign_in")}
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
