import { Dock } from "@/components/layout/dock";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PageMotion } from "@/components/motion/page-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="relative min-h-full pb-24 md:pb-36">
        <Dock />
        <main className="mx-auto max-w-[1400px] px-4 pt-4 pb-8 md:px-12 md:pt-12 md:pb-36">
          <PageMotion>{children}</PageMotion>
        </main>
      </div>
    </AuthGuard>
  );
}
