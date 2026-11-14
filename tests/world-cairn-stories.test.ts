import assert from "node:assert/strict";
import test from "node:test";
import {existsSync} from "node:fs";
import {REGIONS,MEMORY_POINTS} from "../lib/world/model";
import {CAIRN_STORIES,cairnStoryFor,REGION_CAIRN_PHOTOS} from "../lib/world/cairnStories";
import {getWorldContent} from "../lib/world/content";

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

test("Cairn photo collections use real archive images and keep the coast lightweight",()=>{
  const photos=getWorldContent().photos;
  const ids=new Set(photos.map(p=>p.id));
  assert.equal(photos.length,MEMORY_POINTS.length,
    "The world intentionally curates a subset of the full 49-photo archive");
  assert.ok(photos.length>6);
  for(const [region,collection] of Object.entries(REGION_CAIRN_PHOTOS)){
    assert.ok(REGIONS.some(r=>r.id===region),"unknown region "+region);
    assert.ok(collection!.length>0);
    assert.equal(new Set(collection).size,collection!.length);
    for(const id of collection!)assert.ok(ids.has(id),region+" references absent photo "+id);
  }
  assert.ok(photos.slice(0,6).length<photos.length,
    "Coast should initially show a curated glimpse, not all archive thumbnails");
});
