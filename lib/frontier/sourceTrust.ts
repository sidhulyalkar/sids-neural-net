import { FRONTIER_LANE_MAP } from './config';
import type { FrontierItem, FrontierSourceKind } from './types';

export type FrontierSourceTrustTier =
  | 'primary'
  | 'institutional'
  | 'established'
  | 'platform'
  | 'community'
  | 'unknown'
  | 'blocked';

export type FrontierSourceTrust = {
  host: string;
  tier: FrontierSourceTrustTier;
  score: number;
  reason: string;
};

type HostRule = {
  domains: readonly string[];
  tier: Exclude<FrontierSourceTrustTier, 'unknown' | 'blocked'>;
  score: number;
  reason: string;
};

const DISCOVERY_DESTINATION_KINDS = new Set<FrontierSourceKind>([
  'hackernews',
  'rss',
  'brave_web',
  'gdelt',
]);

const SYNDICATION_HOSTS = [
  'news.google.com',
  'news.yahoo.com',
] as const;

const OPAQUE_REDIRECT_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'lnkd.in',
] as const;

// This is a provenance prior, not a declaration that every claim on a domain is
// true. Primary/official sources are authoritative about their own releases and
// records; established editorial and scholarly sources still require normal
// critical reading. The goal is to prevent an aggregator or novelty signal from
// laundering an unknown destination into FRONTIER's high-confidence lanes.
const HOST_RULES: readonly HostRule[] = [
  {
    domains: [
      'arxiv.org', 'export.arxiv.org', 'openreview.net', 'biorxiv.org', 'medrxiv.org',
      'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'clinicaltrials.gov', 'doi.org',
      'proceedings.neurips.cc', 'icml.cc', 'jmlr.org', 'aaai.org', 'openaccess.thecvf.com',
      'osf.io', 'zenodo.org',
    ],
    tier: 'primary',
    score: 0.9,
    reason: 'direct research record or primary scholarly index',
  },
  {
    domains: [
      'nasa.gov', 'nih.gov', 'cdc.gov', 'fda.gov', 'noaa.gov', 'nist.gov', 'nsf.gov', 'data.gov',
      'who.int', 'esa.int', 'cern.ch', 'gov.uk', 'alleninstitute.org', 'brain-map.org',
      'janelia.org', 'dandiarchive.org',
    ],
    tier: 'institutional',
    score: 0.94,
    reason: 'governmental or major scientific institution',
  },
  {
    domains: [
      'nature.com', 'science.org', 'cell.com', 'pnas.org', 'nejm.org', 'thelancet.com',
      'jamanetwork.com', 'bmj.com', 'plos.org', 'frontiersin.org',
      'royalsocietypublishing.org', 'academic.oup.com', 'cambridge.org', 'springer.com',
      'sciencedirect.com', 'wiley.com', 'ieee.org', 'acm.org',
    ],
    tier: 'established',
    score: 0.9,
    reason: 'established scholarly publisher or professional society',
  },
  {
    domains: [
      'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'ft.com', 'wsj.com',
      'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'bloomberg.com',
      'economist.com', 'axios.com', 'propublica.org', 'theatlantic.com',
    ],
    tier: 'established',
    score: 0.88,
    reason: 'established editorial newsroom',
  },
  {
    domains: [
      'quantamagazine.org', 'scientificamerican.com', 'newscientist.com', 'statnews.com',
      'technologyreview.com', 'arstechnica.com', 'wired.com', 'theverge.com',
      'techcrunch.com',
    ],
    tier: 'established',
    score: 0.83,
    reason: 'established specialist publication',
  },
  {
    domains: [
      'openai.com', 'anthropic.com', 'deepmind.google', 'research.google', 'ai.google',
      'microsoft.com', 'research.microsoft.com', 'meta.com', 'ai.meta.com', 'apple.com',
      'nvidia.com', 'github.blog', 'aws.amazon.com', 'cloudflare.com', 'mozilla.org',
      'pytorch.org', 'tensorflow.org', 'kaggle.com', 'vercel.com', 'nextjs.org',
    ],
    tier: 'primary',
    score: 0.85,
    reason: 'first-party organization, project, or product source',
  },
  {
    domains: ['crunchyroll.com', 'netflix.com', 'adultswim.com'],
    tier: 'primary',
    score: 0.84,
    reason: 'first-party streaming network, slate, or release source',
  },
  {
    domains: [
      'animenewsnetwork.com', 'variety.com', 'deadline.com', 'hollywoodreporter.com',
      'vulture.com', 'avclub.com', 'indiewire.com', 'collider.com',
    ],
    tier: 'established',
    score: 0.78,
    reason: 'established film, television, anime, or entertainment publication',
  },
  {
    domains: [
      'premierleague.com', 'uefa.com', 'fifa.com', 'nfl.com', 'nba.com', 'patriots.com',
      'warriors.com', 'chelseafc.com', 'mancity.com', 'ifsc-climbing.org', 'uci.org',
      'olympics.com', 'crankworx.com', 'fis-ski.com', 'worldskate.org',
      'usskiandsnowboard.org',
    ],
    tier: 'primary',
    score: 0.88,
    reason: 'official league, team, federation, or governing-body source',
  },
  {
    domains: [
      'espn.com', 'theathletic.com', 'skysports.com', 'cbssports.com', 'nbcsports.com',
      'foxsports.com', 'sports.yahoo.com', 'goal.com', 'bleacherreport.com',
    ],
    tier: 'established',
    score: 0.82,
    reason: 'established sports newsroom',
  },
  {
    domains: [
      'pro-football-reference.com', 'basketball-reference.com', 'fbref.com', 'statsbomb.com',
      'pff.com', 'fantasypros.com', 'rotowire.com', 'establishtherun.com', '4for4.com',
    ],
    tier: 'established',
    score: 0.76,
    reason: 'established sports statistics or specialist analysis source',
  },
  {
    domains: ['nflverse.nflverse.com', 'nflfastr.com', 'rbsdm.com'],
    tier: 'platform',
    score: 0.78,
    reason: 'specialized sports data or open analytics project',
  },
  {
    domains: ['sleeper.com'],
    tier: 'platform',
    score: 0.68,
    reason: 'established fantasy-sports platform and community source',
  },
  {
    domains: [
      'pinkbike.com', 'cyclingnews.com', 'climbing.com', 'gripped.com', 'powder.com',
      'outsideonline.com', 'redbull.com',
    ],
    tier: 'established',
    score: 0.76,
    reason: 'established specialist active-sports publication',
  },
  {
    domains: [
      'store.steampowered.com', 'steampowered.com', 'pcgamer.com', 'rockpapershotgun.com',
      'ign.com', 'gamespot.com', 'eurogamer.net', 'polygon.com', 'nintendo.com',
      'playstation.com', 'xbox.com',
    ],
    tier: 'established',
    score: 0.8,
    reason: 'established game platform, publisher, or newsroom',
  },
  {
    domains: [
      'billboard.com', 'pitchfork.com', 'residentadvisor.net', 'beatport.com', 'bandcamp.com',
      'edm.com', 'dancingastronaut.com',
    ],
    tier: 'established',
    score: 0.78,
    reason: 'established music publication or catalog',
  },
  {
    domains: [
      'napari.org', 'plotly.com', 'observablehq.com', 'd3js.org', 'deck.gl', 'threejs.org',
      'neuroglancer-demo.appspot.com',
    ],
    tier: 'platform',
    score: 0.8,
    reason: 'first-party scientific visualization or developer-tool project',
  },
  {
    domains: ['github.com', 'huggingface.co', 'paperswithcode.com', 'semanticscholar.org'],
    tier: 'platform',
    score: 0.78,
    reason: 'direct project or research platform',
  },
  {
    domains: ['youtube.com', 'youtu.be', 'vimeo.com', 'soundcloud.com', 'spotify.com'],
    tier: 'platform',
    score: 0.57,
    reason: 'established media platform with creator-dependent credibility',
  },
  {
    domains: ['reddit.com', 'news.ycombinator.com', 'lobste.rs', 'threads.net', 'threads.com', 'x.com', 'twitter.com', 'tiktok.com'],
    tier: 'community',
    score: 0.5,
    reason: 'community or social discussion source',
  },
  {
    domains: ['medium.com', 'substack.com', 'wordpress.com', 'blogspot.com'],
    tier: 'community',
    score: 0.42,
    reason: 'author-dependent publishing platform',
  },
];

const DIRECT_KIND_FLOORS: Partial<Record<FrontierSourceKind, FrontierSourceTrust>> = {
  arxiv: { host: '', tier: 'primary', score: 0.9, reason: 'direct arXiv adapter' },
  biorxiv: { host: '', tier: 'primary', score: 0.86, reason: 'direct bioRxiv adapter' },
  medrxiv: { host: '', tier: 'primary', score: 0.84, reason: 'direct medRxiv adapter' },
  openreview: { host: '', tier: 'primary', score: 0.86, reason: 'direct OpenReview adapter' },
  openalex: { host: '', tier: 'established', score: 0.78, reason: 'OpenAlex scholarly metadata record' },
  paperswithcode: { host: '', tier: 'platform', score: 0.82, reason: 'Papers with Code research index' },
  huggingface: { host: '', tier: 'platform', score: 0.8, reason: 'Hugging Face research platform' },
  github: { host: '', tier: 'platform', score: 0.78, reason: 'direct GitHub repository adapter' },
  nasa: { host: '', tier: 'institutional', score: 0.95, reason: 'direct NASA adapter' },
  football_data: { host: '', tier: 'primary', score: 0.9, reason: 'structured football data provider' },
  sports_state: { host: '', tier: 'established', score: 0.86, reason: 'structured live sports state adapter' },
  steam: { host: '', tier: 'primary', score: 0.82, reason: 'first-party Steam news adapter' },
  youtube: { host: '', tier: 'platform', score: 0.57, reason: 'direct YouTube adapter' },
  vimeo: { host: '', tier: 'platform', score: 0.57, reason: 'direct Vimeo adapter' },
  reddit: { host: '', tier: 'community', score: 0.5, reason: 'direct Reddit community adapter' },
  lobsters: { host: '', tier: 'community', score: 0.52, reason: 'direct Lobsters community adapter' },
  social: { host: '', tier: 'community', score: 0.42, reason: 'direct social platform adapter' },
  local: { host: '', tier: 'platform', score: 0.72, reason: 'curated local FRONTIER source' },
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function hostFromValue(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '').replace(/^\[|\]$/g, '');
  } catch {
    const candidate = value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return /^[a-z0-9.-]+$/.test(candidate) ? candidate : '';
  }
}

function isPrivateOrLocalHost(host: string): boolean {
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;

  // Only interpret fc/fd/fe80 prefixes as private/link-local when this is
  // actually an IPv6 literal. Ordinary DNS names such as fda.gov must never be
  // mistaken for IPv6 merely because they begin with "fd".
  if (host.includes(':')) {
    if (host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
    // IPv4-mapped literals are not useful publisher identities and can disguise
    // private endpoints after URL canonicalization (for example ::ffff:7f00:1).
    if (host.startsWith('::ffff:')) return true;
    return false;
  }

  const octets = host.split('.').map((value) => Number(value));
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127);
}

function classifyHost(host: string): FrontierSourceTrust {
  if (!host || isPrivateOrLocalHost(host)) {
    return { host, tier: 'blocked', score: 0, reason: 'invalid, local, or private-network destination' };
  }

  if (OPAQUE_REDIRECT_DOMAINS.some((domain) => hostMatches(host, domain))) {
    return { host, tier: 'unknown', score: 0.16, reason: 'opaque redirect hides the final publisher' };
  }

  if (host.startsWith('xn--') || host.split('.').some((label) => label.startsWith('xn--'))) {
    return { host, tier: 'unknown', score: 0.2, reason: 'internationalized hostname requires explicit vetting' };
  }

  for (const rule of HOST_RULES) {
    if (rule.domains.some((domain) => hostMatches(host, domain))) {
      return { host, tier: rule.tier, score: rule.score, reason: rule.reason };
    }
  }

  if (host.endsWith('.gov')) {
    return { host, tier: 'institutional', score: 0.9, reason: 'government domain' };
  }
  if (host.endsWith('.edu') || host.endsWith('.ac.uk')) {
    return { host, tier: 'institutional', score: 0.82, reason: 'academic institution domain' };
  }

  return { host, tier: 'unknown', score: 0.34, reason: 'publisher is not yet in FRONTIER source registry' };
}

export function assessFrontierHost(value: string): FrontierSourceTrust {
  return classifyHost(hostFromValue(value));
}

function publisherHostForItem(item: FrontierItem): string {
  const linkHost = hostFromValue(item.url);
  const declaredHost = hostFromValue(item.source);
  const syndicated = item.sourceKind === 'rss'
    && SYNDICATION_HOSTS.some((domain) => hostMatches(linkHost, domain));

  // Syndication URLs are transport, not provenance. Only use the publisher host
  // when the adapter extracted it from source metadata; otherwise the item stays
  // unknown and will be rejected rather than granting the aggregator authority.
  if (syndicated && declaredHost && declaredHost !== linkHost) return declaredHost;
  return linkHost || declaredHost;
}

export function assessFrontierSource(item: FrontierItem): FrontierSourceTrust {
  const host = publisherHostForItem(item);
  const hostTrust = classifyHost(host);
  if (hostTrust.tier === 'blocked') return hostTrust;

  // Aggregators and discovery meshes must earn trust from the destination URL.
  // Their own reputation cannot be used as a credibility cloak for an unknown
  // article publisher.
  const kindFloor = DISCOVERY_DESTINATION_KINDS.has(item.sourceKind)
    ? undefined
    : DIRECT_KIND_FLOORS[item.sourceKind];
  let trust = kindFloor && kindFloor.score > hostTrust.score
    ? { ...kindFloor, host }
    : hostTrust;

  try {
    if (new URL(item.url).protocol === 'http:') {
      trust = {
        ...trust,
        score: clamp(trust.score - 0.06),
        reason: `${trust.reason}; non-HTTPS transport`,
      };
    }
  } catch {
    return { host, tier: 'blocked', score: 0, reason: 'malformed destination URL' };
  }

  return trust;
}

function minimumTrustScore(item: FrontierItem): number {
  if (item.lane === 'must_know') return 0.72;
  if (item.lane === 'world_pulse') return 0.68;

  const realm = FRONTIER_LANE_MAP[item.lane].realm;
  if (realm === 'learn') return 0.68;
  if (['premier_league', 'world_soccer', 'team_pulse', 'sports'].includes(item.lane)) return 0.44;
  if (['gaming', 'screen', 'music'].includes(item.lane)) return 0.4;
  return 0.3;
}

export function isFrontierSourceAdmitted(item: FrontierItem): boolean {
  const trust = assessFrontierSource(item);
  if (trust.tier === 'blocked') return false;

  // Never let a search/RSS/HN/GDELT discovery hop promote an unvetted publisher.
  // Known community platforms remain usable in the play lanes because the user
  // explicitly wants fan conversation, memes, clips, and firsthand discussion.
  if (DISCOVERY_DESTINATION_KINDS.has(item.sourceKind) && trust.tier === 'unknown') return false;

  if (item.lane === 'must_know' && ['community', 'unknown'].includes(trust.tier)) return false;
  return trust.score >= minimumTrustScore(item);
}

export function sourceTrustRankingPrior(item: FrontierItem): number {
  const trust = assessFrontierSource(item);
  const realmWeight = FRONTIER_LANE_MAP[item.lane].realm === 'learn' ? 0.18 : 0.1;
  return (trust.score - 0.5) * realmWeight;
}

export function vetFrontierItems(items: FrontierItem[]): FrontierItem[] {
  return items.flatMap((item) => {
    if (!isFrontierSourceAdmitted(item)) return [];
    const trust = assessFrontierSource(item);
    const learn = FRONTIER_LANE_MAP[item.lane].realm === 'learn';
    const centered = trust.score - 0.55;
    const quality = clamp(item.quality + centered * (learn ? 0.22 : 0.12));
    const baseScore = clamp(item.baseScore + centered * (learn ? 0.16 : 0.1));
    return [{ ...item, quality, baseScore }];
  });
}
