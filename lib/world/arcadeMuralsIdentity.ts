import type {CavernMural} from "./arcadeCavernSurface";
export const ARCADE_IDENTITY_MURALS:readonly CavernMural[]=[
 {id:"sids-underground",theme:"identity",surface:"back",
  z0:-63.32,z1:-63.32,v0:.63,v1:.79,title:"SID'S UNDERGROUND",
  tags:["LEVEL SELECT","PLAY LOUD"]},
 {id:"shasta-mountain-guardian",theme:"shasta",surface:"left",
  z0:-73.45,z1:-68.25,v0:.53,v1:.94,title:"SHASTA // TRAIL COMPANION",
  tags:["SHASTA","MOUNTAIN BIKING","CLIMBING","HIKING","SKIING"]},
 // Rear-wall painted gallery is carved around the center game target.
 // Both compositions are safely outside the x=14.2..17.8 interaction area.
 {id:"shasta-rear-fresco",theme:"shasta",surface:"back",
  z0:-63.32,z1:-63.32,u0:.00,u1:.28,v0:.16,v1:.58,
  title:"SHASTA // MAIN CHAMBER",tags:["SHASTA","MOUNTAINS"]},
 {id:"neuroforge-rear-fresco",theme:"neural",surface:"back",
  z0:-63.32,z1:-63.32,u0:.72,u1:1.00,v0:.16,v1:.58,
  title:"NEURAL NETWORK // MAIN CHAMBER",tags:["MIND FORGE","NEUROSCIENCE"]},
 {id:"neuroforge-synapses",theme:"neural",surface:"right",
  z0:-73.10,z1:-68.17,v0:.53,v1:.94,title:"NEUROSCIENCE // MIND FORGE",
  tags:["NEUROSCIENCE","ENGINEERING","MIND FORGE","BUILD","PLAY"]},
];