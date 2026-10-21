import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {nearbyMarineVideo, type MarineCreaturePose} from "../lib/world/marineVideoEncounters";
import {SNORKEL_VIDEO_POINTS} from "../lib/world/model";
import {buildSnorkelVideoPoints} from "../lib/world/marineVideoCatalog";
import type {VisualMotionEntry} from "../src/data/visualMotion";
import {visualMotion} from "../src/data/visualMotion";

const animals: MarineCreaturePose[] = [
  {animal:"turtle",reef:"lagoon",point:{x:80,y:-3,z:15}},
  {animal:"manta",reef:"lagoon",point:{x:96,y:-5,z:15}},
  {animal:"shark",reef:"lagoon",point:{x:88,y:-3,z:19}},
  {animal:"shark",reef:"kelp",point:{x:-50,y:-4,z:11}},
];
const clips=[
  {id:"snorkel-video:turtle-reef",reef:"lagoon" as const,animal:"turtle" as const},
  {id:"snorkel-video:manta-glide",reef:"lagoon" as const,animal:"manta" as const},
  {id:"snorkel-video:kelp-shark",reef:"kelp" as const,animal:"shark" as const},
];

test("only real, matching animal footage becomes a close-range discovery",()=>{
  assert.equal(nearbyMarineVideo({x:80,y:-3,z:15},"dive","lagoon",animals,clips),
    "snorkel-video:turtle-reef");
  assert.equal(nearbyMarineVideo({x:96,y:-5,z:15},"dive","lagoon",animals,clips),
    "snorkel-video:manta-glide");
  assert.equal(nearbyMarineVideo({x:-50,y:-4,z:11},"dive","kelp",animals,clips),
    "snorkel-video:kelp-shark");
  assert.equal(nearbyMarineVideo({x:88,y:-3,z:19},"dive","lagoon",animals,clips),null,
    "a lagoon shark must never show the kelp shark's footage");
  assert.equal(nearbyMarineVideo({x:80,y:-3,z:15},"dive","lagoon",animals,[]),null,
    "no clip means no video UI, not a dead placeholder");
});

test("swimming and dive mode constrain proximity and preserve the reef",()=>{
  assert.equal(nearbyMarineVideo({x:80,y:-0.3,z:15},"surface","lagoon",animals,clips),
    "snorkel-video:turtle-reef");
  assert.equal(nearbyMarineVideo({x:80,y:-0.3,z:15},"land","lagoon",animals,clips),null);
  assert.equal(nearbyMarineVideo({x:80,y:-10,z:15},"dive","lagoon",animals,clips),null);
  assert.equal(nearbyMarineVideo({x:80,y:-3,z:40},"dive","lagoon",animals,clips),null);
  assert.equal(nearbyMarineVideo({x:80,y:-3,z:15},"dive",null,animals,clips),null);
});

test("catalog only publishes real MP4 snorkeling matches, preferring 1080p",()=>{
  const make=(id:string, encounter:VisualMotionEntry["encounter"], sources:VisualMotionEntry["sources"], posterSrc="/posters/turtle.jpg"):VisualMotionEntry=>({
    id,title:id,alt:"Sea creature swimming underwater",
    posterSrc,durationSeconds:22,aspectRatio:"1920 / 1080",
    encounter,sources,
  });
  const lagoon=make("turtle-clip",{activity:"snorkeling",animal:"turtle",reef:"lagoon"},[
    {src:"/clips/turtle-4k.mp4",type:"video/mp4",label:"4K",height:2160},
    {src:"/clips/turtle-1080.mp4",type:"video/mp4",label:"1080p",height:1080},
  ]);
  const clips=buildSnorkelVideoPoints([
    lagoon,
    make("ski",{activity:"ski"},[{src:"/clips/ski.mp4",type:"video/mp4",label:"1080p"}]),
    make("invalid",{activity:"snorkeling",animal:"shark",reef:"kelp"},[{src:"",type:"video/mp4",label:"broken"}]),
    make("no-poster",{activity:"snorkeling",animal:"manta",reef:"lagoon"},[{src:"/clips/manta.mp4",type:"video/mp4",label:"1080p"}],""),
    make("hls-only",{activity:"snorkeling",animal:"ray",reef:"lagoon"},[{src:"/clips/ray.m3u8",type:"application/vnd.apple.mpegurl",label:"HLS"}]),
  ]);
  assert.equal(clips.length,1);
  assert.deepEqual(clips[0],{
    id:"snorkel-video:turtle-clip",title:"turtle-clip",detail:"",
    animal:"turtle",reef:"lagoon",src:"/clips/turtle-1080.mp4",posterSrc:"/posters/turtle.jpg",
  });
});

test("all published snippets have posters, MP4 sources and unique encounter IDs",()=>{
  const ids=SNORKEL_VIDEO_POINTS.map(item=>item.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const item of SNORKEL_VIDEO_POINTS){
    assert.ok(item.src.endsWith(".mp4") || item.src.includes(".mp4?"));
    assert.ok(item.posterSrc);
    assert.ok(["turtle","shark","manta","ray","reef-fish"].includes(item.animal));
    assert.ok(["lagoon","kelp"].includes(item.reef));
    assert.ok(visualMotion.some(clip=>`snorkel-video:${clip.id}`===item.id));
  }
});

test("creature discovery uses live reef fauna and the World dialog returns to exploration",()=>{
  const renderer=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  const home=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
  assert.match(renderer,/tropicalTurtles\.push\(turtle\)/);
  assert.match(renderer,/nearbyMarineVideo\(/);
  assert.match(renderer,/point:tropicalTurtles\[0\]\.position/);
  assert.match(renderer,/point:manta\.object\.position/);
  assert.match(renderer,/marineEncounter \?\? trident\?\.id/);
  assert.match(home,/paused=\{!!panel \|\| quiet\}/);
  assert.match(home,/<video/);
  assert.match(home,/poster=\{video.posterSrc\}/);
  assert.match(home,/Back to reef/);
});
