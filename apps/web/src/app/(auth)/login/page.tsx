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
import { formatError } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success(t("welcome_back"));
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
      className="mx-auto w-full max-w-sm"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
          B
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      <div className="space-y-4">
        <GoogleAuthButton />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 rounded-xl"
            />
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl text-sm font-semibold" loading={loading}>
            {t("sign_in")}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("no_account")}{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t("register")}
        </Link>
      </p>
    </motion.div>
  );
}
