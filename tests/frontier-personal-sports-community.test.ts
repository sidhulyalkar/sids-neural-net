import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRedditListing } from '../lib/frontier/personalSources';
import { assessFrontierSource, isFrontierSourceAdmitted } from '../lib/frontier/sourceTrust';

function listing(subreddit: string, title: string) {
  return {
    data: {
      children: [{
        data: {
          id: `${subreddit}-1`,
          title,
          selftext: 'Community discussion and analysis.',
          permalink: `/r/${subreddit}/comments/example/thread/`,
          subreddit,
          created_utc: 1_777_000_000,
          score: 450,
          num_comments: 90,
          stickied: false,
          over_18: false,
        },
      }],
    },
  };
}

test('NFL community posts stay in the sports lane and retain community trust', () => {
  const [item] = parseRedditListing(listing('nfl', 'EPA and CPOE takeaways from this week'), 'nfl');
  assert.ok(item);
  assert.equal(item.lane, 'sports');
  assert.equal(assessFrontierSource(item).tier, 'community');
  assert.equal(isFrontierSourceAdmitted(item), true);
});

test('fantasy-football discussion is eligible for sports discovery but never promoted to primary provenance', () => {
  const [item] = parseRedditListing(
    listing('fantasyfootball', 'Superflex ADP, target share and route participation discussion'),
    'fantasyfootball'
  );
  assert.ok(item);
  assert.equal(item.lane, 'sports');
  assert.ok(item.tags.includes('fantasyfootball'));
  assert.equal(assessFrontierSource(item).tier, 'community');
  assert.equal(isFrontierSourceAdmitted(item), true);
});
