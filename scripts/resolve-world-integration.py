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

if __name__=="__main__":
 arguments=sys.argv[1:]
 if set(arguments)!=set(EXPECTED):
  raise SystemExit("Unexpected conflict paths. Expected "+
                   repr(sorted(EXPECTED))+" got "+repr(sorted(arguments)))
 for filename in sorted(arguments):resolve_file(filename)
