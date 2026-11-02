import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import graphData from "../data/generated/neural-graph.json";
import {visualArchive} from "../src/data/visualArchive";
import {
  galleryWorldHref,parseGalleryDestination,photoArchiveHref,parsePhotoArchiveId,
} from "../lib/world/galleryLinks";

test("deep links are canonical and reject unrelated query data",()=>{
  assert.equal(galleryWorldHref("photos"),"/?gallery=photos");
  assert.equal(galleryWorldHref("papers"),"/?gallery=papers");
  assert.equal(parseGalleryDestination("?gallery=photos"),"photos");
  assert.equal(parseGalleryDestination("?gallery=papers"),"papers");
  assert.equal(parseGalleryDestination("?gallery=unknown"),null);
  assert.equal(parseGalleryDestination("?name=photos"),null);
  const ids=visualArchive.map(p=>p.id);
  assert.equal(photoArchiveHref(ids[0]),"/photography?photo=photo-001");
  assert.equal(photoArchiveHref("../logout"),"/photography");
  assert.equal(parsePhotoArchiveId("?photo=photo-049",ids),"photo-049");
  assert.equal(parsePhotoArchiveId("?photo=photo-999",ids),null);
  assert.equal(parsePhotoArchiveId("?photo=../../",ids),null);
});

test("photo wall retains native high resolution near the visitor, never draws IDs",()=>{
  const source=readFileSync(new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
  assert.match(source,/image\.src=entry\.src/);
  assert.match(source,/new THREE\.Texture\(image\)/);
  assert.match(source,/LinearMipmapLinearFilter/);
  assert.match(source,/selectedHighRes\.has\(i\)/);
  assert.match(source,/hdResources\.size/);
  assert.match(source,/frustumCulled=false/);
  assert.match(source,/ornateFrameMaterial/);
  assert.doesNotMatch(source,/fillText\(slots\[i\]\.id/);
  assert.match(source,/exterior\.visible = false/);
  assert.match(source,/interior\.visible = false/);
});

test("the website and three-dimensional galleries share bidirectional navigation",()=>{
  const photoPage=readFileSync(new URL("../app/photography/page.tsx",import.meta.url),"utf8");
  const papersPage=readFileSync(new URL("../app/publications/page.tsx",import.meta.url),"utf8");
  const photoView=readFileSync(new URL("../components/visual-archive/VisualArchiveGallery.tsx",import.meta.url),"utf8");
  const world=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
  const renderer=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  assert.match(photoPage,/galleryWorldHref\("photos"\)/);
  assert.match(papersPage,/galleryWorldHref\("papers"\)/);
  assert.match(photoView,/parsePhotoArchiveId/);
  assert.match(world,/parseGalleryDestination/);
  assert.match(world,/photoArchiveHref\(photoId\)/);
  assert.match(world,/galleryDestination:target/);
  assert.match(renderer,/galleryPhase="inside";caveLayer="surface"/);
  assert.match(renderer,/galleryStart==="papers"/);
  assert.match(renderer,/galleryStepWalk\(\{\.\.\.travel,point:player\}/);
  assert.match(renderer,/rawDelta,destination/);
  assert.match(renderer,/const swimming = aquatic !== "land" && galleryPhase!=="inside"/);
  assert.match(renderer,/playerY=SHRINE_GALLERY\.floorY\+\.04/);
  assert.match(renderer,/camera\.position\.set\(player\.x\+2\.45,playerY\+1\.65,player\.z\)/);
  assert.match(renderer,/lastGalleryCameraPhase="outside"/);
  assert.match(renderer,/explorer\.visible=!jetChoosing&&!cameraInsideAvatar&&galleryPhase!=="inside"/);
  assert.match(renderer,/galleryFocusIndex/);
  assert.match(renderer,/galleryPhotoViewpoint\(gallerySlots\[galleryFocusIndex\]\)/);
  assert.match(renderer,/galleryPhase==="inside"\?"eye-level":"third-person"/);
  assert.match(renderer,/galleryFocusIndex=null;e\.preventDefault\(\);return/);
});

test("waterfall research museum has a source-backed panel for every real paper",()=>{
  const actual=graphData.nodes.filter(n=>n.type==="publication");
  assert.equal(actual.length,8);
  const paperGallery=readFileSync(new URL("../components/world/worldPaperGallery.ts",import.meta.url),"utf8");
  const publicationsPage=readFileSync(new URL("../components/publications/PublicationFocusArchive.tsx",import.meta.url),"utf8");
  assert.match(paperGallery,/papers\.slice\(0,8\)/);
  assert.match(paperGallery,/paper\.title/);
  assert.match(paperGallery,/gallery-paper:/);
  assert.match(publicationsPage,/id=\{publication\.id\}/);
});
