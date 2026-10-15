#!/usr/bin/env python3
"""Strict, CI-only resolver for reviewed #94 vs skimboarding merge conflicts.
Never commits or pushes. Rejects unknown files, counts or conflict shapes.
"""
import re
import sys
from pathlib import Path

EXPECTED = {
 ".github/workflows/world-regression.yml": 3,
 "components/world/WorldHome.tsx": 6,
 "components/world/WorldScene.tsx": 2,
 "components/world/world.module.css": 1,
 "components/world/worldRenderer.ts": 21,
}
MARKERS = re.compile(
 r"^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> origin/feat/sids-world\n?",
 re.M | re.S,
)

def require(text, fragment):
 if fragment not in text:
  raise ValueError("Missing reviewed merge anchor: " + fragment)
 return text

def combine(name, i, ours, theirs):
 if name.endswith("world-regression.yml"):
  if i in (0, 1):
   require(theirs,"playtest-skimboarding.mjs")
   return ours+theirs
  require(ours,"Lint dedicated Redwood Skate Grove modules")
  require(theirs,"node --check scripts/playtest-skimboarding.mjs")
  k=ours.index("      - name: Lint dedicated Redwood Skate Grove modules")
  return ours[:k]+theirs+ours[k:]
 if name.endswith("WorldHome.tsx"):
  if i==0:
   require(ours,"onJetSkiMode");require(theirs,"onSkim")
   return ours+theirs
  if i in (1,4,5):
   require(ours,"!worldGameActive")
   return ours.replace("!worldGameActive",'!worldGameActive&&skim.phase==="off"')
  if i==2:
   require(ours,"!worldGameActive")
   return ours.replace("!worldGameActive",'!worldGameActive && skim.phase==="off"')
  require(ours,"worldGameActive")
  return ours.replace("worldGameActive?",'worldGameActive||skim.phase!=="off"?')
 if name.endswith("WorldScene.tsx"):
  require(ours,"onJetSkiMode");require(theirs,"onSkim")
  return ours+theirs
 if name.endswith("world.module.css"):
  require(ours,".jetSkiChooser");require(theirs,".skim")
  return ours+"\n"+theirs
 if name.endswith("worldRenderer.ts"):
  if i in (0,1,20):return ours+"\n"+theirs
  if i==2:
   require(ours,"|| jetSki)")
   return ours.replace("|| jetSki)",'|| jetSki || skimHeat.phase!=="off")')
  if i==3:
   require(theirs,'if(skimHeat.phase!=="off")')
   require(ours,'if(key==="escape"&&jetSki)')
   return theirs+ours
  if i==4:
   require(ours,"nearJetSkiBoarding")
   return (ours.replace('&&aquatic==="land")','&&aquatic==="land"&&skimHeat.phase==="off")')
    .replace("&& discovery)",'&& discovery && skimHeat.phase==="off")'))
  if i==5:
   require(theirs,'if(skimHeat.phase==="riding")')
   require(ours,"mountainJumpEligible")
   return theirs.split("    if (!state.entered",1)[0]+ours
  if i==6:
   require(theirs,'if(skimHeat.phase==="ready"&&isWater(player))')
   require(ours,"jetSkiPierHeight")
   return theirs.split("        if (isWater(player))",1)[0]+ours.lstrip("\n")
  if i==7:
   require(theirs,"stepSkimHeat");require(ours,"skateBowlFlightActive")
   k=theirs.find('      if(bigAir.phase==="armed" &&')
   if k<0:raise ValueError("Skim step missing expected Big Air boundary")
   return theirs[:k]+ours
  if i==8:
   require(ours,"const mode = effectiveActivity(state.activity, player);")
   require(theirs,'skimHeat.phase!=="off"')
   return ours.replace("const mode = effectiveActivity(state.activity, player);",theirs.strip())
  if i==9:
   require(ours,"const trickPose=skateTrickPose")
   require(theirs,"const surfing=")
   b=theirs.splitlines(keepends=True)
   k=next(j for j,line in enumerate(b) if "      chalk.visible" in line)
   h=ours.splitlines(keepends=True)
   poses=[line for line in h if (
    "trickPose=" in line or "board.rotation.set(" in line or "board.position.y=" in line
   )]
   if len(poses)!=3:raise ValueError("Skate pose code changed")
   front=b[:k]
   if len(front)!=5:raise ValueError("Skim board preamble changed")
   return "".join(front[:2])+front[2]+"".join(poses)+front[3]+front[4]+"".join(b[k:])
  if i==10:
   require(ours,"trickPose.crouch");require(theirs,"surfing ?")
   h=ours.splitlines(keepends=True)
   if len(h)!=5:raise ValueError("Leg animation shape changed")
   return (h[0]+h[1].replace("= running ?", "= surfing ? (skimHeat.air>0?.32:.17) : running ?")
    +h[2]+h[3].replace("= running ?", "= surfing ? (skimHeat.air>0?-.35:-.16) : running ?")
    +h[4])
  if i==11:
   require(ours,"trickPose.grab");require(theirs,"surfing?-1.23")
   return (ours.replace("= throwArm!==null?","= surfing?-1.23:throwArm!==null?")
    .replace("= climb ? -1.6","= surfing?-1.17:climb ? -1.6"))
  if i==12:
   require(ours,"skateCarveLean");require(theirs,"avatarTurn")
   return ours.replace(
    'explorer.rotation.set(pitchAngle, headingYaw+(mode==="skate"?trickPose.bodyYaw:0), rollAngle);',
    'explorer.rotation.set(surfing?.1+skimHeat.air*.035:pitchAngle,\n'
    '          headingYaw+avatarTurn+(mode==="skate"?trickPose.bodyYaw:0),\n'
    '          surfing?Math.sin(elapsed*1.7)*.065:rollAngle);')
  if i==13:
   require(ours,"skateVisible");require(theirs,"skimHeat.phase")
   return re.sub(r"(?m)^[ \\t]*canvas\\.dataset\\.activity = mode;[ \\t]*\\n","",ours)+theirs
  if i==14:
   require(ours,"shastaSnow=");require(ours,"shastaWaitsAtArcadeEntrance")
   require(theirs,'playerWaterZone === "north-shore"')
   shore=theirs.split("    const dogCaveProgress =",1)[0]
   tail=ours.split("    // The game's carved chamber",1)[1]
   return shore+"    // The game's carved chamber"+tail
  if i==15:
   require(ours,"visibleAimTarget");require(theirs,"cameraTargetError")
   return ours+theirs
  if i in (16,17,18):
   require(ours,"occupiedByOtherMode")
   mode={16:"disc",17:"ski",18:"trial"}[i]
   return ours.replace('!occupiedByOtherMode("'+mode+'")',
                       '!occupiedByOtherMode("'+mode+'")&&skimHeat.phase==="off"')
  if i==19:
   require(ours,"skateGroveStartHeading");require(theirs,"north-shore")
   return ours.replace("{x:0,z:-1}",'{x:0,z:r.id==="north-shore"?1:-1}')
 raise ValueError("Unreviewed conflict "+name+" #"+str(i+1))

def resolve_file(name):
 raw=Path(name).read_text()
 found=list(MARKERS.finditer(raw))
 if len(found)!=EXPECTED[name]:
  raise ValueError("Conflicts changed in "+name+" expected "+str(EXPECTED[name])+
                   " got "+str(len(found)))
 i=iter(range(len(found)))
 result=MARKERS.sub(lambda m:combine(name,next(i),m.group(1),m.group(2)),raw)
 if "<<<<<<<" in result or ">>>>>>>" in result or "=======" in result:
  raise ValueError("Unresolved marker remains in "+name)
 Path(name).write_text(result)
 print("Resolved",name,len(found),"reviewed conflicts")

def rewrite_once(path, old, new):
 text=Path(path).read_text()
 if text.count(old)!=1:
  raise ValueError("Unexpected coastal integration anchor in "+path+": "+old[:90])
 Path(path).write_text(text.replace(old,new))

def preserve_sport_geography():
 """Give North Shore its actual offshore latitude instead of flooding the
 protected south-meadow skate grove. Single function defines the coast;
 terrain, wet sand, pickups, waves and wildlife use that same shoreline."""
 shore="lib/world/skimboarding.ts"
 rewrite_once(shore,
  "return 47.5 + 12.5 * Math.exp(-((x - 43) ** 2) / 210) + 1.25 * Math.sin(x * 0.085);",
  "return 66 + 12.5 * Math.exp(-((x - 43) ** 2) / 210) + 1.25 * Math.sin(x * 0.085);")
 rewrite_once(shore,
  "return smooth((z - 29) / 10) * (1 - smooth((Math.abs(x) - 19) / 14));",
  "return smooth((z - (northShoreZ(x) - 12)) / 7) * (1 - smooth((Math.abs(x) - 19) / 14));")
 rewrite_once(shore,
  "return Math.abs(p.x) < 29 && p.z > 30 && p.z < northShoreZ(p.x) + 5;",
  "return Math.abs(p.x) < 29 && p.z > northShoreZ(p.x) - 12 && p.z < northShoreZ(p.x) + 5;")
 rewrite_once("lib/world/model.ts",
  '{ id: "north-shore", name: "North shore", meaning: "Skimboarding · Shore break", point: { x: 0, z: 40 }, href: "/photography" },',
  '{ id: "north-shore", name: "North shore", meaning: "Skimboarding · Shore break", point: { x: 0, z: northShoreZ(0) - 8 }, href: "/photography" },')
 tests="tests/world-skimboarding.test.ts"
 rewrite_once(tests,
  "for(let z=33;z<northShoreZ(board.x)+3;z+=1.5)",
  "for(let z=northShoreZ(board.x)-11.5;z<northShoreZ(board.x)+3;z+=1.5)")
 with Path(tests).open("a") as out:
  out.write("""
test("skatepark and north shore remain separate contiguous outdoor activities",()=>{
  for(const x of [-19.9,-12,-6,0,7.9]){
    for(const z of [32,40,48,51.9]){
      assert.equal(isWater({x,z}),false,
        "North Shore water cannot flood the south-meadow skate grove");
      assert.ok(beachBlend(x,z)<.001,
        "North Shore foreshore cannot sculpt the physical skatepark");
    }
  }
  for(const board of SKIM_BOARDS){
    const p=boardPoint(SKIM_BOARDS.indexOf(board));
    assert.ok(nearbySkimBoard(p)!==null);
    assert.ok(beachBlend(p.x,p.z)>.75);
    assert.ok(skimBeachClearance(p));
    assert.equal(waterZone({x:p.x,z:northShoreZ(p.x)+1}),"north-shore");
  }
});
""")
 print("Protected meadow skate from shifted skim shoreline and added geography contract")

if __name__=="__main__":
 arguments=sys.argv[1:]
 if set(arguments)!=set(EXPECTED):
  raise SystemExit("Unexpected conflict paths. Expected "+
                   repr(sorted(EXPECTED))+" got "+repr(sorted(arguments)))
 for filename in sorted(arguments):resolve_file(filename)
 preserve_sport_geography()
