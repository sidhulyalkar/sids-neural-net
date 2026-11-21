import assert from 'node:assert/strict';
import test from 'node:test';
import { lightningTipTouchesBubble } from '../lib/frontier/lightningImpact';

const bubble={left:100,top:100,width:34,height:34};
test('the lightning tip, rather than the rectangular button, defines collision',()=>{
  assert(lightningTipTouchesBubble({x:117,y:117},bubble));
  assert(lightningTipTouchesBubble({x:117,y:100},bubble));
  assert(!lightningTipTouchesBubble({x:99,y:117},bubble));
  assert(!lightningTipTouchesBubble({x:135,y:117},bubble));
  assert(!lightningTipTouchesBubble({x:100,y:100},bubble),
    'Rectangular corner is visually outside the bubble');
  assert(!lightningTipTouchesBubble({x:121,y:121},{left:50,top:50,width:34,height:34}),
    'A 58px near miss must never be magnetically converted into a hit');
});
test('offscreen, invalid, empty and non-finite glyphs cannot register hits',()=>{
  assert(!lightningTipTouchesBubble({x:117,y:117},{...bubble,width:0}));
  assert(!lightningTipTouchesBubble({x:117,y:117},{...bubble,height:-1}));
  assert(!lightningTipTouchesBubble({x:NaN,y:117},bubble));
  assert(!lightningTipTouchesBubble({x:117,y:Infinity},bubble));
});
