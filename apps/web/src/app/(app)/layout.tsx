import { Dock } from "@/components/layout/dock";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PageMotion } from "@/components/motion/page-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="relative min-h-full">
        <Dock />
        <main className="mx-auto max-w-[1400px] px-6 pb-36 pt-12 md:px-12">
          <PageMotion>{children}</PageMotion>
        </main>
      </div>
    </AuthGuard>
  );
}