import { Metadata } from 'next';
import Link from 'next/link';
import { ComicSectionLayout } from '@/components/neural-atlas/ComicSectionLayout';

export const metadata: Metadata = {
  title: 'Core',
  description:
    'About Sidharth Hulyalkar, a neuroscience data systems, multimodal ML, BCI infrastructure, and applied AI engineer.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'Core | Sid Neural Net',
    description:
      'Background, working style, and technical through-line for Sidharth Hulyalkar.',
    url: '/about',
  },
};

const coordinates = [
  { label: 'Education', value: 'M.E. Bioengineering, UC San Diego' },
  { label: 'Undergrad', value: 'B.S. Bioengineering: Biosystems, UC San Diego' },
  { label: 'Location', value: 'Los Gatos, California' },
];

const affiliations = [
  { name: 'Panoptic Bio', role: 'Founding Applied AI Engineer', period: '2025–Present' },
  { name: 'Stealth NeuroAI Startup', role: 'Founding Engineer', period: '2025' },
  { name: 'DataJoint', role: 'Neuroscience Data Engineer II', period: '2022–2024' },
  { name: 'NEATLABs, UCSD', role: 'Lead Lab Programmer', period: '2017–2022' },
];

const technicalDomains = [
  'Neural data infrastructure',
  'Multimodal foundation models',
  'BCI & real-time systems',
  'Scientific workflow systems',
  'Mechanistic interpretability',
];

const stack = {
  languages: ['Python', 'MATLAB', 'TypeScript', 'SQL', 'R', 'Java', 'Bash'],
  'ml/dl': ['PyTorch', 'TensorFlow', 'Keras', 'XGBoost', 'Hugging Face', 'Scikit-learn', 'CUDA'],
  'architectures': ['CNNs', 'RNNs', 'LSTMs', 'U-Net', 'Transformers', 'Mamba', 'Perceiver IO'],
  'data science': ['NumPy', 'SciPy', 'Pandas', 'Dask', 'OpenCV', 'Scikit-image'],
  cloud: ['AWS', 'Google Cloud', 'Cloudflare', 'Docker', 'Kubernetes', 'Terraform', 'Singularity'],
  'aws services': ['EC2', 'S3', 'Lambda', 'Kinesis', 'CloudWatch', 'EFS'],
  frameworks: ['FastAPI', 'Next.js', 'React', 'Streamlit', 'Dash', 'DataJoint', 'Nextflow'],
  'neuro tools': ['SpikeInterface', 'Suite2p', 'CaImAn', 'DeepLabCut', 'Facemap', 'Kilosort', 'Open Ephys', 'Allen SDK'],
  'data formats': ['NWB', 'Zarr', 'HDF5', 'Parquet', 'MCAP'],
  'signal processing': ['DTW', 'Kalman Filtering', 'ERP/ERSP', 'Spectral Analysis', 'Granger Causality', 'PCA/ICA'],
  analysis: ['Electrophysiology', 'LFP/EEG', 'Calcium Imaging', 'Fiber Photometry', 'Pose Estimation', 'Q-Learning'],
  visualization: ['Matplotlib', 'Seaborn', 'Bokeh', 'Plotly', 'Three.js', 'Foxglove'],
  devops: ['Git', 'GitHub Actions', 'CI/CD', 'Linux', 'Jira', 'Prometheus', 'Grafana', 'DataDog'],
  tools: ['Jupyter', 'Vim', 'tmux', 'SSH', 'Arduino', 'Raspberry Pi'],
};

const links = [
  { label: 'GitHub', href: 'https://github.com/sidhulyalkar' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/sidhulyalkar' },
  { label: 'Resume', href: '/resume' },
];

export default function AboutPage() {
  return (
    <ComicSectionLayout
      eyebrow="CORE"
      title="core"
    >
      <div className="space-y-16">
        {/* Coordinates */}
        <section>
          <p className="technical-label mb-8">Coordinates</p>
          <div className="grid gap-8 sm:grid-cols-3">
            {coordinates.map((item) => (
              <div key={item.label}>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/40">
                  {item.label}
                </p>
                <p className="mt-2 text-sm text-text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Affiliations */}
        <section>
          <p className="technical-label mb-8">Affiliations</p>
          <div className="space-y-6">
            {affiliations.map((item) => (
              <div key={item.name} className="flex items-baseline justify-between border-b border-white/8 pb-4">
                <div>
                  <p className="text-sm text-text-primary">{item.name}</p>
                  <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/50">
                    {item.role}
                  </p>
                </div>
                <p className="font-mono text-[0.62rem] tracking-wider text-white/40">{item.period}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Domains & Stack */}
        <div className="grid gap-16 lg:grid-cols-2">
          <section>
            <p className="technical-label mb-8">Domains</p>
            <ul className="space-y-3">
              {technicalDomains.map((domain) => (
                <li key={domain} className="flex items-center gap-3 text-sm text-text-secondary">
                  <span className="h-px w-4 bg-cyan/40" />
                  {domain}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="technical-label mb-8">Stack</p>
            <div className="space-y-5">
              {Object.entries(stack).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/30">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((tech) => (
                      <span
                        key={tech}
                        className="border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-white/55"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Links */}
        <section>
          <p className="technical-label mb-8">Links</p>
          <div className="flex flex-wrap gap-6">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="font-mono text-xs uppercase tracking-[0.14em] text-cyan/70 transition-colors hover:text-cyan"
              >
                {link.label} →
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ComicSectionLayout>
  );
}
