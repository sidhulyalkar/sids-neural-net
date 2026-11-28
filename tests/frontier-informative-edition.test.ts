import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierInformationValue, rerankFrontierForInformation } from '../lib/frontier/informativeEdition';
import { boundInterestScore, interestScoreLabel, nextWheelInterestScore } from '../lib/frontier/wheelRating';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id, title:'Research', summary:'A brief note.', url:'https://example.org/'+id,
    source:'Test', sourceLabel:'Example source', sourceKind:'rss',
    publishedAt:'2026-11-17T12:00:00.000Z', lane:'ai_frontier', tags:[],
    baseScore:.5, importance:.5, novelty:.5, quality:.5, momentum:.5,
    ...overrides,
  };
}

test('interest wheel is bounded and semantically stable', () => {
  assert.equal(boundInterestScore(0), 1);
  assert.equal(boundInterestScore(11), 10);
  assert.equal(nextWheelInterestScore(4,-120),5);
  assert.equal(nextWheelInterestScore(4,120),3);
  assert.equal(nextWheelInterestScore(1,120),1);
  assert.equal(nextWheelInterestScore(10,-120),10);
  assert.equal(nextWheelInterestScore(5,0),5);
  assert.equal(interestScoreLabel(1),'Not for me');
  assert.equal(interestScoreLabel(10),'A favorite');
});

test('substantive measurements and primary artifacts count as information, vanity metrics do not', () => {
  const input=item('source',{metrics:[{label:'stars',value:'1240'},{label:'views',value:'20000'}]});
  assert(!frontierInformationValue(input).reasons.includes('Reported numbers'));
  const grounded=item('grounded',{
    sourceKind:'arxiv',
    summary:'The authors measured the effect of training on a large sample and reported results under multiple settings. They describe limitations and a comparison condition.',
    metrics:[{label:'Accuracy on held-out evaluation',value:'84%'}],
    artifacts:[{kind:'repository',label:'Implementation',url:'https://github.com/example/real'}],
    importance:.9,quality:.9,
  });
  const value=frontierInformationValue(grounded);
  assert(value.reasons.includes('Reported numbers'));
  assert(value.reasons.includes('Primary references'));
  assert(value.value > frontierInformationValue(input).value);
});

test('long boilerplate has a capped context contribution, never unbounded ranking advantage', () => {
  const normal=item('normal',{summary:'A detailed, well-sourced account of one experiment. '.repeat(10)});
  const filler=item('filler',{summary:'A detailed, well-sourced account of one experiment. '.repeat(300)});
  assert.equal(frontierInformationValue(normal).value,frontierInformationValue(filler).value);
});

test('the information pass only reorders near neighbors and never drops stories', () => {
  const low=item('low',{importance:0,quality:0,novelty:0,summary:''});
  const strong=item('strong',{importance:1,quality:1,novelty:1,sourceKind:'arxiv',
    summary:'Evidence from a controlled evaluation. '.repeat(8),
    metrics:[{label:'Valid results',value:'92%'}],
    artifacts:[{kind:'benchmark',label:'Evaluation suite'}]});
  const input=[low,strong,item('more'),item('other'),item('fifth'),item('sixth'),item('seventh')];
  const ranked=rerankFrontierForInformation(input);
  assert.equal(ranked.length,input.length);
  assert.equal(new Set(ranked.map(x=>x.id)).size,input.length);
  assert(ranked.indexOf(strong)<ranked.indexOf(low));
  assert(ranked.indexOf(strong)<=4,'information rerank cannot leap across unrelated slate segments');
});
