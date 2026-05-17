import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ModeProvider } from '@/lib/contexts/ModeContext';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sidsneural.net'),
  title: {
    default: "Sid's Neural Net | Sidharth Hulyalkar",
    template: "%s | Sid's Neural Net",
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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: "Sid's Neural Net",
    title: "Sid's Neural Net | Sidharth Hulyalkar",
    description:
      'A living atlas of projects, publications, systems, experiments, interests, and ideas spanning neuroscience, ML, and applied AI.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: "Sid's Neural Net",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Sid's Neural Net | Sidharth Hulyalkar",
    description:
      'A living atlas of projects, publications, systems, experiments, interests, and ideas.',
    images: ['/og-image.png'],
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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-bg-deep text-text-primary antialiased">
        <ModeProvider>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ModeProvider>
      </body>
    </html>
  );
}
