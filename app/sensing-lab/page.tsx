import { SensingLab } from '@/components/sensing/lab/SensingLab';

export const metadata = {
  title: 'Sensing Lab',
  robots: { index: false, follow: false },
};

export default function SensingLabPage() {
  return <SensingLab />;
}
