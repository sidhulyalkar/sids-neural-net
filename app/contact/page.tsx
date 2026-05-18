import { Metadata } from 'next';
import { Mail, Github, Linkedin, MapPin } from 'lucide-react';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';
import { NodeDetailPanel } from '@/components/neural-atlas/NodeDetailPanel';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Sidharth Hulyalkar.',
};

export default function ContactPage() {
  return (
    <ComicSectionLayout
      eyebrow="Open Channel"
      title="Collaborations, roles, systems, and strange useful prototypes."
      intro="Let's connect around neuroscience infrastructure, applied AI, multimodal systems, research tools, or interesting problems with enough ambiguity to be worth building through."
    >
        <div className="comic-grid">
          <a
            href="mailto:sidhulyalkar@gmail.com"
            className="comic-panel comic-span-6 p-6 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-cyan/10 border border-cyan/20">
                <Mail className="h-6 w-6 text-cyan" />
              </div>
              <div>
                <div className="font-semibold text-text-primary group-hover:text-cyan transition-colors">
                  Email
                </div>
                <div className="text-sm text-text-muted">sidhulyalkar@gmail.com</div>
              </div>
            </div>
          </a>

          <a
            href="https://github.com/sidhulyalkar"
            target="_blank"
            rel="noopener noreferrer"
            className="comic-panel comic-span-6 comic-tilt-right p-6 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-violet/10 border border-violet/20">
                <Github className="h-6 w-6 text-violet" />
              </div>
              <div>
                <div className="font-semibold text-text-primary group-hover:text-violet transition-colors">
                  GitHub
                </div>
                <div className="text-sm text-text-muted">@sidhulyalkar</div>
              </div>
            </div>
          </a>

          <a
            href="https://linkedin.com/in/sidhulyalkar"
            target="_blank"
            rel="noopener noreferrer"
            className="comic-panel comic-span-5 comic-tilt-left p-6 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-500/10 border border-blue-500/20">
                <Linkedin className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-text-primary group-hover:text-blue-400 transition-colors">
                  LinkedIn
                </div>
                <div className="text-sm text-text-muted">sidhulyalkar</div>
              </div>
            </div>
          </a>

          <div className="comic-panel comic-span-7 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green/10 border border-green/20">
                <MapPin className="h-6 w-6 text-green" />
              </div>
              <div>
                <div className="font-semibold text-text-primary">Location</div>
                <div className="text-sm text-text-muted">San Diego, California</div>
              </div>
            </div>
          </div>
          <NodeDetailPanel
            label="Best Fit"
            title="Work where the system has to be both rigorous and alive."
            tone="cyan"
            className="comic-span-12"
          >
            <p>
              I am especially interested in neural data infrastructure, applied AI products, scientific
              workflow systems, multimodal ML, BCI tools, interpretability, and creative technical work
              that needs a builder with taste and tolerance for messy reality.
            </p>
          </NodeDetailPanel>
        </div>
    </ComicSectionLayout>
  );
}
