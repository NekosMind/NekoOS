import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://nekos.world'),
  title: 'Neko Agent',
  description: 'A recovered Macintosh archive belonging to Neko, a tiny cursor-chasing cat lost somewhere between 1994 and the modern internet.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/neko-chart-icon.jpg',
    shortcut: '/neko-chart-icon.jpg',
    apple: '/neko-chart-icon.jpg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
