import { notFound } from 'next/navigation';
import { FrontierMosaicAudit } from '@/components/frontier/testing/FrontierMosaicAudit';

export const dynamic = 'force-dynamic';

export default function FrontierMosaicAuditPage() {
  if (process.env.FRONTIER_INTERACTION_AUDIT !== 'enabled') notFound();
  return <FrontierMosaicAudit />;
}
