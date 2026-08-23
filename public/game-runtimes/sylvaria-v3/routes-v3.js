// BarkRails replace shelf-only traversal with deterministic sloped tree surfaces.
// Each band deliberately contains a forgiving Bark route, a faster Sapline route,
// and a riskier mastery route that intersects enemy or hazard pressure.
export const BARK_RAILS=Object.freeze([
  // ROOTREACH · learn slopes and a single forgiving sling.
  {id:'rail-root-safe-a',zone:'roots',route:'safe',ax:390,ay:6210,bx:690,by:6045,thickness:24},
  {id:'rail-root-speed-a',zone:'roots',route:'speed',ax:1015,ay:5975,bx:1320,by:5750,thickness:20},
  {id:'rail-root-master-a',zone:'roots',route:'mastery',ax:705,ay:5590,bx:810,by:5360,thickness:18},

  // SAPWOOD SPLIT · routes cross the trunk and teach lateral slings.
  {id:'rail-sap-safe-a',zone:'sapwood',route:'safe',ax:995,ay:5160,bx:1315,by:4970,thickness:22},
  {id:'rail-sap-speed-a',zone:'sapwood',route:'speed',ax:765,ay:4810,bx:485,by:4590,thickness:18},
  {id:'rail-sap-master-a',zone:'sapwood',route:'mastery',ax:1005,ay:4480,bx:1335,by:4245,thickness:17},

  // HOLLOW SCAR · more diagonal travel with reduced recovery shelves.
  {id:'rail-hollow-safe-a',zone:'hollow',route:'safe',ax:755,ay:4020,bx:485,by:3835,thickness:21},
  {id:'rail-hollow-speed-a',zone:'hollow',route:'speed',ax:1000,ay:3770,bx:1325,by:3550,thickness:18},
  {id:'rail-hollow-master-a',zone:'hollow',route:'mastery',ax:755,ay:3445,bx:475,by:3215,thickness:17},

  // STORM CANOPY · safe route remains recoverable while speed/mastery lines
  // stay airborne through Ranger, Sawkite, and Skidline pressure.
  {id:'rail-canopy-safe-a',zone:'canopy',route:'safe',ax:995,ay:2850,bx:1325,by:2640,thickness:20},
  {id:'rail-canopy-speed-a',zone:'canopy',route:'speed',ax:775,ay:2560,bx:455,by:2325,thickness:17},
  {id:'rail-canopy-master-a',zone:'canopy',route:'mastery',ax:995,ay:2295,bx:1350,by:2000,thickness:16},
  {id:'rail-canopy-master-b',zone:'canopy',route:'mastery',ax:770,ay:1955,bx:435,by:1645,thickness:16},

  // HEARTWOOD CROWN · all three route types converge on the Girdler.
  {id:'rail-crown-safe-a',zone:'crown',route:'safe',ax:985,ay:1515,bx:1300,by:1300,thickness:20},
  {id:'rail-crown-speed-a',zone:'crown',route:'speed',ax:780,ay:1245,bx:465,by:995,thickness:17},
  {id:'rail-crown-master-a',zone:'crown',route:'mastery',ax:985,ay:935,bx:1335,by:690,thickness:16},
  {id:'rail-crown-master-b',zone:'crown',route:'mastery',ax:775,ay:690,bx:505,by:490,thickness:16},
]);

// These Resin Knots are bound to BarkRails. They obey the same Sapline physics as
// every other knot; route type is telemetry/design metadata, never a physics class.
export const ROUTE_ANCHORS=Object.freeze([
  {id:'knot-route-root-speed',rail:'rail-root-speed-a',t:.72,route:'speed'},
  {id:'knot-route-root-master',rail:'rail-root-master-a',t:.58,route:'mastery'},
  {id:'knot-route-sap-speed',rail:'rail-sap-speed-a',t:.66,route:'speed'},
  {id:'knot-route-sap-master',rail:'rail-sap-master-a',t:.7,route:'mastery'},
  {id:'knot-route-hollow-speed',rail:'rail-hollow-speed-a',t:.7,route:'speed'},
  {id:'knot-route-hollow-master',rail:'rail-hollow-master-a',t:.64,route:'mastery'},
  {id:'knot-route-canopy-speed',rail:'rail-canopy-speed-a',t:.66,route:'speed'},
  {id:'knot-route-canopy-master-a',rail:'rail-canopy-master-a',t:.7,route:'mastery'},
  {id:'knot-route-canopy-master-b',rail:'rail-canopy-master-b',t:.63,route:'mastery'},
  {id:'knot-route-crown-speed',rail:'rail-crown-speed-a',t:.68,route:'speed'},
  {id:'knot-route-crown-master-a',rail:'rail-crown-master-a',t:.7,route:'mastery'},
  {id:'knot-route-crown-master-b',rail:'rail-crown-master-b',t:.58,route:'mastery'},
]);
