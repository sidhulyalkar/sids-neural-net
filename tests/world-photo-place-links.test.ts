import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {photoMapUrl,photoPlaces} from "../src/data/photoPlaces";
import {visualArchive} from "../src/data/visualArchive";

test("every archived photograph has a stable, map-ready and safely encoded location", () => {
  assert.equal(visualArchive.length,49);
  const ids=visualArchive.map(image=>image.id);
  assert.equal(new Set(ids).size,49);
  assert.deepEqual(Object.keys(photoPlaces).sort(),[...ids].sort());
  for(const photo of visualArchive) {
    assert.equal(photo.location,photo.place.label,photo.id);
    assert.ok(photo.location.length>5,photo.id);
    assert.ok(photo.place.mapSearch.length>4,photo.id);
    assert.ok(["US","CA","CR","PF"].includes(photo.place.countryCode),photo.id);
    assert.ok(["landmark","area","region"].includes(photo.place.precision),photo.id);
    const map=new URL(photoMapUrl(photo.place));
    assert.equal(map.origin,"https://www.google.com");
    assert.equal(map.pathname,"/maps/search/");
    assert.equal(map.searchParams.get("api"),"1");
    assert.equal(map.searchParams.get("query"),photo.place.mapSearch);
    assert.ok(!("date" in photo),photo.id+" should have no speculative capture date");
    assert.ok(!("coordinates" in photo.place),photo.id+" should not invent precise lat/lng");
  }
});

test("Sid's corrected trip geography takes priority over visual guesses",()=>{
  const place=(id:number)=>visualArchive[id-1].place;
  for(const id of [29,30,31,32]){
    assert.equal(place(id).countryCode,"PF");
    assert.equal(place(id).verification,"user");
    assert.match(place(id).label,/Moʻorea/);
  }
  for(const id of [10,11]){
    assert.match(place(id).label,/Estes Park/);
    assert.equal(place(id).verification,"user");
  }
  assert.match(place(12).label,/Rocky Mountain National Park/);
  for(const id of [14,15]){
    assert.match(place(id).label,/California/);
    assert.equal(place(id).verification,"user");
  }
  assert.match(place(28).label,/Kualoa Regional Park/);
  assert.equal(place(28).verification,"user");
  for(let id=33;id<=42;id++) {
    assert.equal(place(id).region,"California",`photo-${id}`);
    assert.equal(place(id).countryCode,"US");
  }
  assert.equal(place(3).verification,"approximate", "Unresolved '3 from Bora Bora' must not create a false verified location");
});

test("sloth, cat, and Shasta originals have matching accessible descriptions",()=>{
  assert.match(visualArchive[15].alt,/Sloth/i);
  assert.match(visualArchive[25].alt,/cat/i);
  assert.match(visualArchive[32].alt,/Shasta/i);
  assert.match(visualArchive[34].alt,/coastal/i);
  assert.match(visualArchive[39].alt,/spillway/i);
});

test("both gallery and in-world photographs expose map links",()=>{
  const gallery=readFileSync(new URL("../components/visual-archive/VisualArchiveGallery.tsx",import.meta.url),"utf8");
  const world=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
  const content=readFileSync(new URL("../lib/world/content.ts",import.meta.url),"utf8");
  assert.match(gallery,/photoMapUrl\(entry.place\)/);
  assert.match(gallery,/photoMapUrl\(activeEntry.place\)/);
  assert.match(gallery,/rel="noopener noreferrer"/);
  assert.match(world,/href=\{photo.mapUrl\}/);
  assert.match(content,/mapUrl: photoMapUrl\(p.place\)/);
});
