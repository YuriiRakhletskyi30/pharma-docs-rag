import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans({
  variable: '--font-plex',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Drug Label Q&A',
  description: 'Ask questions about FDA prescribing information and get answers cited to the label page.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${plex.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden font-sans">{children}</body>
    </html>
  );
}
