import type {ShastaAction} from "./shastaTricks";

/** A finite, opt-in grammar. Never let unconstrained transcripts drive the world. */
export type ShastaVoiceAction=ShastaAction|"catch";
export function parseShastaVoiceCommand(transcript:string):ShastaVoiceAction|null {
  if(typeof transcript!=="string"||transcript.length>180)return null;
  let phrase=transcript.toLowerCase().replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim();
  phrase=phrase.replace(/^(hey |okay |ok )?shasta\s+/,"")
    .replace(/^please\s+/,"").replace(/\s+please$/,"").trim();
  const rules:readonly [RegExp,ShastaVoiceAction][]=[
    [/^(come|come here|come back|come to me|return|back to me)$/,"come"],
    [/^(go|go play|go run|run|run around|chase squirrels)$/,"go"],
    [/^(sit|sit down)$/,"sit"],
    [/^(down|lie down|lay down)$/,"down"],
    [/^(stay|stay there|wait|hold)$/,"stay"],
    [/^(jump|jump up|hop)$/,"jump"],
    [/^(spin left|spin to the left|turn left)$/,"spin-left"],
    [/^(spin right|spin to the right|turn right|spin|twirl)$/,"spin-right"],
    [/^(roll left|roll over left|roll to the left)$/,"roll-left"],
    [/^(roll right|roll over right|roll to the right)$/,"roll-right"],
    [/^(shake left|shake left paw|left paw|give me your left paw)$/,"shake-left"],
    [/^(shake right|shake right paw|right paw|give me your right paw|shake|paw)$/,"shake-right"],
    [/^(catch|catch it|catch the treat|catch treat|treat|throw a treat|throw the treat)$/,"catch"],
  ];
  for(const [pattern,action] of rules)if(pattern.test(phrase))return action;
  return null;
}
