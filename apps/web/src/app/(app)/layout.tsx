import { Dock } from "@/components/layout/dock";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PageMotion } from "@/components/motion/page-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="relative min-h-full pb-28 md:pb-40">
        {/* Ambient background blobs for glass effect */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-success/6 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-warning/5 blur-3xl" />
        </div>
        <Dock />
        <main className="relative mx-auto max-w-[1400px] px-4 pt-4 pb-8 md:px-12 md:pt-12 md:pb-40">
          <PageMotion>{children}</PageMotion>
        </main>
      </div>
    </AuthGuard>
  );
}
