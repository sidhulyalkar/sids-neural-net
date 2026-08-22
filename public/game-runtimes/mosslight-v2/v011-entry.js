await import('./v010-entry.js');
await import('./v011/replay-v011.js');
const VERSION='0.11.0',playtest=window.__MOSSLIGHT_PLAYTEST__,visual=window.SylvariaVisualSystem;
if(playtest){const base=playtest.snapshot.bind(playtest);playtest.version=VERSION;playtest.snapshot=()=>{const snapshot=base();snapshot.version=VERSION;snapshot.replay=window.SylvariaReplay?.snapshot?.()||null;snapshot.visual={...(snapshot.visual||{}),version:VERSION,replayRecording:true,serverAuthoritativeLeaderboard:true};return snapshot}}
if(visual){const base=visual.snapshot.bind(visual);visual.version=VERSION;visual.snapshot=()=>({...base(),version:VERSION,replayRecording:true,serverAuthoritativeLeaderboard:true})}
window.Sylvaria011=window.Sylvaria091;
