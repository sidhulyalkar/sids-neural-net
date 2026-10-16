import assert from "node:assert/strict";
import test from "node:test";
import {canStartWorldGame,worldGameSession,type WorldGameActivity,type WorldGameMode} from "../lib/world/gameMode";

test("minigames can only start when no competing mode is active",()=>{
 const modes:WorldGameMode[]=["jet","ski","disc","trial","skim"];
 for(const activeMode of modes){
  const active:WorldGameActivity={jet:false,ski:false,disc:false,trial:false,skim:false};
  active[activeMode]=true;
  for(const mode of modes){
   assert.equal(canStartWorldGame(mode,active),mode===activeMode,
    activeMode+" versus "+mode);
  }
 }
});

test("free exploration may start any minigame and overlapping modes are rejected",()=>{
 const none:WorldGameActivity={jet:false,ski:false,disc:false,trial:false,skim:false};
 for(const mode of ["jet","ski","disc","trial","skim"] as const)
  assert.equal(canStartWorldGame(mode,none),true);
 const conflict:WorldGameActivity={jet:true,ski:false,disc:true,trial:false,skim:false};
 for(const mode of ["jet","ski","disc","trial","skim"] as const)
  assert.equal(canStartWorldGame(mode,conflict),false);
});

test("skimboard heat excludes jet-ski boarding, mountain games and disc golf",()=>{
 const active:WorldGameActivity={jet:false,ski:false,disc:false,trial:false,skim:true};
 assert.equal(canStartWorldGame("skim",active),true);
 for(const other of ["jet","ski","disc","trial"] as const)
  assert.equal(canStartWorldGame(other,active),false);
 const jetChooser:WorldGameActivity={...active,skim:false,jet:true};
 assert.equal(canStartWorldGame("skim",jetChooser),false);
});

 test("completed and interrupted jumps and races release movement without dismissing results",()=>{
  const free={jet:false,ski:"idle",disc:"off",trial:"idle",skim:"off"} as const;
  for(const ski of ["landed","missed"] as const){
   const s=worldGameSession({...free,ski});
   assert.equal(s.canChangeMovement,true);assert.equal(s.phase,"results");
   for(const mode of ["ski","disc","trial","jet","skim"] as const)
    assert.equal(canStartWorldGame(mode,s.activity),true);
  }
  for(const trial of ["complete","invalidated"] as const)
   assert.equal(worldGameSession({...free,trial}).canChangeMovement,true);
  for(const ski of ["armed","flying"] as const)
   assert.equal(worldGameSession({...free,ski}).canChangeMovement,false);
  assert.equal(worldGameSession(free).phase,"free");
  assert.equal(worldGameSession({...free,disc:"ready"}).active,"disc");
  assert.equal(worldGameSession({...free,skim:"finished"}).active,"skim",
   "a retained board still needs its explicit exit or restart");
 });
