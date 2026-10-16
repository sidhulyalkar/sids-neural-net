import assert from 'node:assert/strict';
import test from 'node:test';
import { FRONTIER_SPORTS_LEAGUES } from '../lib/frontier/sportsStateSources';
import {
  espnCdnSportsUrl,
  parseEspnCdnScoreboardEnvelope,
} from '../lib/frontier/sportsStateCdnRequest';

test('ESPN CDN scoreboard envelopes recover canonical event arrays', () => {
  const fixture = {
    content: {
      sbData: {
        events: [{
          id: 'favorite-game',
          competitions: [{
            id: 'favorite-comp',
            competitors: [],
            status: { type: { state: 'pre' } },
          }],
        }],
      },
    },
  };

  const parsed = parseEspnCdnScoreboardEnvelope(fixture);
  assert.equal(parsed?.events?.length, 1);
  assert.equal(parsed?.events?.[0]?.id, 'favorite-game');
});

test('ESPN CDN envelope walker ignores unrelated arrays', () => {
  const parsed = parseEspnCdnScoreboardEnvelope({
    content: {
      navigation: [{ id: 'nav-only' }],
      cards: [{ title: 'not an event' }],
    },
  });
  assert.equal(parsed, undefined);
});

test('Premier League CDN URLs preserve the league discriminator', () => {
  const premierLeague = FRONTIER_SPORTS_LEAGUES.find((league) => league.id === 'premier-league');
  assert.ok(premierLeague);
  const url = new URL(espnCdnSportsUrl(premierLeague, 'schedule'));
  assert.equal(url.hostname, 'cdn.espn.com');
  assert.equal(url.pathname, '/core/soccer/schedule');
  assert.equal(url.searchParams.get('xhr'), '1');
  assert.equal(url.searchParams.get('league'), 'eng.1');
});
