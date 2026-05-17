import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'About Sidharth Hulyalkar - applied AI scientist and neuroscience systems engineer.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary">About</h1>
        </div>

        <div className="glass-card prose-neural">
          <p className="text-lg text-text-secondary">
            I&apos;m <span className="text-text-primary font-medium">Sidharth Hulyalkar</span>, an applied AI scientist
            and neuroscience systems engineer building adaptive ML systems for biological complexity.
          </p>

          <h2 className="mt-8 text-2xl font-bold text-text-primary">Background</h2>
          <p className="text-text-secondary">
            My work spans multimodal neural data pipelines, foundation models for brain dynamics,
            mechanistic interpretability tools, clinical intelligence products, and real-time
            experimental infrastructure.
          </p>

          <h2 className="mt-8 text-2xl font-bold text-text-primary">Professional Journey</h2>
          <ul className="mt-4 space-y-2 text-text-secondary">
            <li><strong className="text-text-primary">DataJoint</strong> - Neuroscience Data Engineer II (2022-2024)</li>
            <li><strong className="text-text-primary">NEATLABs, UCSD</strong> - Lead Lab Programmer (2017-2022)</li>
            <li><strong className="text-text-primary">Dolby Laboratories</strong> - Engineering Intern (2014, 2016)</li>
          </ul>

          <h2 className="mt-8 text-2xl font-bold text-text-primary">Research Interests</h2>
          <ul className="mt-4 space-y-1 text-text-secondary">
            <li>Neural foundation models and tokenization</li>
            <li>Mechanistic interpretability for neural systems</li>
            <li>Brain-computer interfaces and closed-loop systems</li>
            <li>Scientific workflow infrastructure</li>
            <li>Large-scale electrophysiology analysis</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
