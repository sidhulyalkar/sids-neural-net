import assert from "node:assert/strict";
import test from "node:test";
import {canStartWorldGame,type WorldGameActivity,type WorldGameMode} from "../lib/world/gameMode";

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
