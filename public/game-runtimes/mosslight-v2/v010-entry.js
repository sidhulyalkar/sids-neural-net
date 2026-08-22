import './v091/boot.js';
await import('./v091/synergy-v010.js');
const VERSION='0.10.0',playtest=window.__MOSSLIGHT_PLAYTEST__,visual=window.SylvariaVisualSystem;
if(playtest){const base=playtest.snapshot.bind(playtest);playtest.version=VERSION;playtest.snapshot=()=>{const s=base();s.version=VERSION;s.synergy=window.SylvariaSynergy?.snapshot?.()||null;s.visual={...(s.visual||{}),version:VERSION,ecologicalSynergy:true,hazardAwareAI:true,verdantFlow:true,threatPriority:true,pacBulldoze:true,returnEcology:true,gasShear:true};return s}}
if(visual){const base=visual.snapshot.bind(visual);visual.version=VERSION;visual.snapshot=()=>({...base(),version:VERSION,ecologicalSynergy:true,hazardAwareAI:true,verdantFlow:true,threatPriority:true,pacBulldoze:true,returnEcology:true,gasShear:true})}
window.Sylvaria010=window.Sylvaria091;
