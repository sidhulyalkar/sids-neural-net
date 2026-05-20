import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ModeProvider } from '@/lib/contexts/ModeContext';
import { NeuronCursor } from '@/components/effects/NeuronCursor';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sidsneural.net'),
  title: {
    default: 'Sid Neural Net | Sidharth Hulyalkar',
    template: '%s | Sid Neural Net',
  },
  description:
    'A living portfolio and research atlas for Sidharth Hulyalkar: neuroscience data infrastructure, applied AI, neural foundation models, mechanistic interpretability, BCI systems, publications, and personal projects.',
  keywords: [
    'Sidharth Hulyalkar',
    'Sid Hulyalkar',
    'neuroscience data engineer',
    'DataJoint',
    'applied AI scientist',
    'neural foundation models',
    'BCI',
    'brain-computer interface',
    'mechanistic interpretability',
    'clinical AI',
    'scientific workflow infrastructure',
    'NEATLABs',
    'UCSD',
  ],
  authors: [{ name: 'Sidharth Hulyalkar' }],
  creator: 'Sidharth Hulyalkar',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Sid Neural Net',
    title: 'Sid Neural Net | Sidharth Hulyalkar',
    description:
      'A living atlas of builds, publications, systems, experiments, interests, and ideas spanning neuroscience, ML, and applied AI.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Sid Neural Net' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sid Neural Net | Sidharth Hulyalkar',
    description:
      'A living atlas of builds, publications, systems, experiments, interests, and ideas.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-bg-deep text-text-primary antialiased"
        suppressHydrationWarning
      >
        <ModeProvider>
          <div className="relative flex min-h-screen flex-col">
            <NeuronCursor />
            <a
              href="#main-content"
              className="fixed left-4 top-4 z-[100] -translate-y-20 rounded-md border border-cyan/40 bg-bg-deep px-4 py-2 text-sm font-semibold text-cyan shadow-glow-cyan transition-transform focus:translate-y-0"
            >
              Skip to content
            </a>
            <Header />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              {children}
            </main>
            <Footer />
          </div>
        </ModeProvider>
      </body>
    </html>
  );
}
