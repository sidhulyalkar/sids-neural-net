/** One active world minigame at a time. Movement activities themselves are
 * not minigames and remain available outside locked challenge sessions. */
export type WorldGameMode="jet"|"ski"|"disc"|"trial"|"skim";
export type WorldGameActivity=Record<WorldGameMode,boolean>;
export function canStartWorldGame(requested:WorldGameMode,
 active:Readonly<WorldGameActivity>):boolean{
 return (Object.keys(active) as WorldGameMode[]).every(
  mode=>mode===requested||!active[mode]);
}


/** Results are presentation, not ownership of movement controls. */
export type WorldGamePhases={
 jet:boolean;
 ski:import("./bigAir").BigAirState["phase"];
 disc:import("./discGolf").DiscGolfState["phase"];
 trial:import("./trials").TrialState["phase"];
 skim:import("./skimboarding").SkimHeat["phase"];
};
export function worldGameSession(phases:WorldGamePhases){
 const activity:WorldGameActivity={
  jet:phases.jet,ski:phases.ski==="armed"||phases.ski==="flying",
  disc:phases.disc!=="off",trial:phases.trial==="armed"||phases.trial==="running",
  skim:phases.skim!=="off",
 };
 const active=(Object.keys(activity) as WorldGameMode[]).find(mode=>activity[mode])??null;
 const results=phases.ski==="landed"||phases.ski==="missed"||
  phases.trial==="complete"||phases.trial==="invalidated";
 return {activity,active,phase:active?"playing":results?"results":"free",
  canChangeMovement:active===null} as const;
}
