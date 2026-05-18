import { Metadata } from 'next';
import { Aperture, Bike, Building2, Mountain, PawPrint, Waves } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { NodeDetailPanel } from '@/components/neural-atlas/NodeDetailPanel';

export const metadata: Metadata = {
  title: 'Photography / Field Notes',
  description: 'Gallery-ready field notes for landscapes, Shasta, cities, motion, and quiet moments.',
};

const categories = [
  {
    icon: Mountain,
    label: 'Landscapes',
    title: 'Weather, ridgelines, and distance.',
    copy: 'A place for mountain light, coastline scale, desert texture, and wide scenes that feel like memory maps.',
    tone: 'cyan' as const,
    className: 'comic-span-7 comic-tilt-left',
  },
  {
    icon: PawPrint,
    label: 'Animals / Shasta',
    title: 'Companionship, motion, and attention.',
    copy: 'A gallery lane for Shasta, animals, trail fragments, and the non-human rhythms that make a day feel grounded.',
    tone: 'rose' as const,
    className: 'comic-span-5 comic-tilt-right md:mt-10',
  },
  {
    icon: Building2,
    label: 'Cities',
    title: 'Glass, shadow, transit, and noise.',
    copy: 'Urban fragments, travel corners, late light, reflections, and the geometry of places passing through.',
    tone: 'violet' as const,
    className: 'comic-span-4',
  },
  {
    icon: Bike,
    label: 'Motion / Adventure',
    title: 'Speed as a compositional tool.',
    copy: 'Mountain biking, trail movement, road texture, blurred edges, and images that keep the body in the frame without centering people.',
    tone: 'green' as const,
    className: 'comic-span-8 comic-tilt-right',
  },
  {
    icon: Waves,
    label: 'Quiet Moments',
    title: 'Small scenes with a long half-life.',
    copy: 'Still water, strange shadows, motel signs, lab-adjacent quiet, and tiny details that keep asking to be noticed.',
    tone: 'amber' as const,
    className: 'comic-span-6 comic-tilt-left',
  },
  {
    icon: Aperture,
    label: 'Gallery Structure',
    title: 'Ready for real image sets.',
    copy: 'This page is built as a masonry-like comic spread so actual photo collections can drop in without changing the visual language.',
    tone: 'cyan' as const,
    className: 'comic-span-6',
  },
];

export default function PhotographyPage() {
  return (
    <ComicSectionLayout
      eyebrow="Photography / Field Memory"
      title="Light, terrain, animals, cities, and quiet signals."
      intro="A gallery-ready chamber for the visual side of the portfolio: landscapes, Shasta, motion, travel, texture, and field attention without turning the site into a stock-photo wall."
    >
      <div className="comic-grid">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <NodeDetailPanel
              key={category.label}
              label={category.label}
              title={category.title}
              tone={category.tone}
              className={category.className}
            >
              <div className="mb-4 flex h-32 items-center justify-center border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(102,227,255,0.16),transparent_8rem),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))]">
                <Icon className="h-10 w-10 text-cyan/80" />
              </div>
              <p>{category.copy}</p>
            </NodeDetailPanel>
          );
        })}
      </div>
    </ComicSectionLayout>
  );
}
