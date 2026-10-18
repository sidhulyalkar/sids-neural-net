import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ARCADE_CAVE,arcadeCaveFloorHeight,caveHalfWidth} from "../lib/world/model";
import {ARCADE_CAVERN_MURALS,validateArcadeArtManifest} from "../lib/world/arcadeCavernArtManifest";
import {ARCADE_REAR_CAP_Z,caveArtRing,sampleCavernArt,validateCavernMural} from "../lib/world/arcadeCavernSurface";
import {ARCADE_MURAL_ART_ASSETS,validateArcadeMuralAssets}
 from "../lib/world/arcadeCavernAssetManifest";
import {SHASTA_PHOTOS,NATURE_PHOTOS,CAVERN_GAME_ART,CAVERN_GAME_PANEL_ART,CAVERN_PHOTO_ALBUMS,validateCavernPhotoAlbums,archivePhotoPath}
 from "../lib/world/arcadeCavernGalleryContent";

test("Photo-first arcade is nature, Shasta and game-only, preserving real sports crests",()=>{
 assert.deepEqual(validateArcadeArtManifest(ARCADE_CAVERN_MURALS),[]);
 assert.equal(ARCADE_CAVERN_MURALS.length,7);
 const ids=ARCADE_CAVERN_MURALS.map(m=>m.id);
 assert.deepEqual(ids,[
  "shasta-photo-gallery","wild-places-scenic-wall","my-games-gallery",
  "wild-places-rear","home-stand","panorama-photo-gallery","shasta-rear-portrait",
 ]);
 assert.ok(!ARCADE_CAVERN_MURALS.some(m=>
  ["anime","comedy","sport-anime","neural"].includes(m.theme)));
 const left=ARCADE_CAVERN_MURALS.filter(m=>m.surface==="left");
 assert.deepEqual(left.map(m=>m.id),["shasta-photo-gallery"]);
 const games=ARCADE_CAVERN_MURALS.find(m=>m.theme==="game-gallery")!;
 assert.equal(games.surface,"right");
 assert.deepEqual(games.tags,["UNICORN STAMPEDE","UNIRICO","STRETCHICORN"]);
 assert.equal(ARCADE_CAVERN_MURALS.find(m=>m.theme==="sports")!.surface,"right");
 assert.deepEqual(validateCavernPhotoAlbums(),[]);
 assert.equal(CAVERN_PHOTO_ALBUMS.shasta.images.length,13);
 assert.equal(CAVERN_PHOTO_ALBUMS.nature.images.length,12);
 assert.equal(CAVERN_PHOTO_ALBUMS.feature.images.length,3);
 assert.equal(SHASTA_PHOTOS.length,13);
 assert.equal(NATURE_PHOTOS.length,12);
 assert.equal(CAVERN_GAME_ART.length,3);
 assert.deepEqual(CAVERN_GAME_PANEL_ART.map(g=>g.id),[
  "stretchicorn","unirico","unicorn-stampede",
 ]);
 assert.equal(new Set(SHASTA_PHOTOS).size,13);
 assert.equal(new Set(NATURE_PHOTOS).size,12);
 for(const id of [...SHASTA_PHOTOS,...NATURE_PHOTOS])
  assert.match(archivePhotoPath(id),/^\/visual-archive\/thumbs\/photo-\d{3}-thumb\.webp$/);
 for(const poster of CAVERN_GAME_ART)
  assert.match(poster.src,/^\/world\/arcade-cavern\/games\/[-a-z0-9]+\.(?:svg|png)$/);
 assert.ok(ARCADE_CAVERN_MURALS.every(m=>!validateCavernMural(m)));
});
test("Rear photo panorama fits its real-world aspect and game panels stay clear",()=>{
 const banner=ARCADE_CAVERN_MURALS.find(m=>m.id==="panorama-photo-gallery")!;
 assert.equal(banner.surface,"back");
 assert.ok(banner.u0!==undefined&&banner.u1!==undefined);
 const width=(banner.u1!-banner.u0!)*12.45;
 const height=(banner.v1-banner.v0)*5.45;
 assert.ok(Math.abs(width/height-2400/480)<.16,
  "panorama image aspect must not stretch across the rock");
 assert.ok(width<8&&height>1.25,
  "panoramic photo mural must fit within the protected rear panel");
 for(const id of ["shasta-rear-portrait","wild-places-rear"]){
  const m=ARCADE_CAVERN_MURALS.find(x=>x.id===id)!;
  assert.ok(m.u0!==undefined&&m.u1!==undefined);
  const edge=id==="shasta-rear-portrait"?m.u1!:m.u0!;
  const x=16+(edge-.5)*12.45;
  assert.ok(id==="shasta-rear-portrait"?x<13.65:x>18.35,
   "portrait edge must clear center arcade game by more than half a meter");
 }
});
test("Curved graffiti is projected into interior of exact 17-shell ring segments",()=>{
 for(let index=0;index<=16;index++){
  const ring=caveArtRing(index);
  assert.equal(ring.length,7);
  for(const p of ring)assert.ok([p.x,p.y,p.z].every(Number.isFinite));
  const w=caveHalfWidth(ring[0].z);
  assert.ok(Math.abs(ring[0].x-(16-w))<.00001);
  assert.ok(Math.abs(ring[6].x-(16+w))<.00001);
 }
 for(const mural of ARCADE_CAVERN_MURALS){
  for(let i=0;i<=10;i++){
   const t=i/10,z=mural.z0+(mural.z1-mural.z0)*t;
   for(let j=0;j<=8;j++){
    const v=mural.v0+(mural.v1-mural.v0)*j/8;
    const u=mural.surface==="back"&&mural.u0!==undefined&&mural.u1!==undefined
     ?mural.u0+(mural.u1-mural.u0)*t:t;
    const p=sampleCavernArt(mural.surface,z,u,v,.056);
    assert.ok(p, "missing "+mural.id+" "+i+" "+j);
    const a=p!.position,n=p!.normal;
    assert.ok([a.x,a.y,a.z,n.x,n.y,n.z].every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(n.x,n.y,n.z)-1)<.00001);
    if(mural.surface==="left")assert.ok(n.x>.20);
    if(mural.surface==="right")assert.ok(n.x<-.20);
    if(mural.surface==="back"){
     if(mural.v0<.6)
      assert.ok(a.x<=13.64||a.x>=18.36,
       "rear lower murals must remain at least 0.55m away from the center game panel");
     else assert.ok(a.y>
       arcadeCaveFloorHeight(ARCADE_CAVE.wall)+2.35+2.65/2+.20,
       "rear photo panorama must clear the game selector by 20cm");
    }
   }
  }
 }
});

test("physical cave cap must never obscure back-wall art or rock lining",()=>{
 const stone=sampleCavernArt("back",-63.32,.5,.75,.019)!;
 const paint=sampleCavernArt("back",-63.32,.5,.75,.056)!;
 // From inside the cave, the camera is at smaller Z: paint must have the
 // smallest Z, then stone, then the opaque rear cap at the largest Z.
 assert.ok(paint.position.z<stone.position.z);
 assert.ok(stone.position.z<ARCADE_REAR_CAP_Z-.04,
  "cap is in front of the portrait and hides the whole gallery");
});

test("Floor paint uses underground support, not mountain topography",()=>{
 for(const z of [-78,-75.5,-72,-68,-65.2]){
  for(const u of [.1,.25,.5,.75,.9]){
   const floor=sampleCavernArt("floor",z,u,.35,.056)!;
   assert.ok(Math.abs(floor.position.y-
    (arcadeCaveFloorHeight({x:floor.position.x,z})-.024))<1e-6);
   const ceiling=sampleCavernArt("ceiling",z,u,.35,.056)!;
   assert.ok(ceiling.position.y>floor.position.y+3);
  }
 }
});
test("No invalid, clipping, nonfinite or game-occluding mural descriptors",()=>{
 const first=ARCADE_CAVERN_MURALS[0];
 assert.match(validateCavernMural({...first,id:"",title:""})!,/invalid/);
 assert.match(validateCavernMural({...first,z1:-62})!,/bounds/);
 assert.match(validateCavernMural({...first,z1:-66})!,/sightline/);
 assert.match(validateCavernMural({...first,v1:NaN})!,/nonfinite/);
 const rear=ARCADE_CAVERN_MURALS.find(m=>m.id==="shasta-rear-portrait")!;
 assert.equal(validateCavernMural(rear),null);
 assert.match(validateCavernMural({...rear,u0:.30,u1:.70})!,/overlap/);
 assert.match(validateCavernMural({...rear,u1:1.2})!,/invalid back patch/);
 assert.match(validateCavernMural({...rear,u0:undefined})!,/invalid back patch/);
 assert.equal(sampleCavernArt("left",-90,.5,.5),null);
 assert.equal(sampleCavernArt("right",-70,.5,.5,-.1),null);
 assert.deepEqual(validateArcadeArtManifest([first,first]),["duplicate "+first.id]);
});

test("Authored cavern artwork is local, attributed, unique and usable without network image hotlinks",()=>{
 assert.deepEqual(validateArcadeMuralAssets(),[]);
 assert.equal(ARCADE_CAVERN_MURALS.some(m=>m.theme==="identity"),false,
  "typographic hero banner must not be rendered in the cavern");
 assert.equal(ARCADE_MURAL_ART_ASSETS.shasta!.src,
  "/visual-archive/web/photo-037.webp");
 assert.equal(ARCADE_MURAL_ART_ASSETS.shasta!.presentation,"shasta-photo-stencil");
 assert.equal(ARCADE_MURAL_ART_ASSETS.sports!.presentation,
  "sports-crest-composite");
 assert.deepEqual(ARCADE_MURAL_ART_ASSETS.sports!.supportingSources,[
  "/world/arcade-cavern/sports/patriots-crest.png",
  "/world/arcade-cavern/sports/warriors-crest.png",
 ]);
 assert.equal(ARCADE_MURAL_ART_ASSETS.sports!.authorship,"third-party-trademark");
 assert.deepEqual(validateArcadeMuralAssets({
  sports:{...ARCADE_MURAL_ART_ASSETS.sports!,supportingSources:[
   "/world/arcade-cavern/sports/patriots-crest.png",
   "https://external.test/logo.png",
  ]},
 }),["sports: invalid supporting source"]);

 assert.match(ARCADE_MURAL_ART_ASSETS.shasta!.attribution,/photo-037/);
 assert.deepEqual(validateArcadeMuralAssets({
  shasta:{...ARCADE_MURAL_ART_ASSETS.shasta!,attribution:""},
 }),["shasta: missing attribution"]);
});
test("All wall overlays are image-only with no generated words",()=>{
 for(const file of [
  "components/world/worldArcadePhotoGallery.ts",
  "components/world/worldArcadeSportsMural.ts",
  "components/world/worldArcadeShastaStencil.ts",
 ]){
  const source=readFileSync(file,"utf8");
  assert.doesNotMatch(source,/\\b(?:fillText|strokeText|paintWord|solidTitle)\\s*\\(/,
   file+" must never paint titles, labels or slogans over the photo");
 }
 assert.equal(ARCADE_CAVERN_MURALS.some(m=>m.id==="sids-underground"),false);
 assert.equal(ARCADE_CAVERN_MURALS.find(m=>m.surface==="left")?.theme,
  "shasta-gallery");
 assert.ok(CAVERN_PHOTO_ALBUMS.feature.images.every(p=>p.startsWith("/")));
});
