'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Dog,
  Mountain,
  Bike,
  Waves,
  Gamepad2,
  Utensils,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { GlowButton } from '@/components/ui';

const interests = [
  { icon: Dog, label: 'Shasta', color: 'rose' },
  { icon: Mountain, label: 'Rock Climbing', color: 'amber' },
  { icon: Bike, label: 'Mountain Biking', color: 'green' },
  { icon: Waves, label: 'Snorkeling', color: 'cyan' },
  { icon: Gamepad2, label: 'PC Gaming', color: 'violet' },
  { icon: Utensils, label: 'Food Adventures', color: 'amber' },
  { icon: Compass, label: 'Exploration', color: 'green' },
];

const colorClasses = {
  cyan: 'text-cyan bg-cyan/10 border-cyan/20 hover:bg-cyan/20',
  violet: 'text-violet bg-violet/10 border-violet/20 hover:bg-violet/20',
  amber: 'text-amber bg-amber/10 border-amber/20 hover:bg-amber/20',
  green: 'text-green bg-green/10 border-green/20 hover:bg-green/20',
  rose: 'text-rose bg-rose/10 border-rose/20 hover:bg-rose/20',
};

export function PersonalSignalStrip() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-b border-white/10 bg-gradient-to-r from-bg-deep via-bg-panel/50 to-bg-deep">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Text */}
          <div className="text-center lg:text-left max-w-xl">
            <h3 className="text-xl font-semibold text-text-primary">
              Life Outside the Lab
            </h3>
            <p className="mt-2 text-text-secondary">
              I like systems that move: brains, trails, teams, games, oceans, codebases, and conversations.
              My best ideas usually come from crossing worlds that aren&apos;t supposed to talk to each other.
            </p>
            <div className="mt-4">
              <GlowButton href="/life" variant="ghost" glowColor="rose" size="sm">
                Explore More
                <ArrowRight className="h-4 w-4" />
              </GlowButton>
            </div>
          </div>

          {/* Interest nodes */}
          <div className="flex flex-wrap justify-center gap-3">
            {interests.map((interest, index) => (
              <motion.div
                key={interest.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href="/life"
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${colorClasses[interest.color as keyof typeof colorClasses]}`}
                >
                  <interest.icon className="h-4 w-4" />
                  {interest.label}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
