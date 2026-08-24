import type { Metadata, Viewport } from 'next';
import { ThemeProvider, themeScript } from '@/components/theme';
import { ToastProvider } from '@/components/ui/toast';
import { BRAND } from '@/lib/constants';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — Learning Portal`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    'The Fodan College learning portal: lessons, examinations, results and class discussion for Primary and Secondary students.',
  applicationName: BRAND.name,
  icons: {
    icon: BRAND.logo,
    apple: BRAND.logo,
  },
  // The portal is private by design; nothing here should reach a search index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom: some students need it to read, and disabling it is
  // an accessibility failure, not a design choice.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#080f1c' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored colour scheme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-[200] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
