import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ProofSync — stop typing every completed job twice',
  description:
    "Your engineer completes the job once. ProofSync puts it into your client's system for you — verified, audited, and only the exceptions reach a human. Powered by ProofWorks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
