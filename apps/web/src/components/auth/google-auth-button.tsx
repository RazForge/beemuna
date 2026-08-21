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
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  // Load the Google Identity Services script once.
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

  // Render the button once the GIS script is ready.
  useEffect(() => {
    if (!CLIENT_ID || !scriptReady || !containerRef.current) return;
    if (!window.google?.accounts?.id) return;
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
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: "100%",
    });
  }, [scriptReady, googleLogin, router, t]);

  if (!CLIENT_ID) {
    return (
      <p className="text-center text-[11px] text-muted-foreground">
        Google sign-in is not configured.
      </p>
    );
  }

  return (
    <div className="px-6">
      {scriptReady ? (
        <div ref={containerRef} className={loading ? "opacity-60 pointer-events-none" : ""} />
      ) : (
        <button
          type="button"
          disabled
          className="h-11 w-full rounded-full border border-input bg-card text-sm text-muted-foreground opacity-60"
        >
          Loading Google Sign-in…
        </button>
      )}
    </div>
  );
}