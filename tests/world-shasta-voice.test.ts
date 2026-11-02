import test from "node:test";
import assert from "node:assert/strict";
import {parseShastaVoiceCommand} from "../lib/world/shastaVoice";
test("explicit voice phrases dispatch existing commands",()=>{
 for(const [phrase,action] of Object.entries({
  "Shasta, come here!":"come","hey Shasta please sit":"sit",
  "go run":"go","Shasta, roll to the left":"roll-left",
  "shake right paw":"shake-right","spin to the left":"spin-left",
  "Shasta, catch the treat!":"catch","Please jump up":"jump",
 })) assert.equal(parseShastaVoiceCommand(phrase),action);
});
test("reject partial, conversational and adversarial utterances",()=>{
 for(const phrase of ["go go go","don't go","we should go","sitting",
  "Shasta, catch the train","roll left and right","hey shasta",
  "", "no please don't", "sit. go", "x".repeat(181)]){
  assert.equal(parseShastaVoiceCommand(phrase),null,phrase);
 }
});
