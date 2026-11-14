import type {RegionId} from "./model";

/** Editorial context for established island waypoints. These are concise
 * introductions to existing work, not a second copy of the project archive.
 * Keep the region IDs stable for keyboard, raycast and URL discovery routes. */
export type CairnStory={
  id:RegionId;
  theme:string;
  title:string;
  lead:string;
  perspective:string;
  links:readonly {label:string;href:string}[];
};

export const CAIRN_STORIES:Readonly<Record<RegionId,CairnStory>>={
  grove:{
    id:"grove",theme:"ORIGINS · NEUROSCIENCE",
    title:"Building the experiment before analyzing the brain",
    lead:"In UC San Diego's NEATLABs, I helped build the behavioral and recording systems that made experiments possible.",
    perspective:"Go/No-Go, delay discounting and reversal learning each require trustworthy task events. I worked across behavioral apparatus, Simulink control, recording infrastructure and LFP/behavior analysis. Reliable data begins with reliable experiments.",
    links:[{label:"Explore the NEATLABs systems",href:"/case-studies/neatlabs-core-research"},{label:"About my work",href:"/about"}],
  },
  mountain:{
    id:"mountain",theme:"SCIENTIFIC ENGINEERING",
    title:"Turning complicated experiments into dependable workflows",
    lead:"The real engineering challenge is connecting raw acquisition, computation, provenance and the people doing the science.",
    perspective:"My DataJoint work involved multimodal research workflows, including the Sabatini Lab and Allen Mindscope. This mountain's simulated skiing is another exercise in building complex behavior from measurable, testable systems.",
    links:[{label:"Sabatini workflow case study",href:"/case-studies/harvard-sabatini-pipeline"},{label:"Allen Mindscope systems",href:"/case-studies/allen-mindscope-datajoint-workflows"}],
  },
  neural:{
    id:"neural",theme:"NEURAL DYNAMICS · INTERPRETABILITY",
    title:"What does a model learn about a living system?",
    lead:"My neural-modeling explorations connect signals, behavior and computational mechanisms.",
    perspective:"In neurOS-v1, the questions range from representing spikes and continuous neural activity to understanding the internal structure of learned models. The research challenge is making complex neural data interpretable rather than merely compressible.",
    links:[{label:"Explore neurOS-v1",href:"/case-studies/neuros-v1-platform"},{label:"Research directions",href:"/ideas"}],
  },
  coast:{
    id:"coast",theme:"EXPLORATION · PHOTOGRAPHY",
    title:"Where observation becomes a collection of questions",
    lead:"Coastal landscapes, field photographs and time spent exploring the water shape how I think about visual evidence.",
    perspective:"A photograph records a place; a sequence reveals motion. That distinction connects my outdoor archive to my interest in computational understanding of action and animal behavior.",
    links:[{label:"Browse my photography",href:"/photography"},{label:"Explore the projects",href:"/projects"}],
  },
  lagoon:{
    id:"lagoon",theme:"WATER · MEMORY",
    title:"A landscape you can revisit",
    lead:"Warm lagoon colors and the island's underwater passage echo locations represented in my photography archive.",
    perspective:"Rather than treating every underwater place as one ecosystem, the iLand separates this warm lagoon from the temperate kelp coast. The associated archive includes confirmed photographs from Moʻorea and Bora Bora.",
    links:[{label:"See the Moʻorea photograph",href:"/photography?photo=photo-029"},{label:"Explore the visual archive",href:"/photography"}],
  },
  waterfall:{
    id:"waterfall",theme:"METHODS · PUBLICATIONS",
    title:"Follow the evidence behind the work",
    lead:"The waterfall connects surface exploration with the hidden three-room research archive.",
    perspective:"Research deserves more than a list of paper titles. The archive links experimental origins, methods and discoveries so a visitor can understand the chain from measurements to scientific claims.",
    links:[{label:"Browse publications",href:"/publications"},{label:"Open research case studies",href:"/case-studies"}],
  },
  canyon:{
    id:"canyon",theme:"UNDERWATER OBSERVATION",
    title:"Movement is more than a single frame",
    lead:"This submerged passage connects reef ecology with a broader interest in understanding changing scenes over time.",
    perspective:"The underwater environment is a deliberately art-directed composite, not a record of sightings at one exact site. It is also a natural place to explore the difference between recognizing an organism and understanding its behavior through a video.",
    links:[{label:"See the visual archive",href:"/photography"},{label:"Explore my technical projects",href:"/projects"}],
  },
  cavern:{
    id:"cavern",theme:"PLAY · INTERACTION",
    title:"A place for computational ideas to become games",
    lead:"The arcade brings together playful interfaces, control systems and creative experiments.",
    perspective:"The games are not decorations for the portfolio. They invite visitors to interact with the systems, experience feedback loops and explore ideas through direct play.",
    links:[{label:"Explore playable games",href:"/arcade"},{label:"See the underlying builds",href:"/projects"}],
  },
  desert:{
    id:"desert",theme:"MOTION · CONTROL",
    title:"Learning a landscape through movement",
    lead:"The Joshua terrain connects mountain biking, timing, trajectories and the feel of physical control.",
    perspective:"A technical trail is a sequence of decisions about speed, balance and terrain. The island's biking systems turn those ideas into an interactive engineering challenge, without pretending this fictional course is a literal location.",
    links:[{label:"Browse projects",href:"/projects"},{label:"See adventure photography",href:"/photography"}],
  },
  rainforest:{
    id:"rainforest",theme:"BIODIVERSITY · BEHAVIOR",
    title:"Look closely before drawing conclusions",
    lead:"The rainforest is about ecological observation and how behavior unfolds within a living environment.",
    perspective:"Wildlife silhouettes, perching, and movement all matter. They also highlight a recurring question in my work: what does an observation actually establish, and what requires a longer sequence of evidence?",
    links:[{label:"See a sloth photograph",href:"/photography?photo=photo-016"},{label:"Explore research systems",href:"/case-studies/neatlabs-core-research"}],
  },
  "north-shore":{
    id:"north-shore",theme:"PHYSICS · PLAY",
    title:"A few seconds of motion, many interacting forces",
    lead:"Skimboarding transforms a shoreline into a test of momentum, wet-sand contact, wave timing and body control.",
    perspective:"The board should never float forever on dry sand. Its behavior depends on shallow wash, water support, wave faces and rider inputs, an accessible example of the engineering choices behind responsive physical simulation.",
    links:[{label:"Explore game projects",href:"/arcade"},{label:"See the wider project archive",href:"/projects"}],
  },
};
export const cairnStoryFor=(id:RegionId):CairnStory=>CAIRN_STORIES[id];
