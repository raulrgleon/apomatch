import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ApoMatch — Your community. Clearly.',
  description:
    'Independent civic information, community reports and verified official sources. Auburn, Nebraska pilot.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
