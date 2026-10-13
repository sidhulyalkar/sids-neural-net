import assert from "node:assert/strict";
import test from "node:test";
import {canStartWorldGame,type WorldGameActivity,type WorldGameMode} from "../lib/world/gameMode";

test("minigames can only start when no competing mode is active",()=>{
 const modes:WorldGameMode[]=["jet","ski","disc","trial"];
 for(const activeMode of modes){
  const active:WorldGameActivity={jet:false,ski:false,disc:false,trial:false};
  active[activeMode]=true;
  for(const mode of modes){
   assert.equal(canStartWorldGame(mode,active),mode===activeMode,
    activeMode+" versus "+mode);
  }
 }
});

test("free exploration may start any minigame and overlapping modes are rejected",()=>{
 const none:WorldGameActivity={jet:false,ski:false,disc:false,trial:false};
 for(const mode of ["jet","ski","disc","trial"] as const)
  assert.equal(canStartWorldGame(mode,none),true);
 const conflict:WorldGameActivity={jet:true,ski:false,disc:true,trial:false};
 for(const mode of ["jet","ski","disc","trial"] as const)
  assert.equal(canStartWorldGame(mode,conflict),false);
});
