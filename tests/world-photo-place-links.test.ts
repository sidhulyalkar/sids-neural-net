import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {photoMapUrl,photoPlaces} from "../src/data/photoPlaces";
import {visualArchive} from "../src/data/visualArchive";

test("each of the original 49 photos has one short map-linked location",()=>{
  assert.equal(visualArchive.length,49);
  const ids=visualArchive.map(photo=>photo.id);
  assert.equal(new Set(ids).size,49);
  assert.deepEqual(Object.keys(photoPlaces).sort(),[...ids].sort());
  for(const photo of visualArchive){
    assert.equal(photo.location,photo.place.label,photo.id);
    assert.ok(photo.location.length>=4 && photo.location.length<=42,photo.id);
    assert.deepEqual(Object.keys(photo.place).sort(),["label","mapSearch"],photo.id);
    assert.doesNotMatch(photo.location,/\b(likely|possibly|unconfirmed|approximate)\b/i,photo.id);
    const map=new URL(photoMapUrl(photo.place));
    assert.equal(map.origin,"https://www.google.com");
    assert.equal(map.pathname,"/maps/search/");
    assert.equal(map.searchParams.get("api"),"1");
    assert.equal(map.searchParams.get("query"),photo.place.mapSearch);
    assert.ok(!("date" in photo),photo.id+" should not show unverified dates");
    assert.ok(!("coordinates" in photo.place),photo.id+" should not invent GPS");
  }
});

test("confirmed French Polynesia locations are photo 029 Moʻorea and 030–032 Bora Bora",()=>{
  const photo=(id:number)=>visualArchive[id-1];
  assert.equal(photo(29).location,"Moʻorea, French Polynesia");
  assert.equal(photo(29).place.mapSearch,"Moorea, French Polynesia");
  for(const id of [30,31,32]){
    assert.equal(photo(id).location,"Bora Bora, French Polynesia");
    assert.equal(photo(id).place.mapSearch,"Bora Bora, French Polynesia");
    assert.match(photo(id).alt,/Bora Bora/);
  }
  for(const id of [10,11]) assert.match(photo(id).location,/Estes Park/);
  assert.match(photo(12).location,/Rocky Mountain National Park/);
  for(const id of [14,15]) assert.match(photo(id).location,/California/);
  assert.match(photo(28).location,/Kualoa/);
  for(let id=33;id<=42;id++) assert.match(photo(id).place.mapSearch,/California/,String(id));
  assert.match(photo(3).location,/Death Valley/);
});

test("corrected photo descriptions identify the actual subject",()=>{
  assert.match(visualArchive[15].alt,/Sloth/i);
  assert.match(visualArchive[25].alt,/cat/i);
  assert.match(visualArchive[32].alt,/Shasta/i);
  assert.match(visualArchive[34].alt,/coastal/i);
  assert.match(visualArchive[39].alt,/spillway/i);
});

test("gallery and world use the same simple photo map links without metadata badges",()=>{
  const gallery=readFileSync(new URL("../components/visual-archive/VisualArchiveGallery.tsx",import.meta.url),"utf8");
  const world=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
  const content=readFileSync(new URL("../lib/world/content.ts",import.meta.url),"utf8");
  assert.match(gallery,/photoMapUrl\(entry.place\)/);
  assert.match(gallery,/photoMapUrl\(activeEntry.place\)/);
  assert.match(gallery,/rel="noopener noreferrer"/);
  assert.doesNotMatch(gallery,/Approximate location|awaiting confirmation|entry.place.verification/);
  assert.match(world,/href=\{photo.mapUrl\}/);
  assert.doesNotMatch(world,/locationApproximate| · approximate/);
  assert.match(content,/mapUrl: photoMapUrl\(p.place\)/);
});
