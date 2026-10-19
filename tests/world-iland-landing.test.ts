import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {UNDERWATER_TRIDENTS} from "../lib/world/artifacts";

const home=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../components/world/world.module.css",import.meta.url),"utf8");
const metadata=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("Sid's iLand has one minimal, accessible homepage heading and one name-only wordmark",()=>{
  assert.match(home,/<h1 id="world-title">Welcome to <em>Sid’s iLand<\/em><\/h1>/);
  assert.match(home,/>Sid Hulyalkar<\/Link>/);
  assert.doesNotMatch(home,/CALIFORNIA, IN MIND|Brains, machines,|usually outside|Neuroscience & engineering/);
  assert.match(metadata,/title: "Sid’s iLand \| Sid Hulyalkar"/);
  assert.match(home,/Explore world/,"exploration launch remains discoverable");
  assert.match(home,/View site/,"portfolio entry is preserved");
  assert.match(styles,/\.welcome h1 em \{[\s\S]*?display: block;/);
});

test("UCSD trident keeps the real discoverable underwater contract",()=>{
  const trident=UNDERWATER_TRIDENTS.find(item=>item.id==="trident-lagoon");
  assert.ok(trident);
  assert.equal(trident.title,"UCSD");
  assert.equal(trident.zone,"lagoon");
  assert.deepEqual(trident.point,{x:78,z:17});
  assert.match(home,/trident\.id === "trident-lagoon"/);
  assert.match(home,/View Geisel Library lightning photograph/);
  assert.match(home,/GEISEL_PHOTO/);
  assert.match(home,/GEISEL_SOURCE/);
  assert.doesNotMatch(home,/celebrating Bioengineering and scientific exploration/);
  assert.match(home,/Continue diving/,"return-to-water action is preserved");
});
