import { notFound } from 'next/navigation';
import { FrontierInteractionAudit } from '@/components/frontier/testing/FrontierInteractionAudit';

export const dynamic = 'force-dynamic';

export default function FrontierInteractionAuditPage() {
  if (process.env.FRONTIER_INTERACTION_AUDIT !== 'enabled') notFound();
  return <FrontierInteractionAudit />;
}
