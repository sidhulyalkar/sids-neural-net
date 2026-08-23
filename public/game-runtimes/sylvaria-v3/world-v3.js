export const ZONES=Object.freeze([
  {id:'roots',name:'ROOTREACH',top:5200,bottom:6400,fog:0.12,wind:0},
  {id:'sapwood',name:'SAPWOOD SPLIT',top:4050,bottom:5200,fog:0.16,wind:0.05},
  {id:'hollow',name:'HOLLOW SCAR',top:2850,bottom:4050,fog:0.21,wind:-0.08},
  {id:'canopy',name:'STORM CANOPY',top:1450,bottom:2850,fog:0.27,wind:0.14},
  {id:'crown',name:'HEARTWOOD CROWN',top:0,bottom:1450,fog:0.32,wind:-0.12},
]);

// Rectangles use x/y center coordinates. Platforms are one-way from above.
export const STATIC_PLATFORMS=Object.freeze([
  {id:'root-floor',x:880,y:6290,w:1120,h:80,type:'root'},
  {id:'root-l1',x:560,y:6020,w:210,h:24,type:'moss'},
  {id:'root-r1',x:1160,y:5820,w:180,h:22,type:'spring',spring:0.8},
  {id:'root-l2',x:660,y:5580,w:150,h:20,type:'moss'},
  {id:'root-r2',x:1190,y:5360,w:125,h:20,type:'dead'},
  {id:'root-l3',x:610,y:5160,w:170,h:22,type:'spring',spring:0.95},

  {id:'sap-r1',x:1160,y:4930,w:145,h:20,type:'moss'},
  {id:'sap-mid1',x:880,y:4720,w:112,h:18,type:'dead'},
  {id:'sap-l1',x:600,y:4520,w:132,h:20,type:'spring',spring:1.05},
  {id:'sap-r2',x:1210,y:4300,w:118,h:18,type:'moss'},
  {id:'sap-l2',x:650,y:4090,w:104,h:18,type:'sap'},

  {id:'hollow-r1',x:1200,y:3880,w:126,h:18,type:'industrial'},
  {id:'hollow-mid1',x:915,y:3680,w:96,h:18,type:'dead'},
  {id:'hollow-l1',x:590,y:3470,w:112,h:18,type:'moss'},
  {id:'hollow-r2',x:1205,y:3260,w:132,h:18,type:'spring',spring:1.08},
  {id:'hollow-l2',x:625,y:3050,w:102,h:18,type:'industrial'},
  {id:'hollow-mid2',x:875,y:2875,w:94,h:18,type:'sap'},

  {id:'canopy-r1',x:1190,y:2680,w:108,h:17,type:'moss'},
  {id:'canopy-l1',x:600,y:2490,w:102,h:17,type:'dead'},
  {id:'canopy-r2',x:1225,y:2290,w:96,h:17,type:'spring',spring:1.15},
  {id:'canopy-mid1',x:890,y:2110,w:86,h:16,type:'industrial'},
  {id:'canopy-l2',x:560,y:1920,w:94,h:17,type:'sap'},
  {id:'canopy-r3',x:1210,y:1720,w:100,h:17,type:'dead'},
  {id:'canopy-mid2',x:860,y:1535,w:88,h:16,type:'spring',spring:1.22},

  {id:'crown-l1',x:590,y:1340,w:100,h:17,type:'moss'},
  {id:'crown-r1',x:1200,y:1160,w:96,h:17,type:'industrial'},
  {id:'crown-mid1',x:875,y:980,w:84,h:16,type:'dead'},
  {id:'crown-l2',x:610,y:810,w:92,h:17,type:'spring',spring:1.25},
  {id:'crown-r2',x:1185,y:650,w:92,h:17,type:'sap'},
  {id:'boss-floor',x:880,y:455,w:760,h:32,type:'heartwood'},
  {id:'crown-perch-l',x:530,y:275,w:120,h:18,type:'moss'},
  {id:'crown-perch-r',x:1230,y:245,w:120,h:18,type:'moss'},
]);

// Bark columns define Bark Grip surfaces. Gaps between sections create hollow-tree chambers.
export const BARK_WALLS=Object.freeze([
  {id:'trunk-base',x:880,y:5700,w:250,h:1000},
  {id:'trunk-sap-a',x:880,y:4800,w:238,h:620},
  {id:'trunk-sap-b',x:880,y:4140,w:228,h:430},
  {id:'trunk-hollow-a',x:880,y:3500,w:270,h:520},
  {id:'trunk-hollow-b',x:880,y:2910,w:220,h:390},
  {id:'trunk-canopy-a',x:880,y:2320,w:205,h:560},
  {id:'trunk-canopy-b',x:880,y:1680,w:190,h:470},
  {id:'trunk-crown-a',x:880,y:1080,w:180,h:450},
  {id:'trunk-crown-b',x:880,y:610,w:168,h:330},
]);

// Resin Knots are the only legal Sapline endpoints. Platform-bound knots ride
// living/spring branches; trunk knots create deliberate alternate ascent arcs.
export const SAPLINE_ANCHORS=Object.freeze([
  {id:'knot-root-l1',platform:'root-l1',offsetX:76,offsetY:-20},
  {id:'knot-root-trunk-a',x:760,y:5840},
  {id:'knot-root-r1',platform:'root-r1',offsetX:-62,offsetY:-20},
  {id:'knot-root-trunk-b',x:1000,y:5635},
  {id:'knot-root-l2',platform:'root-l2',offsetX:48,offsetY:-18},
  {id:'knot-root-l3',platform:'root-l3',offsetX:58,offsetY:-20},

  {id:'knot-sap-r1',platform:'sap-r1',offsetX:-48,offsetY:-18},
  {id:'knot-sap-trunk-a',x:1004,y:4770},
  {id:'knot-sap-l1',platform:'sap-l1',offsetX:42,offsetY:-18},
  {id:'knot-sap-trunk-b',x:756,y:4385},
  {id:'knot-sap-r2',platform:'sap-r2',offsetX:-34,offsetY:-17},
  {id:'knot-sap-l2',platform:'sap-l2',offsetX:30,offsetY:-18},

  {id:'knot-hollow-r1',platform:'hollow-r1',offsetX:-38,offsetY:-18},
  {id:'knot-hollow-trunk-a',x:744,y:3720},
  {id:'knot-hollow-l1',platform:'hollow-l1',offsetX:36,offsetY:-18},
  {id:'knot-hollow-trunk-b',x:1004,y:3325},
  {id:'knot-hollow-r2',platform:'hollow-r2',offsetX:-44,offsetY:-18},
  {id:'knot-hollow-mid2',platform:'hollow-mid2',offsetX:0,offsetY:-19},

  {id:'knot-canopy-r1',platform:'canopy-r1',offsetX:-34,offsetY:-18},
  {id:'knot-canopy-trunk-a',x:770,y:2505},
  {id:'knot-canopy-l1',platform:'canopy-l1',offsetX:32,offsetY:-18},
  {id:'knot-canopy-r2',platform:'canopy-r2',offsetX:-34,offsetY:-18},
  {id:'knot-canopy-trunk-b',x:984,y:2050},
  {id:'knot-canopy-l2',platform:'canopy-l2',offsetX:24,offsetY:-18},
  {id:'knot-canopy-r3',platform:'canopy-r3',offsetX:-30,offsetY:-18},
  {id:'knot-canopy-mid2',platform:'canopy-mid2',offsetX:0,offsetY:-18},

  {id:'knot-crown-l1',platform:'crown-l1',offsetX:28,offsetY:-18},
  {id:'knot-crown-trunk-a',x:984,y:1215},
  {id:'knot-crown-r1',platform:'crown-r1',offsetX:-26,offsetY:-18},
  {id:'knot-crown-mid1',platform:'crown-mid1',offsetX:0,offsetY:-18},
  {id:'knot-crown-l2',platform:'crown-l2',offsetX:26,offsetY:-18},
  {id:'knot-crown-r2',platform:'crown-r2',offsetX:-28,offsetY:-18},
  {id:'knot-crown-perch-l',platform:'crown-perch-l',offsetX:34,offsetY:-18},
  {id:'knot-crown-perch-r',platform:'crown-perch-r',offsetX:-34,offsetY:-18},
]);

export const VINES=Object.freeze([
  {id:'vine-root',ax:1290,ay:5630,len:245,angle:-0.42},
  {id:'vine-sap',ax:520,ay:4680,len:235,angle:0.36},
  {id:'vine-hollow-a',ax:1260,ay:3740,len:210,angle:-0.28},
  {id:'vine-hollow-b',ax:510,ay:3140,len:225,angle:0.31},
  {id:'vine-canopy-a',ax:1260,ay:2450,len:210,angle:-0.34},
  {id:'vine-canopy-b',ax:515,ay:1835,len:220,angle:0.24},
  {id:'vine-crown',ax:1240,ay:1020,len:210,angle:-0.22},
]);

export const HAZARDS=Object.freeze([
  {id:'saw-hollow',kind:'saw',x:1090,y:3600,r:28,axis:'x',range:155,speed:1.15,phase:0.3},
  {id:'saw-canopy-a',kind:'saw',x:690,y:2185,r:25,axis:'x',range:120,speed:1.45,phase:1.4},
  {id:'saw-canopy-b',kind:'saw',x:1110,y:1605,r:27,axis:'y',range:115,speed:1.2,phase:2.2},
  {id:'saw-crown',kind:'saw',x:710,y:895,r:26,axis:'x',range:135,speed:1.6,phase:0.9},
]);

export const CHECKPOINTS=Object.freeze([
  {id:'heartbud-0',x:420,y:6208,zone:'roots'},
  {id:'heartbud-1',x:1250,y:5070,zone:'sapwood'},
  {id:'heartbud-2',x:520,y:3960,zone:'hollow'},
  {id:'heartbud-3',x:1240,y:2780,zone:'canopy'},
  {id:'heartbud-4',x:520,y:1395,zone:'crown'},
]);

export const ENEMY_BLUEPRINTS=Object.freeze([
  {id:'logger-0',kind:'logger',platform:'root-floor',x:1060,hp:4},
  {id:'ranger-0',kind:'ranger',platform:'root-r2',x:1190,hp:3},
  {id:'climber-0',kind:'climber',wall:'trunk-sap-a',side:-1,y:4800,hp:3},
  {id:'logger-1',kind:'logger',platform:'sap-r2',x:1210,hp:5},
  {id:'ranger-1',kind:'ranger',platform:'sap-l2',x:650,hp:4},
  {id:'drone-0',kind:'drone',x:1140,y:3740,hp:3,rangeX:170},
  {id:'climber-1',kind:'climber',wall:'trunk-hollow-a',side:1,y:3420,hp:4},
  {id:'ranger-2',kind:'ranger',platform:'hollow-l2',x:625,hp:4},
  {id:'logger-2',kind:'logger',platform:'hollow-r2',x:1205,hp:5},
  {id:'drone-1',kind:'drone',x:620,y:2500,hp:4,rangeX:185},
  {id:'climber-2',kind:'climber',wall:'trunk-canopy-a',side:-1,y:2250,hp:4},
  {id:'ranger-3',kind:'ranger',platform:'canopy-r3',x:1210,hp:5},
  {id:'trapper-0',kind:'trapper',platform:'canopy-l2',x:560,hp:5},
  {id:'drone-2',kind:'drone',x:1160,y:1500,hp:5,rangeX:195},
  {id:'climber-3',kind:'climber',wall:'trunk-crown-a',side:1,y:1060,hp:5},
  {id:'ranger-4',kind:'ranger',platform:'crown-r2',x:1185,hp:5},
  {id:'trapper-1',kind:'trapper',platform:'crown-l2',x:610,hp:6},
]);

export const BOSS_BLUEPRINT=Object.freeze({
  id:'crown-feller',kind:'boss',name:'CROWN FELLER',x:880,y:390,w:92,h:118,hp:24,maxHp:24,phase:1,guard:3,maxGuard:3,
});

export function cloneWorld(){
  return{
    platforms:STATIC_PLATFORMS.map(item=>({...item,flex:0,standTime:0,broken:false,breakTimer:0,sapCharged:item.type==='sap'})),
    walls:BARK_WALLS.map(item=>({...item})),
    anchors:SAPLINE_ANCHORS.map(item=>({...item})),
    vines:VINES.map(item=>({...item,angVel:0})),
    hazards:HAZARDS.map(item=>({...item,x0:item.x,y0:item.y})),
    checkpoints:CHECKPOINTS.map(item=>({...item,lit:false})),
    enemies:ENEMY_BLUEPRINTS.map(item=>({...item,state:'idle',clock:0,windup:0,recover:0,dead:false,facing:-1,hitFlash:0,attackSerial:0})),
    boss:{...BOSS_BLUEPRINT,state:'dormant',clock:0,windup:0,recover:0,hitFlash:0,dead:false,facing:-1},
  };
}

export function zoneForY(y){return ZONES.find(zone=>y>=zone.top&&y<zone.bottom)||ZONES[ZONES.length-1]}
