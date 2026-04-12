import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VR Platform',
  description: 'Hub de experiências VR web modulares.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
