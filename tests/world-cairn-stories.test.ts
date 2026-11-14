import assert from "node:assert/strict";
import test from "node:test";
import {existsSync} from "node:fs";
import {REGIONS} from "../lib/world/model";
import {CAIRN_STORIES,cairnStoryFor} from "../lib/world/cairnStories";

test("every existing island region has a distinct, evidence-linked field story",()=>{
  assert.deepEqual(Object.keys(CAIRN_STORIES).sort(),REGIONS.map(r=>r.id).sort());
  const titles=new Set<string>();
  for(const region of REGIONS){
    const story=cairnStoryFor(region.id);
    assert.equal(story.id,region.id);
    assert.ok(story.title.length>=20 && story.lead.length>=45 && story.perspective.length>=80,region.id);
    assert.ok(story.links.length>=2,region.id);
    assert.ok(!titles.has(story.title),region.id);
    titles.add(story.title);
    for(const link of story.links){
      assert.ok(link.href.startsWith("/")&&!link.href.startsWith("//"),region.id);
      assert.ok(link.label.length>8);
      if(link.href.startsWith("/case-studies/")){
        const slug=link.href.split("/")[2];
        assert.ok(existsSync(new URL("../content/case-studies/"+slug+".mdx",import.meta.url)),link.href);
      }
    }
  }
});

test("Cairn stories retain distinct scientific, recreational and ecological destinations",()=>{
  assert.ok(CAIRN_STORIES.grove.links.some(l=>l.href.includes("neatlabs")));
  assert.ok(CAIRN_STORIES.mountain.links.some(l=>l.href.includes("sabatini")));
  assert.ok(CAIRN_STORIES.neural.links.some(l=>l.href.includes("neuros")));
  assert.ok(CAIRN_STORIES.rainforest.links.some(l=>l.href.includes("photo-016")));
  assert.ok(CAIRN_STORIES.cavern.links.some(l=>l.href==="/arcade"));
  assert.ok(CAIRN_STORIES.waterfall.links.some(l=>l.href==="/publications"));
});
