import { notFound } from 'next/navigation';
import { FrontierPhase9Audit } from '@/components/frontier/testing/FrontierPhase9Audit';

export const dynamic = 'force-dynamic';

export default function FrontierPhase9AuditPage() {
  if (process.env.FRONTIER_INTERACTION_AUDIT !== 'enabled') notFound();
  return <FrontierPhase9Audit />;
}
