/** One active world minigame at a time. Movement activities themselves are
 * not minigames and remain available outside locked challenge sessions. */
export type WorldGameMode="jet"|"ski"|"disc"|"trial"|"skim";
export type WorldGameActivity=Record<WorldGameMode,boolean>;
export function canStartWorldGame(requested:WorldGameMode,
 active:Readonly<WorldGameActivity>):boolean{
 return (Object.keys(active) as WorldGameMode[]).every(
  mode=>mode===requested||!active[mode]);
}
