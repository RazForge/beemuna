"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PageMotion } from "@/components/motion/page-motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Google users without profile completion go to completion page first.
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
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">BE&apos;EMUNA</h1>
        <p className="mt-2 text-sm text-muted-foreground italic">
          Your time. Your knowledge. Your direction.
        </p>
      </div>
      <PageMotion>{children}</PageMotion>
    </div>
  );
}
