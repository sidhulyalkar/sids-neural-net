import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFrontierEditionCandidates,
  featureFrontierEditionStory,
  frontierEditionChannel,
} from '../lib/frontier/editionCandidates';
import { frontierReadableText } from '../lib/frontier/readableText';
import type { FrontierItem } from '../lib/frontier/types';

function fixture(id: string, lane: FrontierItem['lane'] = 'sports',
  sourceKind: FrontierItem['sourceKind'] = 'rss', summary = 'An article with some details.',
): FrontierItem {
  return {
    id, title:id, summary, url:'https://example.org/items/'+id,
    source:'fixture', sourceLabel:'Fixture',
    sourceKind, publishedAt:'2026-11-17T10:00:00Z', lane,
    tags:[], baseScore:.8, quality:.7, importance:.7, novelty:.7, momentum:.5,
  };
}
const detailed = 'The paper evaluates real candidate systems under multiple conditions. It reports results, methods, limitations and an interpretable comparison to establish an experimental contribution. '.repeat(4);

test('cold selection does not truncate away research papers after 36 earlier source records',()=>{
  const early = Array.from({length:45},(_,i)=>fixture('early-'+i, i%2?'sports':'wildcards', 'rss'));
  const papers = Array.from({length:12},(_,i)=>fixture('paper-'+i,'ai_frontier','arxiv',detailed));
  const builders = Array.from({length:10},(_,i)=>fixture('build-'+i,'builder_signal','github',detailed));
  const culture = Array.from({length:8},(_,i)=>fixture('culture-'+i,'gaming','steam',detailed));
  const selected=buildFrontierEditionCandidates([...early,...papers,...builders,...culture],36);
  assert.equal(selected.length,36,'cold transport budget remains bounded at 36');
  assert.equal(new Set(selected.map(x=>x.id)).size,36,'no duplicate selected sources');
  assert(selected.some(x=>x.id.startsWith('paper-')),'late papers remain visible');
  assert(selected.some(x=>x.id.startsWith('build-')),'late research tooling remains visible');
  assert(selected.some(x=>x.id.startsWith('culture-')),'culture remains discoverable');
  assert(selected.some(x=>x.id.startsWith('early-')),'sports and general interest remain available');
});

test('curation gracefully fills missing channels without duplicates',()=>{
  const inputs=Array.from({length:22},(_,i)=>fixture('limited-'+i,'ai_frontier','github',
    i%2?detailed:''));
  const selected=buildFrontierEditionCandidates(inputs,36);
  assert.equal(selected.length,22);
  assert.equal(buildFrontierEditionCandidates(inputs,0).length,0);
});

test('cold curation preserves the high information candidate ahead of generic promotion',()=>{
  const promo=fixture('newsletter','internet_culture','rss','Sign up for our newsletter today');
  promo.title='Sign up for the Daily Newsletter';
  const informative=fixture('primary-study','neuro_frontier','arxiv',detailed);
  assert(frontierEditionChannel(informative)==='papers');
  assert(frontierEditionChannel(promo)==='culture');
  const result=featureFrontierEditionStory([fixture('scoreboard','sports','sports_state','2 finals'),promo,informative]);
  assert.equal(result[0].id,informative.id,'a verified, substantive paper is the publication lead');
  assert.equal(result[1].id,'scoreboard','sports utility stays accessible rather than disappearing');
});

test('HTML numeric and named entities display correctly, without interpreting markup',()=>{
  assert.equal(frontierReadableText('can&#8217;t &amp; won&#39;t'),"can’t & won't");
  assert.equal(frontierReadableText('Study &ldquo;Interesting&rdquo; &raquo; more'), 'Study “Interesting” » more');
  assert.equal(frontierReadableText('research &lt;script&gt;'), 'research <script>');
  assert.equal(frontierReadableText('Music &#x2014; science'), 'Music — science');
});
