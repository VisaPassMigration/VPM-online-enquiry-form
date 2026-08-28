import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'VPM Intake Platform',
  description: 'Structured client registration platform for Visa Pass Migration.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
