import { MetadataRoute } from 'next';
import { canonicalSiteUrl } from '@/lib/siteAuthority';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/'],
    },
    sitemap: canonicalSiteUrl('/sitemap.xml'),
  };
}
