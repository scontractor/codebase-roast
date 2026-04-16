import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'codebase-roast 🔥',
  description: 'Does your code deserve to burn? Find out.',
  openGraph: {
    title: 'codebase-roast 🔥',
    description: 'AI-powered code roasts. Brutal. Accurate. Cathartic.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
