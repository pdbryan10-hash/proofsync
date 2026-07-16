import type { Metadata } from 'next';
import './globals.css';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { ModeBadge } from '@/components/layout/demo-badge';
import { APP_NAME } from '@/lib/config';

export const metadata: Metadata = {
  title: 'ProofSync — verified job completion sync between field and client CAFM',
  description:
    'Complete once. Sync automatically. Review only the exceptions. ProofSync transfers completed job information, attendance data and certificates from your job-management system into the correct job in the client\'s CAFM — verified and audited. Powered by ProofWorks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:px-8">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {APP_NAME}
                </p>
                <p className="truncate text-sm font-semibold text-navy-800">
                  Joblogic → Concerto job completion automation · SEE Services
                </p>
              </div>
              <ModeBadge />
            </header>
            <MobileNav />
            <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </main>
            <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground lg:px-8">
              ProofSync · Powered by ProofWorks · Representative integration adapters — demonstration build
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
