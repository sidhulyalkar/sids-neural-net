import type { FrontierItem } from './types';

/**
 * Public-source text hygiene. We remove sponsor/affiliate/channel boilerplate,
 * not the article's factual claims. This is deliberately deterministic:
 * unverified generated summaries never enter the trusted archive.
 */
const PROMO_START = /\b(?:use (?:our|my) (?:code|link)|sponsor(?:ed by|:)|paid partnership|become a member|join (?:the|this|our) channel|support (?:us|at|on) patreon|podcast:\s*https?:|(?:get|save) \d{1,2}% off|shop (?:our|the) merch|merchandise:|affiliate link|limited time offer|sign up for|subscribe (?:to|for)|stats courtesy:|footage in this video is owned|music by [^\n]{2,20}\(|twitter:\s*@|website:\s*https?:|book:\s*https?:)/i;
const STORY_START = /\b(?:this (?:detailed |latest |new )?(?:video|episode|breakdown|film breakdown|analysis|scouting report|report|study)|in this (?:video|episode|breakdown|analysis)|we (?:analy[sz]e|examine|explore|break down|investigate|compare|discuss)|today we (?:look|analy[sz]e|explore|discuss)|the (?:study|research|report|analysis|team|researchers|authors|film breakdown) (?:finds?|explores?|shows?|suggests?|examines?|compares?|investigates?|reports?|uses?))/i;
const CREDIT_START = /\b(?:podcast:|patreon:|support at patreon|support us on|stats courtesy:|footage in this video|music by |follow us|our socials|website:\s*https?:|twitter:\s*@|book:\s*https?:|links? in (?:the )?(?:description|bio)|find additional .{1,75} content|become a member|join this channel)\b/i;
const URL = /https?:\/\/[^\s]+/gi;

function normalized(text: string): string {
  return (text ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanFrontierEditorialText(text: string, sourceKind = ''): string {
  let value = normalized(text);
  if (!value) return '';
  const video = sourceKind === 'youtube' || sourceKind === 'vimeo';
  // RSS/Atom can deliver multiple lines merged into one enormous paragraph.
  // Look for the substantive transition, not only sentence punctuation.
  if (video && PROMO_START.test(value)) {
    const promo = value.search(PROMO_START);
    const realStart = value.slice(promo).search(STORY_START);
    if (promo >= 0 && realStart >= 0) {
      value = value.slice(promo + realStart);
    } else if (promo >= 0) {
      // Keep any leading substantive introduction, but do not publish
      // the advertising block as article content.
      value = value.slice(0, promo);
    }
  }
  if (video) {
    const credit = value.search(CREDIT_START);
    if (credit >= 0) value = value.slice(0, credit);
    const promo = value.search(PROMO_START);
    if (promo >= 0) value = value.slice(0, promo);
  }
  if (video) value = value.replace(URL, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  // No made-up editorial recap when the upstream description contained only
  // a membership URL or sponsorship message.
  return value.replace(/^[\s:;.,\-]+|[\s:;,\-]+$/g, '').trim();
}

export function isFrontierEditoriallyUsable(item: FrontierItem): boolean {
  // Preserve structured utility records and scholarly/catalog results even
  // when they have a deliberately compact factual description.
  if (item.sportsState || item.sourceKind === 'sports_state') return true;
  if (item.sourceKind === 'youtube' || item.sourceKind === 'vimeo') {
    const summary = cleanFrontierEditorialText(item.summary, item.sourceKind);
    return summary.length >= 55 && /[a-z]{4}/i.test(summary) && summary.split(/\s+/).length >= 9;
  }
  // Extremely short advertisement-only RSS/blog entries are not reporting.
  if (['rss', 'brave_web', 'gdelt'].includes(item.sourceKind)) {
    const sourceText = normalized(item.summary);
    return sourceText.length >= 24 && !(
      sourceText.length < 200 && PROMO_START.test(sourceText) && !STORY_START.test(sourceText)
    );
  }
  return true;
}

export function cleanFrontierItem(item: FrontierItem): FrontierItem {
  const summary = cleanFrontierEditorialText(item.summary, item.sourceKind);
  return summary === item.summary ? item : { ...item, summary };
}
