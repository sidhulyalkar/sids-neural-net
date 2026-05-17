'use client';

import { motion } from 'framer-motion';
import { Mail, Github, Linkedin, ArrowRight } from 'lucide-react';
import { GlowButton } from '@/components/ui';

export function ContactCTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Signal line */}
          <div className="mb-8 mx-auto h-px w-32 bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />

          <h2 className="text-3xl font-bold text-text-primary md:text-4xl">
            Let&apos;s Connect
          </h2>

          <p className="mt-4 text-lg text-text-secondary">
            Whether you&apos;re interested in neuroscience infrastructure, foundation models,
            mechanistic interpretability, or just want to chat about interesting problems.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <GlowButton
              href="mailto:sidhulyalkar@gmail.com"
              external
              size="lg"
            >
              <Mail className="h-5 w-5" />
              Get in Touch
              <ArrowRight className="h-4 w-4" />
            </GlowButton>

            <div className="flex gap-2">
              <GlowButton
                href="https://github.com/sidhulyalkar"
                external
                variant="secondary"
                size="lg"
              >
                <Github className="h-5 w-5" />
                GitHub
              </GlowButton>

              <GlowButton
                href="https://linkedin.com/in/sidhulyalkar"
                external
                variant="secondary"
                size="lg"
              >
                <Linkedin className="h-5 w-5" />
                LinkedIn
              </GlowButton>
            </div>
          </div>

          {/* Signal line */}
          <div className="mt-8 mx-auto h-px w-32 bg-gradient-to-r from-transparent via-violet/50 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
