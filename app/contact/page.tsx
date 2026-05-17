import { Metadata } from 'next';
import { Mail, Github, Linkedin, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Sidharth Hulyalkar.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">Contact</h1>
          <p className="mt-2 text-lg text-text-secondary">
            Let&apos;s connect. I&apos;m always interested in discussing neuroscience, AI, and interesting problems.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <a
            href="mailto:sidhulyalkar@gmail.com"
            className="glass-card-hover p-6 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/10 border border-cyan/20">
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
            className="glass-card-hover p-6 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet/10 border border-violet/20">
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
            className="glass-card-hover p-6 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
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

          <div className="glass-card p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green/10 border border-green/20">
                <MapPin className="h-6 w-6 text-green" />
              </div>
              <div>
                <div className="font-semibold text-text-primary">Location</div>
                <div className="text-sm text-text-muted">San Diego, California</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
