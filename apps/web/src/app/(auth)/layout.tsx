"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PageMotion } from "@/components/motion/page-motion";
import { motion } from "framer-motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user && !user.profile_completed_at) {
        router.replace("/complete-profile");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [isAuthenticated, isLoading, router, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4 py-12">
      {/* Ambient blobs for glass effect */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-success/6 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-warning/5 blur-3xl" />
      </div>
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <img 
            src="/images/beemuna-logo.png" 
            alt="Beemuna" 
            className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-xl shadow-primary/20 border border-white/10 object-cover"
          />
          <h1 className="text-2xl font-bold tracking-tight">BE&apos;EMUNA</h1>
          <div className="mt-2 overflow-hidden">
            <svg
              className="mx-auto h-5 w-[280px]"
              viewBox="0 0 280 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="shimmer" x1="-100%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.4" />
                  <stop offset="40%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="hsl(var(--foreground))" stopOpacity="1" />
                  <stop offset="60%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.4" />
                  <animate
                    attributeName="x1"
                    from="-100%"
                    to="200%"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="x2"
                    from="0%"
                    to="300%"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </linearGradient>
              </defs>
              <text
                x="140"
                y="15"
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: "13px", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
              >
                Your time. Your knowledge. Your direction.
              </text>
              <text
                x="140"
                y="15"
                textAnchor="middle"
                fill="url(#shimmer)"
                style={{ fontSize: "13px", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
              >
                Your time. Your knowledge. Your direction.
              </text>
            </svg>
          </div>
        </motion.div>
        <div className="glass rounded-3xl p-6 md:p-8">
          <PageMotion>{children}</PageMotion>
        </div>
      </div>
    </div>
  );
}
