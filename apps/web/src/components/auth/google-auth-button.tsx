"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/lib/i18n";
import { formatError } from "@/lib/utils";
import { toast } from "sonner";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleAuthButton() {
  const { googleLogin } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (window.google?.accounts?.id) {
      setScriptReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!CLIENT_ID || !scriptReady || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (resp) => {
        try {
          setLoading(true);
          await googleLogin(resp.credential);
          toast.success(t("welcome_back"));
          router.push("/dashboard");
        } catch (err) {
          toast.error(formatError(err));
        } finally {
          setLoading(false);
        }
      },
      auto_select: false,
    });
  }, [scriptReady, googleLogin, router, t]);

  function handleClick() {
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.prompt();
  }

  if (!CLIENT_ID) {
    return (
      <p className="text-center text-[11px] text-muted-foreground">
        Google sign-in is not configured.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || !scriptReady}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-sm font-medium transition-colors hover:bg-muted/50 disabled:opacity-50"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {loading ? "Signing in…" : "Continue with Google"}
    </button>
  );
}
