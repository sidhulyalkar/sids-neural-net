import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Bebas_Neue } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ModeProvider } from '@/lib/contexts/ModeContext';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Sid Neural Net',
    title: 'Sid Neural Net | Sidharth Hulyalkar',
    description:
      'A living atlas of projects, publications, systems, experiments, interests, and ideas spanning neuroscience, ML, and applied AI.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Sid Neural Net',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sid Neural Net | Sidharth Hulyalkar',
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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${bebasNeue.variable}`}>
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
