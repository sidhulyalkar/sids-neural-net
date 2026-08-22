import './v091/model.js';
await import('./v011/rooms-v011.js');
await import('./v091/boot.js');
await import('./v091/synergy-v010.js');
await import('./v011/presentation-v011.js');
await import('./v011/input-guard-v011.js');
const G=window.Sylvaria091,F=G.fn,state=G.state,VERSION='0.11.1',playtest=window.__MOSSLIGHT_PLAYTEST__,visual=window.SylvariaVisualSystem,rooms=G.ROOMS_V011||[];
const baseSetup=F.setupRoom;F.setupRoom=(depth,...rest)=>{const result=baseSetup(depth,...rest);if(state.boss)state.boss.name=state.room?.bossName||'Boss';return result};
if(playtest){const base=playtest.snapshot.bind(playtest);playtest.version=VERSION;playtest.roomCount=rooms.length;playtest.roomTitles=rooms.map(room=>room.title);playtest.roomBlueprint=G.roomBlueprint;playtest.snapshot=()=>{const s=base();s.version=VERSION;s.roomCount=rooms.length;s.synergy=window.SylvariaSynergy?.snapshot?.()||null;s.replay=window.SylvariaReplay?.snapshot?.()||null;s.competitive=window.SylvariaCompetitive?.snapshot?.()||null;s.coach=window.SylvariaCoach?.snapshot?.()||null;s.visual={...(s.visual||{}),version:VERSION,expandedArenas:true,minimalPresentation:true,deterministicReplay:true,competitiveRuns:true,actionCoach:true,repeatSafeControls:true,ecologicalSynergy:true,hazardAwareAI:true,flow:true,threatPriority:true,bossBulldoze:true,returnEcology:true,gasShear:true};return s}}
if(visual){const base=visual.snapshot.bind(visual);visual.version=VERSION;visual.snapshot=()=>({...base(),version:VERSION,expandedArenas:true,minimalPresentation:true,deterministicReplay:true,competitiveRuns:true,actionCoach:true,repeatSafeControls:true,ecologicalSynergy:true,hazardAwareAI:true,flow:true,threatPriority:true,bossBulldoze:true,returnEcology:true,gasShear:true})}
window.MosslightDirector={...window.MosslightDirector,summary:()=>rooms.map((room,index)=>({room:index+1,situation:room.subtitle,area:room.area,title:room.title}))};
window.Sylvaria010=G;window.Sylvaria011=G;
