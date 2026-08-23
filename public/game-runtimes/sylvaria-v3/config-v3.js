export const VERSION='3.0.0-alpha.1';
export const VIEW={w:1280,h:720};
export const WORLD={w:1760,h:6400};
export const FIXED_DT=1/120;
export const TAU=Math.PI*2;

export const DEFAULT_BINDINGS=Object.freeze({
  left:'ArrowLeft',
  right:'ArrowRight',
  up:'ArrowUp',
  down:'ArrowDown',
  jump:'Space',
  attack:'KeyD',
  dash:'ShiftLeft',
  interact:'KeyE',
  pause:'Escape',
  restart:'KeyR',
});

export const MOVE=Object.freeze({
  runSpeed:355,
  groundAccel:3300,
  airAccel:2250,
  groundBrake:4100,
  gravity:2180,
  maxFall:1080,
  jumpSpeed:690,
  coyote:0.11,
  jumpBuffer:0.13,
  jumpCutGravity:1.35,
  wallFall:145,
  wallGripTime:1.15,
  wallLaunchX:500,
  wallLaunchY:660,
  airDashSpeed:825,
  airDashTime:0.105,
  airDashRecover:0.08,
  vineGrabRadius:84,
  vinePump:2.35,
  vineReleaseLift:205,
  branchCarryEpsilon:0.001,
});

export const COMBAT=Object.freeze({
  attackCooldown:0.085,
  side:{startup:0.028,activeEnd:0.145,duration:0.19,damage:1.0,reach:74,height:42},
  up:{startup:0.026,activeEnd:0.16,duration:0.205,damage:1.05,reach:70,width:48},
  down:{startup:0.02,activeEnd:0.18,duration:0.215,damage:1.15,reach:72,width:44},
  wall:{startup:0.022,activeEnd:0.15,duration:0.19,damage:1.15,reach:70,height:46},
  dash:{startup:0.012,activeEnd:0.115,duration:0.145,damage:1.35,reach:88,height:42},
  plunge:{startup:0.01,activeEnd:0.22,duration:0.245,damage:1.65,reach:84,width:50},
  projectileDeflectWindow:0.13,
  reflectSpeed:760,
  downBounce:610,
  plungeBounce:735,
  enemyLaunch:385,
  comboWindow:0.31,
  hitStopFrames:{light:1,heavy:2,reflect:2},
});

export const CAMERA=Object.freeze({
  horizontalLead:150,
  verticalLeadUp:150,
  verticalLeadDown:75,
  stiffnessX:7.2,
  stiffnessY:6.8,
});

export const COLORS=Object.freeze({
  moon:'#d9f3d2',
  guardian:'#173124',
  guardianEdge:'#aee6a2',
  blade:'#eefbd4',
  industrial:'#d6934f',
  danger:'#ff9a54',
  bark:'#403522',
  barkDark:'#15180f',
  moss:'#718b4e',
  fog:'#aac7b5',
  spirit:'#b8f3d4',
});
