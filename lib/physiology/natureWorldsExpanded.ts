import type { PersonaMoodSelfReport } from './schema';
import {
  ACTIVITIES,
  recordAdventure,
  type PersonaActivity,
  type PersonaBiome,
  type PersonaTrait,
  type PersonaWorldProfile,
} from './world';
import {
  NATURE_ATLAS_STORAGE_KEY,
  NATURE_WORLD_PALETTES,
  NATURE_WORLDS as ORIGINAL_NATURE_WORLDS,
  type NatureAtlasProgress,
  type NaturePaletteKey,
  type NatureTerrain,
  type NatureWorldDefinition,
  type NatureWorldTheme,
} from './natureWorlds';
import { NATURE_WORLDS_901_1000 } from './natureWorlds1000Extension';

/**
 * PhysioPersona Nature Atlas v2
 *
 * The first 100 worlds are the hand-authored launch set in natureWorlds.ts.
 * Worlds 101-1000 are compiled from compact, exact manifests into rich scene
 * specifications. This keeps the visual system extensible without turning the
 * renderer into 900 copy-pasted JSX branches.
 */

export { NATURE_ATLAS_STORAGE_KEY, NATURE_WORLD_PALETTES };
export type { NatureAtlasProgress, NaturePaletteKey, NatureTerrain, NatureWorldTheme };

export type NatureCollectionId =
  | 'original-atlas'
  | 'deep-woods'
  | 'waters-wetlands'
  | 'frost-alpine'
  | 'gardens-pastures'
  | 'savanna-desert'
  | 'skies-weather'
  | 'fairycore'
  | 'bioluminescent'
  | 'pastel-blooms'
  | 'moody-rain'
  | 'autumn-harvest'
  | 'zen'
  | 'ethereal-coast'
  | 'crystal-frost'
  | 'desert-boho'
  | 'celestial'
  | 'living-sanctuaries'
  | 'geological-wonders';

export type NatureDepthMode = 'intimate' | 'pathway' | 'panorama' | 'vertical' | 'horizon' | 'macro';
export type NatureAtmosphere =
  | 'clear'
  | 'mist'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'wind'
  | 'glow'
  | 'twilight'
  | 'night'
  | 'sunrise'
  | 'sunset'
  | 'frost';

export type NatureRenderCue =
  | 'pine' | 'oak' | 'bamboo' | 'willow' | 'palm' | 'tree' | 'roots' | 'log'
  | 'fern' | 'moss' | 'grass' | 'flower' | 'sunflower' | 'mushroom' | 'fruit' | 'leaf'
  | 'cactus' | 'agave' | 'yucca' | 'coral' | 'kelp' | 'shell' | 'reed' | 'lily'
  | 'rock' | 'crystal' | 'ice' | 'snow' | 'sand' | 'canyon' | 'mountain' | 'cave'
  | 'water' | 'river' | 'lake' | 'pond' | 'ocean' | 'waterfall' | 'island'
  | 'cloud' | 'sun' | 'moon' | 'stars' | 'meteor' | 'aurora' | 'rainbow' | 'lightning'
  | 'rain' | 'fog' | 'wind' | 'firefly' | 'web' | 'ruin' | 'bridge' | 'path'
  | 'animal' | 'bird' | 'fish' | 'insect' | 'reptile' | 'mammal' | 'glow';

export type NatureScenePlan = {
  collection: NatureCollectionId;
  collectionLabel: string;
  focalSubject: string;
  visualThesis: string;
  foreground: string;
  midground: string;
  backdrop: string;
  atmosphere: NatureAtmosphere;
  motion: string;
  lighting: string;
  camera: string;
  depth: NatureDepthMode;
  interactionCue: string;
  renderCues: NatureRenderCue[];
  density: number;
  sparkle: number;
};

export type RichNatureWorldDefinition = NatureWorldDefinition & {
  collection: NatureCollectionId;
  scene: NatureScenePlan;
};

type ManifestRow = readonly [index: number, icon: string, name: string, collection: Exclude<NatureCollectionId, 'original-atlas'>];

export const NATURE_COLLECTIONS: ReadonlyArray<{ id: NatureCollectionId | 'all'; label: string; icon: string; range: string }> = [
  { id: 'all', label: 'all worlds', icon: '🗺️', range: '001-1000' },
  { id: 'original-atlas', label: 'original atlas', icon: '🌿', range: '001-100' },
  { id: 'deep-woods', label: 'deep woods + rainforest', icon: '🌳', range: '101-150' },
  { id: 'waters-wetlands', label: 'rivers + oceans + wetlands', icon: '🌊', range: '151-200' },
  { id: 'frost-alpine', label: 'frost + alpine peaks', icon: '❄️', range: '201-250' },
  { id: 'gardens-pastures', label: 'valleys + gardens', icon: '🌷', range: '251-300' },
  { id: 'savanna-desert', label: 'savannas + canyons', icon: '🏜️', range: '301-350' },
  { id: 'skies-weather', label: 'skies + weather', icon: '🌈', range: '351-400' },
  { id: 'fairycore', label: 'fairycore thickets', icon: '🍄', range: '401-450' },
  { id: 'bioluminescent', label: 'glowing ecosystems', icon: '✨', range: '451-500' },
  { id: 'pastel-blooms', label: 'pastel blooms', icon: '🌸', range: '501-550' },
  { id: 'moody-rain', label: 'rain + dark woods', icon: '🌧️', range: '551-600' },
  { id: 'autumn-harvest', label: 'autumn + harvest', icon: '🍂', range: '601-650' },
  { id: 'zen', label: 'zen + minimalist', icon: '🪨', range: '651-700' },
  { id: 'ethereal-coast', label: 'ethereal coastlines', icon: '🐚', range: '701-750' },
  { id: 'crystal-frost', label: 'crystal + glacial dreams', icon: '💎', range: '751-800' },
  { id: 'desert-boho', label: 'sun-bleached desert', icon: '🌵', range: '801-850' },
  { id: 'celestial', label: 'celestial vistas', icon: '🌌', range: '851-900' },
  { id: 'living-sanctuaries', label: 'living sanctuaries', icon: '🫶', range: '901-950' },
  { id: 'geological-wonders', label: 'geological wonders', icon: '🪨', range: '951-1000' },
];

const COLLECTION_LABEL: Record<NatureCollectionId, string> = Object.fromEntries(
  NATURE_COLLECTIONS.filter((entry) => entry.id !== 'all').map((entry) => [entry.id, entry.label])
) as Record<NatureCollectionId, string>;

const ADDITIONAL_WORLD_ROWS: ManifestRow[] = [
  [101, "🌿", "dripping rainforest canopy", "deep-woods"],
  [102, "🦜", "chattering macaw tree", "deep-woods"],
  [103, "🌴", "tangled monkey vine", "deep-woods"],
  [104, "🐆", "dappled jaguar clearing", "deep-woods"],
  [105, "🦥", "sleepy sloth branch", "deep-woods"],
  [106, "🌺", "giant rafflesia bloom", "deep-woods"],
  [107, "🍌", "wild banana grove", "deep-woods"],
  [108, "🐸", "poison dart frog leaf", "deep-woods"],
  [109, "🌲", "misty redwood trunk", "deep-woods"],
  [110, "🪵", "rotting nurse log", "deep-woods"],
  [111, "🕸️", "morning dew spider silk", "deep-woods"],
  [112, "🐿️", "busy chipmunk burrow", "deep-woods"],
  [113, "🍄", "glowing toadstool ring", "deep-woods"],
  [114, "🌳", "twisted banyan roots", "deep-woods"],
  [115, "🍃", "floating mahogany leaf", "deep-woods"],
  [116, "🐜", "marching ant trail", "deep-woods"],
  [117, "🦋", "blue morpho swarm", "deep-woods"],
  [118, "🎋", "swaying bamboo shoots", "deep-woods"],
  [119, "🐼", "munching panda patch", "deep-woods"],
  [120, "🌲", "silent taiga forest", "deep-woods"],
  [121, "🦉", "hollow tree nest", "deep-woods"],
  [122, "🦇", "hanging fruit bat roost", "deep-woods"],
  [123, "🐍", "coiled python branch", "deep-woods"],
  [124, "🌿", "overgrown jungle ruin", "deep-woods"],
  [125, "💧", "dripping mossy overhang", "deep-woods"],
  [126, "🦧", "swinging orangutan canopy", "deep-woods"],
  [127, "🌳", "shedding eucalyptus tree", "deep-woods"],
  [128, "🌰", "cracked chestnut shell", "deep-woods"],
  [129, "🦌", "scratching stag tree", "deep-woods"],
  [130, "🍄", "puffball mushroom cluster", "deep-woods"],
  [131, "🌲", "dense pine needle floor", "deep-woods"],
  [132, "🪵", "woodpecker drumming trunk", "deep-woods"],
  [133, "🍃", "sun-baked canopy roof", "deep-woods"],
  [134, "🌲", "fallen cedar bridge", "deep-woods"],
  [135, "🐛", "silk-spinning caterpillar leaf", "deep-woods"],
  [136, "🌳", "gnarly ancient baobab", "deep-woods"],
  [137, "🌿", "lush fern understory", "deep-woods"],
  [138, "🐗", "rooting boar thicket", "deep-woods"],
  [139, "🌲", "sap-covered pinecone", "deep-woods"],
  [140, "🦇", "twilight canopy flight", "deep-woods"],
  [141, "🌳", "split lightning tree", "deep-woods"],
  [142, "🍄", "bracket fungi stump", "deep-woods"],
  [143, "🍃", "twirling helicopter seed", "deep-woods"],
  [144, "🐿️", "squirrel cache hollow", "deep-woods"],
  [145, "🌲", "frosty birch grove", "deep-woods"],
  [146, "🪲", "clicking beetle bark", "deep-woods"],
  [147, "🌿", "shaded jungle ravine", "deep-woods"],
  [148, "🌳", "tangled mangrove root", "deep-woods"],
  [149, "🐾", "muddy animal track", "deep-woods"],
  [150, "🌲", "wind-bent coastal cypress", "deep-woods"],
  [151, "🦭", "basking seal rock", "waters-wetlands"],
  [152, "🐋", "breaching whale horizon", "waters-wetlands"],
  [153, "🦑", "deep sea kelp forest", "waters-wetlands"],
  [154, "🐚", "pearly oyster bed", "waters-wetlands"],
  [155, "🌊", "frothy ocean crest", "waters-wetlands"],
  [156, "🦀", "scurrying hermit crab shore", "waters-wetlands"],
  [157, "🏖️", "washed-up driftwood pile", "waters-wetlands"],
  [158, "🏝️", "lonely palm island", "waters-wetlands"],
  [159, "🐊", "murky alligator swamp", "waters-wetlands"],
  [160, "🦩", "pink flamingo salt flat", "waters-wetlands"],
  [161, "🌊", "choppy gray harbor", "waters-wetlands"],
  [162, "🛶", "sunken wooden canoe", "waters-wetlands"],
  [163, "🐟", "silver salmon run", "waters-wetlands"],
  [164, "💦", "cascading terraced pool", "waters-wetlands"],
  [165, "🪸", "colorful anemone cluster", "waters-wetlands"],
  [166, "🦈", "circling reef shark", "waters-wetlands"],
  [167, "🌊", "dark ocean trench", "waters-wetlands"],
  [168, "🐙", "sleepy octopus den", "waters-wetlands"],
  [169, "🐚", "scattered sea glass beach", "waters-wetlands"],
  [170, "🏖️", "rippled sandbar shallow", "waters-wetlands"],
  [171, "🦢", "nesting swan reeds", "waters-wetlands"],
  [172, "💧", "dripping stalactite cave", "waters-wetlands"],
  [173, "🌊", "crashing blowhole spray", "waters-wetlands"],
  [174, "🐧", "diving penguin cliff", "waters-wetlands"],
  [175, "🧊", "melting ice shelf", "waters-wetlands"],
  [176, "🌊", "gentle lagoon ripple", "waters-wetlands"],
  [177, "🐊", "floating log crocodile", "waters-wetlands"],
  [178, "🦤", "marshy peat bog", "waters-wetlands"],
  [179, "🌿", "floating water hyacinth", "waters-wetlands"],
  [180, "🐟", "darting minnow school", "waters-wetlands"],
  [181, "🌊", "glowing plankton surf", "waters-wetlands"],
  [182, "🐚", "empty conch shell", "waters-wetlands"],
  [183, "🏖️", "muddy low tide flat", "waters-wetlands"],
  [184, "🌊", "stormy sea stack", "waters-wetlands"],
  [185, "🪸", "spiky sea urchin bed", "waters-wetlands"],
  [186, "🐢", "hatching sea turtle nest", "waters-wetlands"],
  [187, "🦆", "splashing mallard pond", "waters-wetlands"],
  [188, "💧", "babbling rock spring", "waters-wetlands"],
  [189, "🌊", "turquoise tropical shallow", "waters-wetlands"],
  [190, "🛶", "abandoned beaver dam", "waters-wetlands"],
  [191, "🦦", "floating sea otter bed", "waters-wetlands"],
  [192, "🐟", "jumping flying fish", "waters-wetlands"],
  [193, "🌊", "quiet bayou backwater", "waters-wetlands"],
  [194, "🦀", "fiddler crab mudflat", "waters-wetlands"],
  [195, "🏖️", "black volcanic sand", "waters-wetlands"],
  [196, "🌊", "swirling ocean whirlpool", "waters-wetlands"],
  [197, "🪸", "brain coral shelf", "waters-wetlands"],
  [198, "💦", "misting waterfall basin", "waters-wetlands"],
  [199, "🌊", "vast open ocean", "waters-wetlands"],
  [200, "🐚", "barnacle-covered pier", "waters-wetlands"],
  [201, "🧊", "crystal ice cavern", "frost-alpine"],
  [202, "❄️", "swirling blizzard whiteout", "frost-alpine"],
  [203, "🏔️", "rocky summit cairn", "frost-alpine"],
  [204, "🦅", "circling hawk thermal", "frost-alpine"],
  [205, "🐐", "sure-footed ibex cliff", "frost-alpine"],
  [206, "❄️", "delicate snowflake drift", "frost-alpine"],
  [207, "🧊", "jagged serac ice block", "frost-alpine"],
  [208, "🌲", "snow-heavy branches", "frost-alpine"],
  [209, "🏔️", "sweeping glacial valley", "frost-alpine"],
  [210, "🐻", "hibernating bear den", "frost-alpine"],
  [211, "❄️", "frozen over lake", "frost-alpine"],
  [212, "🧊", "blue glacier crevasse", "frost-alpine"],
  [213, "🏔️", "steep scree slope", "frost-alpine"],
  [214, "🐾", "snowy paw print trail", "frost-alpine"],
  [215, "❄️", "sparkling morning frost", "frost-alpine"],
  [216, "🧊", "hanging icicle roof", "frost-alpine"],
  [217, "🏔️", "untouched alpine bowl", "frost-alpine"],
  [218, "🐑", "grazing mountain sheep", "frost-alpine"],
  [219, "❄️", "crunchy frozen mud", "frost-alpine"],
  [220, "🧊", "cracking lake ice", "frost-alpine"],
  [221, "🏔️", "sharp matterhorn peak", "frost-alpine"],
  [222, "🦅", "lonely mountain aerie", "frost-alpine"],
  [223, "❄️", "deep winter snowpack", "frost-alpine"],
  [224, "🧊", "slippery permafrost tundra", "frost-alpine"],
  [225, "🏔️", "high altitude pass", "frost-alpine"],
  [226, "🌬️", "howling alpine wind", "frost-alpine"],
  [227, "❄️", "snowblind white horizon", "frost-alpine"],
  [228, "🧊", "frosty windowpane fern", "frost-alpine"],
  [229, "🏔️", "echoing rockfall chute", "frost-alpine"],
  [230, "🐺", "howling timber wolf", "frost-alpine"],
  [231, "❄️", "fluffy powder stash", "frost-alpine"],
  [232, "🧊", "frozen breath vapor", "frost-alpine"],
  [233, "🏔️", "rugged climbing crag", "frost-alpine"],
  [234, "🦅", "swooping falcon dive", "frost-alpine"],
  [235, "❄️", "slumping snow cornice", "frost-alpine"],
  [236, "🧊", "deep freeze river", "frost-alpine"],
  [237, "🏔️", "golden hour alpenglow", "frost-alpine"],
  [238, "🦌", "foraging winter elk", "frost-alpine"],
  [239, "❄️", "sleet-covered meadow", "frost-alpine"],
  [240, "🧊", "solid ice waterfall", "frost-alpine"],
  [241, "🏔️", "hidden alpine tarn", "frost-alpine"],
  [242, "🐾", "solitary snow leopard track", "frost-alpine"],
  [243, "❄️", "wind-sculpted sastrugi", "frost-alpine"],
  [244, "🧊", "glowing blue iceberg", "frost-alpine"],
  [245, "🏔️", "distant mountain range", "frost-alpine"],
  [246, "🦅", "perched bald eagle", "frost-alpine"],
  [247, "❄️", "quiet falling snow", "frost-alpine"],
  [248, "🧊", "frosty pinecone cluster", "frost-alpine"],
  [249, "🏔️", "rocky ridgeline silhouette", "frost-alpine"],
  [250, "🌬️", "freezing mountain draft", "frost-alpine"],
  [251, "🌸", "blooming cherry blossom avenue", "gardens-pastures"],
  [252, "🐝", "busy honeycomb hive", "gardens-pastures"],
  [253, "🌾", "rolling barley field", "gardens-pastures"],
  [254, "🌷", "colorful dutch tulip row", "gardens-pastures"],
  [255, "🐛", "munching silk worm", "gardens-pastures"],
  [256, "🌸", "fragrant jasmine trellis", "gardens-pastures"],
  [257, "🪴", "overgrown potting shed", "gardens-pastures"],
  [258, "🐞", "spotted ladybug leaf", "gardens-pastures"],
  [259, "🌾", "tall rustling corn maze", "gardens-pastures"],
  [260, "🌷", "neglected wild garden", "gardens-pastures"],
  [261, "🐝", "drinking bumblebee flower", "gardens-pastures"],
  [262, "🌸", "floating lotus blossom", "gardens-pastures"],
  [263, "🪴", "neatly trimmed hedge", "gardens-pastures"],
  [264, "🐞", "aphid-covered stem", "gardens-pastures"],
  [265, "🌾", "dry autumn harvest", "gardens-pastures"],
  [266, "🌷", "budding spring crocus", "gardens-pastures"],
  [267, "🐝", "buzzing pollen dust", "gardens-pastures"],
  [268, "🌸", "soft magnolia petal", "gardens-pastures"],
  [269, "🪴", "mossy stone fountain", "gardens-pastures"],
  [270, "🐞", "dew-covered grasshopper", "gardens-pastures"],
  [271, "🌾", "golden hay bale field", "gardens-pastures"],
  [272, "🌷", "sweet smelling lilac bush", "gardens-pastures"],
  [273, "🐝", "wandering carpenter bee", "gardens-pastures"],
  [274, "🌸", "vibrant orchid branch", "gardens-pastures"],
  [275, "🪴", "creeping ivy wall", "gardens-pastures"],
  [276, "🐞", "resting praying mantis", "gardens-pastures"],
  [277, "🌾", "swaying oat grass", "gardens-pastures"],
  [278, "🌷", "delicate snowdrop patch", "gardens-pastures"],
  [279, "🐝", "hovering hummingbird moth", "gardens-pastures"],
  [280, "🌸", "thorny bougainvillea arch", "gardens-pastures"],
  [281, "🪴", "shaded fern rockery", "gardens-pastures"],
  [282, "🐞", "scurrying garden centipede", "gardens-pastures"],
  [283, "🌾", "breezy prairie tallgrass", "gardens-pastures"],
  [284, "🌷", "bright yellow daffodil", "gardens-pastures"],
  [285, "🐝", "sticky nectar drop", "gardens-pastures"],
  [286, "🌸", "heavy peony bloom", "gardens-pastures"],
  [287, "🪴", "quiet Zen rock garden", "gardens-pastures"],
  [288, "🐞", "spinning garden spider", "gardens-pastures"],
  [289, "🌾", "tangled vetch patch", "gardens-pastures"],
  [290, "🌷", "wild bluebell woods", "gardens-pastures"],
  [291, "🐝", "busy wasp nest", "gardens-pastures"],
  [292, "🌸", "drooping fuchsia bell", "gardens-pastures"],
  [293, "🪴", "terra cotta herb pot", "gardens-pastures"],
  [294, "🐞", "glowing evening firefly", "gardens-pastures"],
  [295, "🌾", "damp morning pasture", "gardens-pastures"],
  [296, "🌷", "cheerful daisy chain", "gardens-pastures"],
  [297, "🐝", "drone fly hover", "gardens-pastures"],
  [298, "🌸", "scattered blossom wind", "gardens-pastures"],
  [299, "🪴", "forgotten garden gate", "gardens-pastures"],
  [300, "🐞", "singing summer cicada", "gardens-pastures"],
  [301, "🏜️", "shimmering heat mirage", "savanna-desert"],
  [302, "🐪", "traversing camel caravan", "savanna-desert"],
  [303, "🌵", "towering saguaro cactus", "savanna-desert"],
  [304, "🦎", "darting collared lizard", "savanna-desert"],
  [305, "🏜️", "cracked mud playa", "savanna-desert"],
  [306, "🦁", "sleeping lion pride", "savanna-desert"],
  [307, "🌵", "prickly pear bloom", "savanna-desert"],
  [308, "🦎", "sunbathing desert iguana", "savanna-desert"],
  [309, "🏜️", "deep slot canyon", "savanna-desert"],
  [310, "🦒", "stretching acacia giraffe", "savanna-desert"],
  [311, "🌵", "sharp agave plant", "savanna-desert"],
  [312, "🦎", "buried horned toad", "savanna-desert"],
  [313, "🏜️", "towering sandstone mesa", "savanna-desert"],
  [314, "🐘", "dusty elephant herd", "savanna-desert"],
  [315, "🌵", "dry tumbleweed roll", "savanna-desert"],
  [316, "🦎", "slithering sidewinder snake", "savanna-desert"],
  [317, "🏜️", "vast empty salt flat", "savanna-desert"],
  [318, "🦓", "grazing zebra herd", "savanna-desert"],
  [319, "🌵", "jumping cholla branch", "savanna-desert"],
  [320, "🦎", "scurrying desert scorpion", "savanna-desert"],
  [321, "🏜️", "red rock hoodoo", "savanna-desert"],
  [322, "🦏", "charging rhino dust", "savanna-desert"],
  [323, "🌵", "blooming desert rose", "savanna-desert"],
  [324, "🦎", "clicking gecko tail", "savanna-desert"],
  [325, "🏜️", "shaded canyon overhang", "savanna-desert"],
  [326, "🐆", "sprinting cheetah plain", "savanna-desert"],
  [327, "🌵", "dry arroyo riverbed", "savanna-desert"],
  [328, "🦎", "curious meerkat burrow", "savanna-desert"],
  [329, "🏜️", "echoing canyon rim", "savanna-desert"],
  [330, "🐃", "wading water buffalo", "savanna-desert"],
  [331, "🌵", "lonely yucca plant", "savanna-desert"],
  [332, "🦎", "basking monitor lizard", "savanna-desert"],
  [333, "🏜️", "painted desert strata", "savanna-desert"],
  [334, "🦛", "yawning river hippo", "savanna-desert"],
  [335, "🌵", "tough creosote bush", "savanna-desert"],
  [336, "🦎", "striking rattlesnake coil", "savanna-desert"],
  [337, "🏜️", "wind-blown sand dune", "savanna-desert"],
  [338, "🦩", "wading flamingo flock", "savanna-desert"],
  [339, "🌵", "barrel cactus cluster", "savanna-desert"],
  [340, "🦎", "digging desert tortoise", "savanna-desert"],
  [341, "🏜️", "lonely desert highway", "savanna-desert"],
  [342, "🦅", "circling vulture thermal", "savanna-desert"],
  [343, "🌵", "blooming night cactus", "savanna-desert"],
  [344, "🦎", "running roadrunner trail", "savanna-desert"],
  [345, "🏜️", "steep canyon switchback", "savanna-desert"],
  [346, "🐒", "playful baboon troop", "savanna-desert"],
  [347, "🌵", "thorny mesquite tree", "savanna-desert"],
  [348, "🦎", "fuzzy tarantula burrow", "savanna-desert"],
  [349, "🏜️", "glowing canyon sunset", "savanna-desert"],
  [350, "🐾", "lonely coyote track", "savanna-desert"],
  [351, "☁️", "rolling fog bank", "skies-weather"],
  [352, "🌩️", "jagged lightning strike", "skies-weather"],
  [353, "🌈", "double rainbow arc", "skies-weather"],
  [354, "🌌", "dense star cluster", "skies-weather"],
  [355, "🌒", "waxing crescent moon", "skies-weather"],
  [356, "☁️", "high cirrus wisps", "skies-weather"],
  [357, "🌩️", "dark supercell cloud", "skies-weather"],
  [358, "🌈", "fading rainbow end", "skies-weather"],
  [359, "🌌", "swirling spiral galaxy", "skies-weather"],
  [360, "🌒", "pale daytime moon", "skies-weather"],
  [361, "☁️", "low hanging overcast", "skies-weather"],
  [362, "🌩️", "distant thunder rumble", "skies-weather"],
  [363, "🌈", "misty waterfall bow", "skies-weather"],
  [364, "🌌", "glowing nebula dust", "skies-weather"],
  [365, "🌒", "blood red eclipse", "skies-weather"],
  [366, "☁️", "puffy cumulus shadow", "skies-weather"],
  [367, "🌩️", "sudden hail storm", "skies-weather"],
  [368, "🌈", "rare moonbow arc", "skies-weather"],
  [369, "🌌", "bright shooting star", "skies-weather"],
  [370, "🌒", "silvery full moon", "skies-weather"],
  [371, "☁️", "colorful sunset cirrus", "skies-weather"],
  [372, "🌩️", "pouring monsoon rain", "skies-weather"],
  [373, "🌈", "fractured prism light", "skies-weather"],
  [374, "🌌", "tracking satellite light", "skies-weather"],
  [375, "🌒", "hiding new moon", "skies-weather"],
  [376, "☁️", "turbulent storm front", "skies-weather"],
  [377, "🌩️", "silent heat lightning", "skies-weather"],
  [378, "🌈", "bright sundog halo", "skies-weather"],
  [379, "🌌", "endless deep space", "skies-weather"],
  [380, "🌒", "rising harvest moon", "skies-weather"],
  [381, "☁️", "pink cotton candy sky", "skies-weather"],
  [382, "🌩️", "freezing ice storm", "skies-weather"],
  [383, "🌈", "iridescent cloud edge", "skies-weather"],
  [384, "🌌", "clear night horizon", "skies-weather"],
  [385, "🌒", "orange moonrise", "skies-weather"],
  [386, "☁️", "dramatic crepuscular rays", "skies-weather"],
  [387, "🌩️", "gentle spring drizzle", "skies-weather"],
  [388, "🌈", "sun shower sparkle", "skies-weather"],
  [389, "🌌", "faint meteor trail", "skies-weather"],
  [390, "🌒", "setting morning moon", "skies-weather"],
  [391, "☁️", "flat stratus blanket", "skies-weather"],
  [392, "🌩️", "swirling tornado funnel", "skies-weather"],
  [393, "🌈", "dew drop spectrum", "skies-weather"],
  [394, "🌌", "quiet backyard observatory", "skies-weather"],
  [395, "🌒", "waning gibbous moon", "skies-weather"],
  [396, "☁️", "golden hour sky", "skies-weather"],
  [397, "🌩️", "heavy snow squall", "skies-weather"],
  [398, "🌈", "puddle oil slick rainbow", "skies-weather"],
  [399, "🌌", "dancing northern lights", "skies-weather"],
  [400, "🌒", "starry night reflection", "skies-weather"],
  [401, "🧺", "picnic blanket on soft moss", "fairycore"],
  [402, "🍓", "creeping wild strawberry vines", "fairycore"],
  [403, "🦋", "flutter of white gossamer moths", "fairycore"],
  [404, "🍯", "sun-warmed dripping honeycomb", "fairycore"],
  [405, "🍄", "tiny glass-like terrarium mushrooms", "fairycore"],
  [406, "🫖", "tea leaves floating in a brook", "fairycore"],
  [407, "🌼", "delicate braided daisy crown", "fairycore"],
  [408, "🧺", "wicker foraging basket in tall grass", "fairycore"],
  [409, "🐌", "opalescent snail shell on ivy", "fairycore"],
  [410, "🪵", "sunlit birch wood chopping block", "fairycore"],
  [411, "🌿", "overgrown forgotten garden gate", "fairycore"],
  [412, "🍎", "fallen crabapples in the dew", "fairycore"],
  [413, "🪶", "dappled sunlight on a blue jay feather", "fairycore"],
  [414, "🍄", "velvet red toadstool cluster", "fairycore"],
  [415, "🍃", "hollowed-out acorn cup", "fairycore"],
  [416, "🌳", "hollow ancient tree library", "fairycore"],
  [417, "🌸", "wild rose petals on a dirt path", "fairycore"],
  [418, "🫐", "bursting wild blueberry bush", "fairycore"],
  [419, "🌿", "thick ivy climbing a stone ruin", "fairycore"],
  [420, "🌻", "overgrown sunflower leaning on a fence", "fairycore"],
  [421, "🦋", "sleeping swallowtail butterfly", "fairycore"],
  [422, "🐌", "silver snail trail on dark wood", "fairycore"],
  [423, "🪺", "pale blue robin eggs in a nest", "fairycore"],
  [424, "🌱", "fuzzy curled fern frond", "fairycore"],
  [425, "🕸️", "dew-beaded spider web hammock", "fairycore"],
  [426, "🐿️", "hoarded hazelnuts in a knothole", "fairycore"],
  [427, "🌼", "field of blooming chamomile", "fairycore"],
  [428, "🌳", "tree roots forming a natural staircase", "fairycore"],
  [429, "🪵", "lichen-covered stepping stones", "fairycore"],
  [430, "🌿", "clover patch with hidden four-leaves", "fairycore"],
  [431, "🌸", "soft pink cherry blossom snow", "fairycore"],
  [432, "🍄", "miniature fairy ring of puffballs", "fairycore"],
  [433, "🍂", "crisp curled oak leaf boat", "fairycore"],
  [434, "🐦", "gentle mourning dove roost", "fairycore"],
  [435, "🌱", "sprouting green bean tendrils", "fairycore"],
  [436, "🍯", "amber tree sap droplet", "fairycore"],
  [437, "🌿", "lush green mossy overhang", "fairycore"],
  [438, "🦋", "monarch butterfly chrysalis", "fairycore"],
  [439, "🪵", "peeling white birch bark", "fairycore"],
  [440, "🌼", "wild buttercups under the chin", "fairycore"],
  [441, "🍃", "sun-transparent maple leaf", "fairycore"],
  [442, "🍄", "glowing foxfire fungi", "fairycore"],
  [443, "🐦", "stray bluebird feather in the breeze", "fairycore"],
  [444, "🌿", "sweet-smelling mint patch", "fairycore"],
  [445, "🐝", "fuzzy bumblebee resting on lavender", "fairycore"],
  [446, "🕸️", "frosty gossamer web threads", "fairycore"],
  [447, "🌱", "tiny seedling pushing through soil", "fairycore"],
  [448, "🪵", "hollow log filled with wildflowers", "fairycore"],
  [449, "🌿", "damp earthy smelling underbrush", "fairycore"],
  [450, "🦋", "iridescent blue wing resting on stone", "fairycore"],
  [451, "🌊", "glowing blue neon tide", "bioluminescent"],
  [452, "🍄", "luminescent green ghost mushrooms", "bioluminescent"],
  [453, "🐛", "glowing wireworm cave ceiling", "bioluminescent"],
  [454, "🦑", "flashing deep-sea squid", "bioluminescent"],
  [455, "🌊", "sparkling dinoflagellate surf", "bioluminescent"],
  [456, "🪲", "synchronous flashing fireflies", "bioluminescent"],
  [457, "🌊", "bioluminescent footprint in wet sand", "bioluminescent"],
  [458, "🪸", "glowing ultraviolet coral reef", "bioluminescent"],
  [459, "🌌", "starlight reflecting on a dark lagoon", "bioluminescent"],
  [460, "🐛", "glowing glowworm silk threads", "bioluminescent"],
  [461, "🌊", "neon blue wave crest", "bioluminescent"],
  [462, "🍄", "glowing panellus stipticus log", "bioluminescent"],
  [463, "🪲", "green glowing click beetle", "bioluminescent"],
  [464, "🌊", "shimmering midnight seafoam", "bioluminescent"],
  [465, "🌌", "radiant bioluminescent bay", "bioluminescent"],
  [466, "🪸", "fluorescent pink sea anemone", "bioluminescent"],
  [467, "🐛", "glowing cave ceiling constellation", "bioluminescent"],
  [468, "🌊", "electric blue ocean splash", "bioluminescent"],
  [469, "🍄", "glowing fairy fire wood", "bioluminescent"],
  [470, "🪲", "firefly trapped in a dewdrop", "bioluminescent"],
  [471, "🌊", "glowing wake behind a midnight boat", "bioluminescent"],
  [472, "🪸", "glowing neon green polyps", "bioluminescent"],
  [473, "🌌", "starry reflection in a still puddle", "bioluminescent"],
  [474, "🐛", "glowing millipede in the leaf litter", "bioluminescent"],
  [475, "🌊", "glowing blue sand grains", "bioluminescent"],
  [476, "🍄", "faint glowing forest floor", "bioluminescent"],
  [477, "🪲", "firefly flashing in a jar", "bioluminescent"],
  [478, "🌊", "glowing blue plankton bloom", "bioluminescent"],
  [479, "🪸", "glowing orange sea pen", "bioluminescent"],
  [480, "🌌", "glowing meteor dust reflection", "bioluminescent"],
  [481, "🐛", "glowing railroad worm", "bioluminescent"],
  [482, "🌊", "glowing blue shore break", "bioluminescent"],
  [483, "🍄", "glowing jack-o-lantern mushroom", "bioluminescent"],
  [484, "🪲", "glowing green insect larvae", "bioluminescent"],
  [485, "🌊", "glowing water droplet splashing", "bioluminescent"],
  [486, "🪸", "glowing yellow sponge", "bioluminescent"],
  [487, "🌌", "glowing moonlit mist", "bioluminescent"],
  [488, "🐛", "glowing aquatic snail", "bioluminescent"],
  [489, "🌊", "glowing blue tidal pool", "bioluminescent"],
  [490, "🍄", "glowing mycelium network", "bioluminescent"],
  [491, "🪲", "glowing firefly swarm in a meadow", "bioluminescent"],
  [492, "🌊", "glowing blue sea sparkles", "bioluminescent"],
  [493, "🪸", "glowing purple soft coral", "bioluminescent"],
  [494, "🌌", "glowing aurora reflection on ice", "bioluminescent"],
  [495, "🐛", "glowing cave worm drip", "bioluminescent"],
  [496, "🌊", "glowing blue wave crash", "bioluminescent"],
  [497, "🍄", "glowing white fungi", "bioluminescent"],
  [498, "🪲", "glowing firefly mating dance", "bioluminescent"],
  [499, "🌊", "glowing blue ocean swirl", "bioluminescent"],
  [500, "🪸", "glowing deep sea jellyfish", "bioluminescent"],
  [501, "🌸", "pastel pink weeping cherry tree", "pastel-blooms"],
  [502, "🌺", "soft peach hibiscus bloom", "pastel-blooms"],
  [503, "🌷", "pale yellow tulip field", "pastel-blooms"],
  [504, "🌸", "lavender wisteria tunnel", "pastel-blooms"],
  [505, "🌺", "baby blue hydrangea bush", "pastel-blooms"],
  [506, "🌷", "mint green succulent rosette", "pastel-blooms"],
  [507, "🌸", "soft lilac lilac bush", "pastel-blooms"],
  [508, "🌺", "blush pink peony bud", "pastel-blooms"],
  [509, "🌷", "creamy white magnolia blossom", "pastel-blooms"],
  [510, "🌸", "pale violet morning glory", "pastel-blooms"],
  [511, "🌺", "soft coral poppy field", "pastel-blooms"],
  [512, "🌷", "light blue forget-me-not patch", "pastel-blooms"],
  [513, "🌸", "pale pink sweet pea vine", "pastel-blooms"],
  [514, "🌺", "soft yellow primrose bed", "pastel-blooms"],
  [515, "🌷", "baby pink carnation field", "pastel-blooms"],
  [516, "🌸", "pale lavender aster cluster", "pastel-blooms"],
  [517, "🌺", "soft peach ranunculus bloom", "pastel-blooms"],
  [518, "🌷", "light yellow daffodil hill", "pastel-blooms"],
  [519, "🌸", "blush pink snapdragon stalk", "pastel-blooms"],
  [520, "🌺", "soft purple crocus peeking through snow", "pastel-blooms"],
  [521, "🌷", "pale pink cosmos field", "pastel-blooms"],
  [522, "🌸", "light blue delphinium spire", "pastel-blooms"],
  [523, "🌺", "soft yellow freesia bloom", "pastel-blooms"],
  [524, "🌷", "pale lavender scabiosa flower", "pastel-blooms"],
  [525, "🌸", "baby pink astilbe plume", "pastel-blooms"],
  [526, "🌺", "soft peach amaryllis blossom", "pastel-blooms"],
  [527, "🌷", "light blue cornflower patch", "pastel-blooms"],
  [528, "🌸", "pale pink yarrow cluster", "pastel-blooms"],
  [529, "🌺", "soft yellow marigold border", "pastel-blooms"],
  [530, "🌷", "baby blue lobelia cascade", "pastel-blooms"],
  [531, "🌸", "pale lavender heliotrope bloom", "pastel-blooms"],
  [532, "🌺", "soft pink dianthus border", "pastel-blooms"],
  [533, "🌷", "light yellow coreopsis field", "pastel-blooms"],
  [534, "🌸", "blush pink zinnia patch", "pastel-blooms"],
  [535, "🌺", "soft purple verbena cluster", "pastel-blooms"],
  [536, "🌷", "pale pink gaillardia bloom", "pastel-blooms"],
  [537, "🌸", "light blue columbine flower", "pastel-blooms"],
  [538, "🌺", "soft yellow rudbeckia field", "pastel-blooms"],
  [539, "🌷", "baby pink echinacea blossom", "pastel-blooms"],
  [540, "🌸", "pale lavender monarda cluster", "pastel-blooms"],
  [541, "🌺", "soft peach lantana bloom", "pastel-blooms"],
  [542, "🌷", "light blue agapanthus globe", "pastel-blooms"],
  [543, "🌸", "blush pink phlox border", "pastel-blooms"],
  [544, "🌺", "soft yellow daylily bloom", "pastel-blooms"],
  [545, "🌷", "pale pink heuchera foliage", "pastel-blooms"],
  [546, "🌸", "light blue campanula bell", "pastel-blooms"],
  [547, "🌺", "soft purple salvia spike", "pastel-blooms"],
  [548, "🌷", "baby pink penstemon stalk", "pastel-blooms"],
  [549, "🌸", "pale lavender stokesia bloom", "pastel-blooms"],
  [550, "🌺", "soft peach geum flower", "pastel-blooms"],
  [551, "🌧️", "pouring rain on a tin roof", "moody-rain"],
  [552, "🌫️", "thick gray morning fog", "moody-rain"],
  [553, "🌲", "dark brooding pine forest", "moody-rain"],
  [554, "🍂", "wet decaying autumn leaves", "moody-rain"],
  [555, "🌧️", "raindrops racing on a windowpane", "moody-rain"],
  [556, "🌫️", "mist rolling over a dark loch", "moody-rain"],
  [557, "🌲", "shadowy moss-draped oak", "moody-rain"],
  [558, "🍂", "damp earthy peat bog", "moody-rain"],
  [559, "🌧️", "puddles reflecting gray skies", "moody-rain"],
  [560, "🌫️", "fog obscuring a mountain peak", "moody-rain"],
  [561, "🌲", "dark silhouetted treeline", "moody-rain"],
  [562, "🍂", "wet cracked cobblestone path", "moody-rain"],
  [563, "🌧️", "heavy rain bending tree branches", "moody-rain"],
  [564, "🌫️", "low hanging storm clouds", "moody-rain"],
  [565, "🌲", "dark deep woods trail", "moody-rain"],
  [566, "🍂", "soggy abandoned bird nest", "moody-rain"],
  [567, "🌧️", "rain splashing in a muddy puddle", "moody-rain"],
  [568, "🌫️", "thick fog rolling off the ocean", "moody-rain"],
  [569, "🌲", "dark shadowed ravine", "moody-rain"],
  [570, "🍂", "wet rotting fallen log", "moody-rain"],
  [571, "🌧️", "gentle rain on a calm lake", "moody-rain"],
  [572, "🌫️", "misty shrouded valley", "moody-rain"],
  [573, "🌲", "dark tangled briar patch", "moody-rain"],
  [574, "🍂", "damp lichen-covered rock", "moody-rain"],
  [575, "🌧️", "torrential downpour in a forest", "moody-rain"],
  [576, "🌫️", "fog hovering over a swamp", "moody-rain"],
  [577, "🌲", "dark looming mountain ridge", "moody-rain"],
  [578, "🍂", "wet muddy boot tracks", "moody-rain"],
  [579, "🌧️", "raindrops clinging to pine needles", "moody-rain"],
  [580, "🌫️", "misty twilight meadow", "moody-rain"],
  [581, "🌲", "dark foreboding thicket", "moody-rain"],
  [582, "🍂", "damp peeling bark", "moody-rain"],
  [583, "🌧️", "rain dripping from a roof eaves", "moody-rain"],
  [584, "🌫️", "fog hiding the horizon", "moody-rain"],
  [585, "🌲", "dark silent winter woods", "moody-rain"],
  [586, "🍂", "wet matted animal fur", "moody-rain"],
  [587, "🌧️", "heavy rain washing away tracks", "moody-rain"],
  [588, "🌫️", "misty morning marsh", "moody-rain"],
  [589, "🌲", "dark shadowed canyon walls", "moody-rain"],
  [590, "🍂", "damp decaying bracket fungi", "moody-rain"],
  [591, "🌧️", "rain pockmarking a still pond", "moody-rain"],
  [592, "🌫️", "fog rolling through a city park", "moody-rain"],
  [593, "🌲", "dark ominous storm front", "moody-rain"],
  [594, "🍂", "wet slippery river rocks", "moody-rain"],
  [595, "🌧️", "gentle drizzle on a spring morning", "moody-rain"],
  [596, "🌫️", "misty shrouded island", "moody-rain"],
  [597, "🌲", "dark impenetrable jungle", "moody-rain"],
  [598, "🍂", "damp mossy stump", "moody-rain"],
  [599, "🌧️", "heavy rain flooding a creek", "moody-rain"],
  [600, "🌫️", "thick pea-soup fog", "moody-rain"],
  [601, "🍁", "brilliant red maple canopy", "autumn-harvest"],
  [602, "🍂", "golden yellow aspen grove", "autumn-harvest"],
  [603, "🎃", "bright orange pumpkin patch", "autumn-harvest"],
  [604, "🍎", "crisp red apple orchard", "autumn-harvest"],
  [605, "🌾", "dry brown corn stalk bundle", "autumn-harvest"],
  [606, "🍁", "burnt orange oak leaves", "autumn-harvest"],
  [607, "🍂", "deep burgundy sumac bush", "autumn-harvest"],
  [608, "🎃", "pale white ghost pumpkin", "autumn-harvest"],
  [609, "🍎", "fallen green apples on the ground", "autumn-harvest"],
  [610, "🌾", "golden wheat ready for harvest", "autumn-harvest"],
  [611, "🍁", "crunchy pile of dry leaves", "autumn-harvest"],
  [612, "🍂", "yellow birch leaves falling", "autumn-harvest"],
  [613, "🎃", "bumpy green gourd vines", "autumn-harvest"],
  [614, "🍎", "basket of freshly picked apples", "autumn-harvest"],
  [615, "🌾", "dry rustling autumn grass", "autumn-harvest"],
  [616, "🍁", "dark red sweetgum leaves", "autumn-harvest"],
  [617, "🍂", "golden hickory tree leaves", "autumn-harvest"],
  [618, "🎃", "carved glowing jack-o-lantern", "autumn-harvest"],
  [619, "🍎", "apple cider press in a barn", "autumn-harvest"],
  [620, "🌾", "rolled golden hay bales", "autumn-harvest"],
  [621, "🍁", "scattered leaves on a wet road", "autumn-harvest"],
  [622, "🍂", "yellow ginkgo leaves falling", "autumn-harvest"],
  [623, "🎃", "large orange prize pumpkin", "autumn-harvest"],
  [624, "🍎", "half-eaten apple left by a deer", "autumn-harvest"],
  [625, "🌾", "dry brown cattails by a pond", "autumn-harvest"],
  [626, "🍁", "brilliant orange sassafras leaves", "autumn-harvest"],
  [627, "🍂", "dark brown curled oak leaves", "autumn-harvest"],
  [628, "🎃", "green striped acorn squash", "autumn-harvest"],
  [629, "🍎", "apple blossoms fading to fruit", "autumn-harvest"],
  [630, "🌾", "golden oat field swaying", "autumn-harvest"],
  [631, "🍁", "frosted edges on a red leaf", "autumn-harvest"],
  [632, "🍂", "yellow poplar leaves falling", "autumn-harvest"],
  [633, "🎃", "small orange sugar pumpkins", "autumn-harvest"],
  [634, "🍎", "rotting apples fermenting on the ground", "autumn-harvest"],
  [635, "🌾", "dry brittle autumn weeds", "autumn-harvest"],
  [636, "🍁", "deep red dogwood leaves", "autumn-harvest"],
  [637, "🍂", "golden beech tree canopy", "autumn-harvest"],
  [638, "🎃", "white and orange ornamental gourds", "autumn-harvest"],
  [639, "🍎", "worm crawling out of an apple", "autumn-harvest"],
  [640, "🌾", "harvested field of stubble", "autumn-harvest"],
  [641, "🍁", "wind blowing leaves in a swirl", "autumn-harvest"],
  [642, "🍂", "yellow willow leaves dropping", "autumn-harvest"],
  [643, "🎃", "large warty green pumpkin", "autumn-harvest"],
  [644, "🍎", "bright red crabapples on a branch", "autumn-harvest"],
  [645, "🌾", "dry brown seed pods rattling", "autumn-harvest"],
  [646, "🍁", "dark purple ash leaves", "autumn-harvest"],
  [647, "🍂", "golden elm leaves falling", "autumn-harvest"],
  [648, "🎃", "twisted dry pumpkin vines", "autumn-harvest"],
  [649, "🍎", "apple core thrown in the woods", "autumn-harvest"],
  [650, "🌾", "dry golden rod stalks", "autumn-harvest"],
  [651, "🪨", "perfectly balanced stacked stones", "zen"],
  [652, "🎋", "single curved bamboo shoot", "zen"],
  [653, "💧", "single drop rippling a still pond", "zen"],
  [654, "🍃", "floating lotus leaf in a bowl", "zen"],
  [655, "🪨", "smooth black river stone", "zen"],
  [656, "🎋", "raked sand garden swirls", "zen"],
  [657, "💧", "slow dripping bamboo water feature", "zen"],
  [658, "🍃", "single falling cherry blossom", "zen"],
  [659, "🪨", "moss-covered garden rock", "zen"],
  [660, "🎋", "straight rows of green bamboo", "zen"],
  [661, "💧", "perfectly still reflective pool", "zen"],
  [662, "🍃", "solitary bonsai pine tree", "zen"],
  [663, "🪨", "flat grey slate stepping stone", "zen"],
  [664, "🎋", "dry bamboo stalk tapping", "zen"],
  [665, "💧", "clear shallow stream over pebbles", "zen"],
  [666, "🍃", "single yellow ginkgo leaf on stone", "zen"],
  [667, "🪨", "rough granite lantern base", "zen"],
  [668, "🎋", "small bamboo water spout", "zen"],
  [669, "💧", "morning dew on a blade of grass", "zen"],
  [670, "🍃", "minimalist white orchid bloom", "zen"],
  [671, "🪨", "smooth white quartzite pebble", "zen"],
  [672, "🎋", "woven bamboo garden fence", "zen"],
  [673, "💧", "mist rising from a hot spring", "zen"],
  [674, "🍃", "solitary fern in a shaded corner", "zen"],
  [675, "🪨", "large round boulder in sand", "zen"],
  [676, "🎋", "green bamboo leaves rustling", "zen"],
  [677, "💧", "slow melting ice icicle", "zen"],
  [678, "🍃", "single red maple leaf on snow", "zen"],
  [679, "🪨", "mossy stone basin", "zen"],
  [680, "🎋", "hollow bamboo wind chime", "zen"],
  [681, "💧", "perfectly circular water ripple", "zen"],
  [682, "🍃", "minimalist arrangement of dry twigs", "zen"],
  [683, "🪨", "smooth jade green stone", "zen"],
  [684, "🎋", "small bamboo water ladle", "zen"],
  [685, "💧", "clear water trickling over moss", "zen"],
  [686, "🍃", "single blooming water lily", "zen"],
  [687, "🪨", "rough volcanic rock in sand", "zen"],
  [688, "🎋", "thick grove of mature bamboo", "zen"],
  [689, "💧", "frost melting on a window", "zen"],
  [690, "🍃", "solitary pinecone on a rock", "zen"],
  [691, "🪨", "smooth brown agate pebble", "zen"],
  [692, "🎋", "dry split bamboo stalk", "zen"],
  [693, "💧", "slow dripping stalactite", "zen"],
  [694, "🍃", "single blade of sweetgrass", "zen"],
  [695, "🪨", "mossy stone steps", "zen"],
  [696, "🎋", "delicate bamboo shoots emerging", "zen"],
  [697, "💧", "clear water well reflecting sky", "zen"],
  [698, "🍃", "minimalist ikebana arrangement", "zen"],
  [699, "🪨", "smooth black obsidian pebble", "zen"],
  [700, "🎋", "small bamboo bridge over water", "zen"],
  [701, "🌊", "frosted sea glass pieces in sand", "ethereal-coast"],
  [702, "🐚", "pearlescent inside of an abalone shell", "ethereal-coast"],
  [703, "🌊", "soft pastel sunrise over the ocean", "ethereal-coast"],
  [704, "🐚", "smooth white sand dollar", "ethereal-coast"],
  [705, "🌊", "gentle turquoise waves lapping", "ethereal-coast"],
  [706, "🐚", "spiraled pink conch shell", "ethereal-coast"],
  [707, "🌊", "misty fog rolling off the sea", "ethereal-coast"],
  [708, "🐚", "small perfect nautilus shell", "ethereal-coast"],
  [709, "🌊", "soft white sea foam settling", "ethereal-coast"],
  [710, "🐚", "tiny intricate cowrie shell", "ethereal-coast"],
  [711, "🌊", "pale blue ocean horizon", "ethereal-coast"],
  [712, "🐚", "rough grey barnacle cluster", "ethereal-coast"],
  [713, "🌊", "sparkling sunlit ocean surface", "ethereal-coast"],
  [714, "🐚", "smooth dark blue mussel shell", "ethereal-coast"],
  [715, "🌊", "gentle rolling ocean swell", "ethereal-coast"],
  [716, "🐚", "spiky murex sea shell", "ethereal-coast"],
  [717, "🌊", "soft pink sunset reflecting on water", "ethereal-coast"],
  [718, "🐚", "small delicate scallop shell", "ethereal-coast"],
  [719, "🌊", "misty ocean spray from a blowhole", "ethereal-coast"],
  [720, "🐚", "large twisted whelk shell", "ethereal-coast"],
  [721, "🌊", "pale green shallow ocean water", "ethereal-coast"],
  [722, "🐚", "rough grey oyster shell", "ethereal-coast"],
  [723, "🌊", "sparkling moonlight on the sea", "ethereal-coast"],
  [724, "🐚", "smooth brown olive shell", "ethereal-coast"],
  [725, "🌊", "gentle current carrying seaweed", "ethereal-coast"],
  [726, "🐚", "small perfect limpet shell", "ethereal-coast"],
  [727, "🌊", "soft grey overcast ocean day", "ethereal-coast"],
  [728, "🐚", "rough spiny sea urchin test", "ethereal-coast"],
  [729, "🌊", "misty rain falling on the sea", "ethereal-coast"],
  [730, "🐚", "large flat clam shell", "ethereal-coast"],
  [731, "🌊", "pale yellow sunrise over water", "ethereal-coast"],
  [732, "🐚", "smooth white moon snail shell", "ethereal-coast"],
  [733, "🌊", "sparkling starlight reflecting on waves", "ethereal-coast"],
  [734, "🐚", "tiny delicate auger shell", "ethereal-coast"],
  [735, "🌊", "gentle tide pulling sand away", "ethereal-coast"],
  [736, "🐚", "rough grey cockle shell", "ethereal-coast"],
  [737, "🌊", "soft purple twilight over the ocean", "ethereal-coast"],
  [738, "🐚", "large spiraled tulip shell", "ethereal-coast"],
  [739, "🌊", "misty fog hiding the coastline", "ethereal-coast"],
  [740, "🐚", "smooth white wentletrap shell", "ethereal-coast"],
  [741, "🌊", "pale pink dawn over the sea", "ethereal-coast"],
  [742, "🐚", "rough grey razor clam shell", "ethereal-coast"],
  [743, "🌊", "sparkling sunbeams piercing the water", "ethereal-coast"],
  [744, "🐚", "small perfect tusk shell", "ethereal-coast"],
  [745, "🌊", "gentle ripples in a tide pool", "ethereal-coast"],
  [746, "🐚", "large flat pen shell", "ethereal-coast"],
  [747, "🌊", "soft orange sunset over water", "ethereal-coast"],
  [748, "🐚", "rough grey geoduck shell", "ethereal-coast"],
  [749, "🌊", "misty sea breeze blowing grass", "ethereal-coast"],
  [750, "🐚", "smooth white bubble shell", "ethereal-coast"],
  [751, "💎", "geometric bismuth crystal formation", "crystal-frost"],
  [752, "❄️", "intricate symmetrical snowflake", "crystal-frost"],
  [753, "🧊", "pale blue glacier ice", "crystal-frost"],
  [754, "💎", "raw purple amethyst geode", "crystal-frost"],
  [755, "❄️", "heavy hoarfrost on a pine branch", "crystal-frost"],
  [756, "🧊", "clear sharp hanging icicle", "crystal-frost"],
  [757, "💎", "rough pink rose quartz chunk", "crystal-frost"],
  [758, "❄️", "delicate frost patterns on glass", "crystal-frost"],
  [759, "🧊", "deep blue crevasse in a glacier", "crystal-frost"],
  [760, "💎", "smooth clear quartz point", "crystal-frost"],
  [761, "❄️", "freezing rain coating a leaf", "crystal-frost"],
  [762, "🧊", "large floating iceberg table", "crystal-frost"],
  [763, "💎", "dark green malachite swirl", "crystal-frost"],
  [764, "❄️", "frozen spiderweb covered in frost", "crystal-frost"],
  [765, "🧊", "frozen solid river rapids", "crystal-frost"],
  [766, "💎", "golden sparkling pyrite cube", "crystal-frost"],
  [767, "❄️", "frozen morning dew on grass", "crystal-frost"],
  [768, "🧊", "slow moving glacier front", "crystal-frost"],
  [769, "💎", "bright blue azurite cluster", "crystal-frost"],
  [770, "❄️", "crisp frozen puddle surface", "crystal-frost"],
  [771, "🧊", "sharp jagged ice serac", "crystal-frost"],
  [772, "💎", "pale blue celestite geode", "crystal-frost"],
  [773, "❄️", "freezing fog riming a tree", "crystal-frost"],
  [774, "🧊", "dark frozen lake surface", "crystal-frost"],
  [775, "💎", "dark black obsidian shard", "crystal-frost"],
  [776, "❄️", "thick rime ice on a mountain peak", "crystal-frost"],
  [777, "🧊", "meltwater pool on a glacier", "crystal-frost"],
  [778, "💎", "bright red ruby raw crystal", "crystal-frost"],
  [779, "❄️", "frozen breath in the cold air", "crystal-frost"],
  [780, "🧊", "small bergy bit floating in water", "crystal-frost"],
  [781, "💎", "dark green emerald rough stone", "crystal-frost"],
  [782, "❄️", "delicate frost flowers on ice", "crystal-frost"],
  [783, "🧊", "frozen waterfall mid-cascade", "crystal-frost"],
  [784, "💎", "pale yellow citrine cluster", "crystal-frost"],
  [785, "❄️", "frozen solid mud puddle", "crystal-frost"],
  [786, "🧊", "sharp ice crystals on a window", "crystal-frost"],
  [787, "💎", "dark blue lapis lazuli stone", "crystal-frost"],
  [788, "❄️", "thick heavy snow bending branches", "crystal-frost"],
  [789, "🧊", "large block of clear lake ice", "crystal-frost"],
  [790, "💎", "bright orange carnelian agate", "crystal-frost"],
  [791, "❄️", "frozen berries on a bush", "crystal-frost"],
  [792, "🧊", "glacial meltwater stream", "crystal-frost"],
  [793, "💎", "dark purple fluorite octahedron", "crystal-frost"],
  [794, "❄️", "frozen river banks", "crystal-frost"],
  [795, "🧊", "small piece of brash ice", "crystal-frost"],
  [796, "💎", "pale blue aquamarine crystal", "crystal-frost"],
  [797, "❄️", "frozen rain on a windshield", "crystal-frost"],
  [798, "🧊", "deep ice cave tunnel", "crystal-frost"],
  [799, "💎", "bright pink tourmaline crystal", "crystal-frost"],
  [800, "❄️", "frozen solid ground", "crystal-frost"],
  [801, "🌵", "dusty green agave leaves", "desert-boho"],
  [802, "🏜️", "pale terracotta sand dunes", "desert-boho"],
  [803, "☀️", "bright blinding desert sun", "desert-boho"],
  [804, "🌵", "dried pale tumbleweed", "desert-boho"],
  [805, "🏜️", "sun-bleached animal skull", "desert-boho"],
  [806, "☀️", "harsh midday shadows on rock", "desert-boho"],
  [807, "🌵", "pale green prickly pear pads", "desert-boho"],
  [808, "🏜️", "cracked dry lake bed mud", "desert-boho"],
  [809, "☀️", "warm golden hour desert light", "desert-boho"],
  [810, "🌵", "blooming pink desert rose", "desert-boho"],
  [811, "🏜️", "smooth wind-carved sandstone", "desert-boho"],
  [812, "☀️", "hazy heat distortion on the horizon", "desert-boho"],
  [813, "🌵", "tall ribbed saguaro trunk", "desert-boho"],
  [814, "🏜️", "scattered dry desert scrub", "desert-boho"],
  [815, "☀️", "pale washed-out desert sky", "desert-boho"],
  [816, "🌵", "fuzzy yellow cholla cactus", "desert-boho"],
  [817, "🏜️", "dark red iron-rich rock", "desert-boho"],
  [818, "☀️", "bright sun flare over a mesa", "desert-boho"],
  [819, "🌵", "small round barrel cactus", "desert-boho"],
  [820, "🏜️", "dusty unpaved desert road", "desert-boho"],
  [821, "☀️", "warm orange desert sunset", "desert-boho"],
  [822, "🌵", "spiky green yucca plant", "desert-boho"],
  [823, "🏜️", "loose shifting sand dune face", "desert-boho"],
  [824, "☀️", "harsh bright light on white sand", "desert-boho"],
  [825, "🌵", "thin wiry ocotillo branches", "desert-boho"],
  [826, "🏜️", "dark shadowed slot canyon", "desert-boho"],
  [827, "☀️", "pale yellow desert sunrise", "desert-boho"],
  [828, "🌵", "blooming white night-blooming cereus", "desert-boho"],
  [829, "🏜️", "scattered pale river rocks", "desert-boho"],
  [830, "☀️", "bright blinding salt flat", "desert-boho"],
  [831, "🌵", "small green hedgehog cactus", "desert-boho"],
  [832, "🏜️", "dusty dry wash", "desert-boho"],
  [833, "☀️", "warm pink desert twilight", "desert-boho"],
  [834, "🌵", "dried brown agave flower stalk", "desert-boho"],
  [835, "🏜️", "smooth eroded badlands hills", "desert-boho"],
  [836, "☀️", "pale blue sky over red rocks", "desert-boho"],
  [837, "🌵", "blooming yellow prickly pear flower", "desert-boho"],
  [838, "🏜️", "scattered black volcanic rocks", "desert-boho"],
  [839, "☀️", "bright sun peeking through a rock arch", "desert-boho"],
  [840, "🌵", "small fuzzy old man cactus", "desert-boho"],
  [841, "🏜️", "dusty green creosote bush", "desert-boho"],
  [842, "☀️", "warm purple desert evening", "desert-boho"],
  [843, "🌵", "dried brittle bush leaves", "desert-boho"],
  [844, "🏜️", "smooth pale limestone rock", "desert-boho"],
  [845, "☀️", "harsh shadows in a rocky canyon", "desert-boho"],
  [846, "🌵", "blooming red claret cup cactus", "desert-boho"],
  [847, "🏜️", "scattered pale fossil shells", "desert-boho"],
  [848, "☀️", "bright blinding reflection on sand", "desert-boho"],
  [849, "🌵", "small flat beaver tail cactus", "desert-boho"],
  [850, "🏜️", "dusty dry desert pavement", "desert-boho"],
  [851, "☁️", "cotton candy pink cirrus clouds", "celestial"],
  [852, "🌌", "dense glittering Milky Way band", "celestial"],
  [853, "☀️", "brilliant golden crepuscular rays", "celestial"],
  [854, "☁️", "layered purple twilight stratus", "celestial"],
  [855, "🌌", "pale glowing Andromeda galaxy", "celestial"],
  [856, "☀️", "bright halo around a high sun", "celestial"],
  [857, "☁️", "puffy white cumulus on blue", "celestial"],
  [858, "🌌", "bright streak of a meteor", "celestial"],
  [859, "☀️", "warm orange glow on the horizon", "celestial"],
  [860, "☁️", "dark dramatic cumulonimbus anvil", "celestial"],
  [861, "🌌", "shimmering green aurora curtain", "celestial"],
  [862, "☀️", "bright blinding sun reflection", "celestial"],
  [863, "☁️", "wispy mare's tail clouds", "celestial"],
  [864, "🌌", "dense star field in a dark sky", "celestial"],
  [865, "☀️", "pale yellow winter sun", "celestial"],
  [866, "☁️", "smooth lenticular cloud over a peak", "celestial"],
  [867, "🌌", "bright glowing planet Venus", "celestial"],
  [868, "☀️", "warm red setting sun disk", "celestial"],
  [869, "☁️", "ribbed mackerel sky pattern", "celestial"],
  [870, "🌌", "swirling red emission nebula", "celestial"],
  [871, "☀️", "bright sun flare through trees", "celestial"],
  [872, "☁️", "low hanging dark scud clouds", "celestial"],
  [873, "🌌", "bright glowing Orion nebula", "celestial"],
  [874, "☀️", "pale pink morning dawn light", "celestial"],
  [875, "☁️", "high thin altostratus veil", "celestial"],
  [876, "🌌", "dense glittering star cluster", "celestial"],
  [877, "☀️", "warm orange alpenglow on a peak", "celestial"],
  [878, "☁️", "billowing dramatic storm front", "celestial"],
  [879, "🌌", "bright streak of a comet", "celestial"],
  [880, "☀️", "bright halo around a low sun", "celestial"],
  [881, "☁️", "soft pink sunset illuminated clouds", "celestial"],
  [882, "🌌", "shimmering purple aurora band", "celestial"],
  [883, "☀️", "pale white hazy sun", "celestial"],
  [884, "☁️", "scattered puffy fair weather clouds", "celestial"],
  [885, "🌌", "bright glowing Pleiades cluster", "celestial"],
  [886, "☀️", "warm red sunrise disk", "celestial"],
  [887, "☁️", "dark ominous wall cloud", "celestial"],
  [888, "🌌", "bright glowing planet Jupiter", "celestial"],
  [889, "☀️", "bright sunbeams breaking through clouds", "celestial"],
  [890, "☁️", "smooth rolling cloud street", "celestial"],
  [891, "🌌", "swirling blue reflection nebula", "celestial"],
  [892, "☀️", "pale pink twilight arch", "celestial"],
  [893, "☁️", "high icy cirrostratus clouds", "celestial"],
  [894, "🌌", "dense star field in the zenith", "celestial"],
  [895, "☀️", "warm orange sunset glow", "celestial"],
  [896, "☁️", "billowing white thunderhead", "celestial"],
  [897, "🌌", "bright glowing planet Mars", "celestial"],
  [898, "☀️", "bright sun flare over water", "celestial"],
  [899, "☁️", "soft purple twilight clouds", "celestial"],
  [900, "🌌", "shimmering red aurora glow", "celestial"],
  ...NATURE_WORLDS_901_1000,
];

const CALM: PersonaMoodSelfReport[] = ['calm'];
const CURIOUS: PersonaMoodSelfReport[] = ['curious'];
const ENERGIZED: PersonaMoodSelfReport[] = ['energized'];
const SLEEPY: PersonaMoodSelfReport[] = ['sleepy'];
const CALM_CURIOUS: PersonaMoodSelfReport[] = ['calm', 'curious'];
const CURIOUS_ENERGIZED: PersonaMoodSelfReport[] = ['curious', 'energized'];
const CALM_SLEEPY: PersonaMoodSelfReport[] = ['calm', 'sleepy'];

const WATER_WORDS = /ocean|sea|shore|beach|bay|lagoon|river|stream|brook|pond|lake|water|tide|surf|reef|coral|kelp|marsh|swamp|wetland|spring|waterfall|iceberg|pier|canoe|dam|sandbar|bayou/i;
const MOUNTAIN_WORDS = /mountain|summit|peak|ridge|alpine|glacier|snow|ice|frost|serac|tundra|crag|scree|cornice|sastrugi|crevasse/i;
const FOREST_WORDS = /forest|woods|tree|oak|pine|bamboo|birch|redwood|canopy|jungle|fern|moss|log|root|leaf|branch|thicket|grove|woodland|ivy|acorn/i;
const MEADOW_WORDS = /meadow|garden|flower|bloom|blossom|field|pasture|grass|tulip|rose|orchid|daisy|lavender|wheat|barley|oat|sunflower|crocus|peony/i;
const DESERT_WORDS = /desert|sand|canyon|mesa|salt flat|cactus|saguaro|agave|yucca|playa|dune|badlands|arroyo|savanna|acacia/i;

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferTheme(name: string, collection: NatureCollectionId): NatureWorldTheme {
  if (collection === 'waters-wetlands' || collection === 'ethereal-coast') return 'water';
  if (collection === 'frost-alpine' || collection === 'crystal-frost') return 'mountain';
  if (collection === 'gardens-pastures' || collection === 'pastel-blooms') return 'meadow';
  if (collection === 'deep-woods' || collection === 'fairycore' || collection === 'autumn-harvest') return 'forest';
  if (WATER_WORDS.test(name)) return 'water';
  if (MOUNTAIN_WORDS.test(name)) return 'mountain';
  if (FOREST_WORDS.test(name)) return 'forest';
  if (MEADOW_WORDS.test(name)) return 'meadow';
  return 'beyond';
}

function inferTerrain(name: string, theme: NatureWorldTheme): NatureTerrain {
  const lower = name.toLowerCase();
  if (/cave|cavern|stalactite|geode|den/.test(lower)) return 'cave';
  if (/reef|coral|anemone|urchin|jellyfish|trench/.test(lower)) return 'reef';
  if (/marsh|swamp|bog|mudflat|reeds|bayou/.test(lower)) return 'wetland';
  if (/river|stream|brook|spring|creek|rapids/.test(lower)) return 'river';
  if (/lake|pond|loch|pool|tarn|lagoon/.test(lower)) return 'lake';
  if (/shore|beach|coast|tide|surf|ocean|sea|sandbar|pier/.test(lower)) return 'shore';
  if (/glacier|ice|snow|frost|blizzard|serac|permafrost|sastrugi/.test(lower)) return 'ice';
  if (/mountain|summit|peak|ridge|alpine|crag|scree|cliff/.test(lower)) return 'mountain';
  if (/canyon|mesa|hoodoo|badlands|rock arch|gorge/.test(lower)) return 'canyon';
  if (/volcan|black sand|obsidian/.test(lower)) return 'volcanic';
  if (/desert|sand|salt flat|playa|dune|cactus|saguaro|agave|yucca|arroyo/.test(lower)) return 'desert';
  if (/garden|orchard|trellis|hedge|fountain|potting|ikebana|bonsai/.test(lower)) return 'garden';
  if (/field|pasture|meadow|prairie|grass|wheat|barley|oat|corn/.test(lower)) return 'field';
  if (theme === 'forest') return /clearing|patch|ring|hollow|roost|burrow/.test(lower) ? 'clearing' : 'forest';
  if (theme === 'water') return 'shore';
  if (theme === 'mountain') return 'mountain';
  if (theme === 'meadow') return 'meadow';
  return 'sky';
}

function inferPalette(name: string, collection: NatureCollectionId, theme: NatureWorldTheme, terrain: NatureTerrain): NaturePaletteKey {
  const lower = name.toLowerCase();
  if (/biolum|glow|neon|luminous|fluorescent|firefly|foxfire/.test(lower) || collection === 'bioluminescent') return theme === 'water' ? 'water-bio' : 'forest-glow';
  if (/aurora/.test(lower)) return 'sky-aurora';
  if (/storm|thunder|lightning|hail|tornado|squall|overcast|rain/.test(lower) || collection === 'moody-rain') return theme === 'meadow' ? 'meadow-rain' : 'sky-storm';
  if (/night|moon|star|galaxy|nebula|meteor|space|twilight|eclipse|planet|milky way/.test(lower) || collection === 'celestial') return 'sky-night';
  if (/sunset|sunrise|golden hour|alpenglow|orange|harvest/.test(lower)) return theme === 'mountain' ? 'mountain-sunrise' : theme === 'water' ? 'water-sunset' : theme === 'meadow' ? 'meadow-gold' : 'desert-sun';
  if (/ice|snow|frost|glacier|frozen|icicle|rime|hoarfrost/.test(lower) || collection === 'crystal-frost') return theme === 'water' ? 'water-ice' : 'mountain-snow';
  if (/autumn|maple|pumpkin|gourd|apple|harvest|golden|yellow|red leaf|leaves/.test(lower) || collection === 'autumn-harvest') return theme === 'meadow' ? 'meadow-gold' : 'forest-autumn';
  if (/bamboo|zen/.test(lower) || collection === 'zen') return 'forest-bamboo';
  if (/flower|bloom|blossom|pastel|pink|lavender|lilac|orchid|peony|tulip/.test(lower) || collection === 'pastel-blooms') return 'meadow-floral';
  if (terrain === 'volcanic') return 'volcanic-shore';
  if (theme === 'water') return /tropical|turquoise|lagoon|shallow/.test(lower) ? 'water-lagoon' : 'water-clear';
  if (theme === 'mountain') return 'mountain-alpine';
  if (theme === 'meadow') return 'meadow-sun';
  if (theme === 'forest') return /fog|mist|dew/.test(lower) ? 'forest-mist' : 'forest-glow';
  if (DESERT_WORDS.test(name) || collection === 'desert-boho' || collection === 'savanna-desert') return /oasis|water/.test(lower) ? 'desert-oasis' : 'desert-sun';
  return 'sky-night';
}

function inferBiome(theme: NatureWorldTheme, terrain: NatureTerrain): PersonaBiome {
  if (theme === 'water') return terrain === 'river' || terrain === 'lake' || terrain === 'wetland' ? 'river' : 'coast';
  if (theme === 'mountain') return 'alpine';
  if (theme === 'meadow') return 'meadow';
  if (theme === 'forest') return terrain === 'cave' ? 'cave' : 'jungle';
  return terrain === 'desert' || terrain === 'canyon' ? 'alpine' : 'meadow';
}

function inferAtmosphere(name: string, collection: NatureCollectionId): NatureAtmosphere {
  const lower = name.toLowerCase();
  if (/lightning|storm|thunder|hail|tornado|squall|supercell/.test(lower)) return 'storm';
  if (/rain|drizzle|downpour|monsoon/.test(lower) || collection === 'moody-rain') return 'rain';
  if (/snow|blizzard|sleet/.test(lower)) return 'snow';
  if (/frost|ice|frozen|rime|icicle|glacier/.test(lower) || collection === 'crystal-frost') return 'frost';
  if (/fog/.test(lower)) return 'fog';
  if (/mist|haze/.test(lower)) return 'mist';
  if (/wind|breeze|sway|rustl|tumbleweed/.test(lower)) return 'wind';
  if (/sunrise|dawn|morning/.test(lower)) return 'sunrise';
  if (/sunset|golden hour|alpenglow/.test(lower)) return 'sunset';
  if (/night|moon|star|galaxy|nebula|meteor|aurora|eclipse|twilight/.test(lower) || collection === 'celestial') return 'night';
  if (/glow|luminous|biolum|neon|fluorescent|firefly|foxfire/.test(lower) || collection === 'bioluminescent') return 'glow';
  return 'clear';
}

function inferCues(name: string, icon: string, terrain: NatureTerrain, atmosphere: NatureAtmosphere): NatureRenderCue[] {
  const lower = name.toLowerCase();
  const cues: NatureRenderCue[] = [];
  const add = (cue: NatureRenderCue, pattern: RegExp) => { if (pattern.test(lower)) cues.push(cue); };
  add('pine', /pine|fir|cedar|taiga|evergreen|cypress/);
  add('oak', /oak|baobab|banyan|redwood|eucalyptus|birch|tree|orchard|bonsai/);
  add('bamboo', /bamboo/);
  add('willow', /willow/);
  add('palm', /palm|banana/);
  add('roots', /root|burrow|hollow/);
  add('log', /log|driftwood|stump|wood|bark/);
  add('fern', /fern|understory/);
  add('moss', /moss|lichen/);
  add('grass', /grass|field|pasture|meadow|prairie|wheat|barley|oat|corn|hay/);
  add('sunflower', /sunflower/);
  add('flower', /flower|bloom|blossom|petal|tulip|rose|orchid|daisy|lavender|lilac|peony|crocus|poppy|hydrangea|wisteria|magnolia|lotus|lily|aster|freesia|zinnia/);
  add('mushroom', /mushroom|fungi|toadstool|puffball|mycelium|foxfire/);
  add('fruit', /apple|berry|strawberry|blueberry|banana|pumpkin|gourd|squash|chestnut|hazelnut|acorn/);
  add('leaf', /leaf|leaves|foliage|needle|clover|ivy/);
  add('cactus', /cactus|saguaro|cholla|prickly pear|barrel|cereus|creosote|mesquite/);
  add('agave', /agave/);
  add('yucca', /yucca/);
  add('coral', /coral|anemone|sponge|urchin|sea pen|polyp/);
  add('kelp', /kelp|seaweed/);
  add('shell', /shell|oyster|conch|barnacle|sea glass|sand dollar|nautilus|cowrie|mussel|murex|scallop|whelk|clam|limpet|geoduck/);
  add('reed', /reed|cattail|marsh|swamp|bog/);
  add('lily', /lily pad|water lily|lotus/);
  add('crystal', /crystal|quartz|amethyst|bismuth|malachite|pyrite|azurite|celestite|ruby|emerald|citrine|lapis|fluorite|aquamarine|tourmaline|agate/);
  add('ice', /ice|glacier|serac|crevasse|icicle|iceberg|permafrost|frozen|frost/);
  add('snow', /snow|blizzard|sleet|sastrugi/);
  add('sand', /sand|dune|playa|salt flat|desert/);
  add('canyon', /canyon|mesa|hoodoo|badlands|gorge|rock arch/);
  add('mountain', /mountain|summit|peak|ridge|alpine|crag|scree|cliff/);
  add('cave', /cave|cavern|stalactite|geode|den/);
  add('river', /river|stream|brook|creek|spring|rapids|arroyo/);
  add('lake', /lake|loch|tarn/);
  add('pond', /pond|pool|lagoon|tide pool/);
  add('ocean', /ocean|sea|surf|shore|beach|bay|harbor|tide|coast/);
  add('waterfall', /waterfall|cascade|blowhole/);
  add('island', /island/);
  add('cloud', /cloud|cirrus|cumulus|stratus|fog bank|storm front|overcast|sky/);
  add('sun', /sun|sunrise|sunset|golden hour|crepuscular/);
  add('moon', /moon|eclipse/);
  add('stars', /star|milky way|galaxy|nebula|planet|pleiades|space|observatory/);
  add('meteor', /meteor|shooting star|comet/);
  add('aurora', /aurora|northern lights/);
  add('rainbow', /rainbow|moonbow|sundog|prism|spectrum|iridescent/);
  add('lightning', /lightning|thunder|supercell/);
  add('rain', /rain|drizzle|downpour|monsoon/);
  add('fog', /fog|mist|haze/);
  add('wind', /wind|breeze|sway|rustl|tumbleweed/);
  add('firefly', /firefly|glowworm|glowing insect|click beetle|wireworm|railroad worm/);
  add('web', /web|spider silk|gossamer/);
  add('ruin', /ruin|gate|wall|fountain|observatory|library|shed|barn/);
  add('bridge', /bridge|pier|canoe|dam/);
  add('path', /path|trail|road|switchback|track|avenue/);

  const animalEmoji = /🐿️|🦌|🦇|🦊|🦉|🐻|🐢|🦦|🐬|🐧|🐐|🐑|🐕|🦜|🐆|🦥|🐸|🐼|🐍|🦧|🐗|🦭|🐋|🦑|🦀|🐊|🦩|🐟|🦈|🐙|🦢|🦆|🐪|🦁|🦒|🐘|🦓|🦏|🐃|🦛|🐒/;
  if (animalEmoji.test(icon)) cues.push('animal');
  if (/🦅|🦉|🦜|🐦|🦢|🦆|🐧/.test(icon)) cues.push('bird');
  if (/🐟|🦈|🐋|🐬|🦑|🐙/.test(icon)) cues.push('fish');
  if (/🐝|🐞|🪲|🐛|🦋|🕸️|🐜|🦂/.test(icon)) cues.push('insect');
  if (/🦎|🐍|🐊|🐢/.test(icon)) cues.push('reptile');
  if (atmosphere === 'glow') cues.push('glow');

  if (terrain === 'forest' && !cues.some((cue) => ['pine','oak','bamboo','willow','palm','tree'].includes(cue))) cues.push('tree');
  if (terrain === 'mountain' && !cues.includes('mountain')) cues.push('mountain');
  if (terrain === 'ice' && !cues.includes('ice')) cues.push('ice');
  if (terrain === 'desert' && !cues.includes('sand')) cues.push('sand');
  if (['river','lake','wetland','shore','reef'].includes(terrain) && !cues.some((cue) => ['water','river','lake','pond','ocean'].includes(cue))) cues.push('water');
  return unique(cues).slice(0, 12);
}

function inferWildlife(icon: string, name: string): string[] {
  const lower = name.toLowerCase();
  const known: Array<[RegExp, string]> = [
    [/macaw/, 'macaw'], [/jaguar/, 'jaguar'], [/sloth/, 'sloth'], [/frog/, 'frog'], [/chipmunk/, 'chipmunk'], [/panda/, 'panda'], [/owl/, 'owl'], [/bat/, 'bat'], [/python|snake|sidewinder|rattlesnake/, 'snake'],
    [/orangutan/, 'orangutan'], [/stag|deer|elk/, 'deer'], [/boar/, 'boar'], [/seal/, 'seal'], [/whale/, 'whale'], [/squid/, 'squid'], [/crab/, 'crab'], [/alligator|crocodile/, 'crocodilian'], [/flamingo/, 'flamingo'],
    [/salmon|minnow|flying fish/, 'fish'], [/shark/, 'shark'], [/octopus/, 'octopus'], [/swan/, 'swan'], [/penguin/, 'penguin'], [/turtle|tortoise/, 'turtle'], [/mallard|duck/, 'duck'], [/otter/, 'otter'],
    [/hawk|eagle|falcon|vulture/, 'raptor'], [/ibex|goat/, 'ibex'], [/bear/, 'bear'], [/sheep/, 'sheep'], [/wolf/, 'wolf'], [/bee|wasp|moth|butterfly|beetle|ladybug|cicada|mantis|grasshopper|centipede|ant|spider|caterpillar|worm|firefly/, 'insect'],
    [/camel/, 'camel'], [/lion/, 'lion'], [/giraffe/, 'giraffe'], [/elephant/, 'elephant'], [/zebra/, 'zebra'], [/rhino/, 'rhino'], [/cheetah/, 'cheetah'], [/meerkat/, 'meerkat'], [/buffalo/, 'buffalo'], [/hippo/, 'hippo'], [/baboon/, 'baboon'], [/coyote/, 'coyote'],
  ];
  const wildlife = known.filter(([pattern]) => pattern.test(lower)).map(([, label]) => label);
  if (wildlife.length === 0 && /🐾/.test(icon)) wildlife.push('animal tracks');
  return unique(wildlife);
}

function inferMoods(name: string, atmosphere: NatureAtmosphere, collection: NatureCollectionId): PersonaMoodSelfReport[] {
  const lower = name.toLowerCase();
  if (atmosphere === 'storm' || /sprint|charging|howling|crashing|choppy|whirlpool|blizzard/.test(lower)) return CURIOUS_ENERGIZED;
  if (atmosphere === 'night' || atmosphere === 'twilight' || /sleep|quiet|still|gentle|solitary|lonely/.test(lower)) return CALM_SLEEPY;
  if (collection === 'zen' || /calm|soft|pastel|delicate|peace|rest|slow|still/.test(lower)) return CALM;
  if (atmosphere === 'glow' || /hidden|rare|crystal|cave|ruin|track|burrow/.test(lower)) return CALM_CURIOUS;
  if (/rolling|darting|jumping|swaying|flutter|chase|running|flight|swarm/.test(lower)) return [CURIOUS[0], ENERGIZED[0]];
  return CALM_CURIOUS;
}

function inferActivities(theme: NatureWorldTheme, terrain: NatureTerrain, name: string): PersonaActivity[] {
  const lower = name.toLowerCase();
  if (/fire|camp|warm/.test(lower)) return ['warm-fire','rest','stargaze','collect'];
  if (/snow|frost|ice|glacier/.test(lower)) return ['snow-angel','explore','build-cairn','stargaze','collect'];
  if (theme === 'water') return terrain === 'river' || terrain === 'lake' ? ['skip-stones','fish','collect','rest','explore'] : ['collect','explore','stargaze','rest'];
  if (/garden|flower|bloom|orchard|plant|herb/.test(lower)) return ['garden','collect','rest','explore'];
  if (/firefly|glow/.test(lower)) return ['chase-fireflies','collect','explore','stargaze'];
  if (theme === 'mountain') return ['explore','build-cairn','stargaze','collect'];
  if (theme === 'beyond') return ['explore','stargaze','collect','rest'];
  return ['explore','collect','rest','stargaze'];
}

function inferTraitBias(theme: NatureWorldTheme, atmosphere: NatureAtmosphere, name: string): Partial<Record<PersonaTrait, number>> {
  const lower = name.toLowerCase();
  const bias: Partial<Record<PersonaTrait, number>> = {
    curiosity: theme === 'beyond' ? 0.75 : 0.48,
    explorer: ['water','mountain'].includes(theme) ? 0.68 : 0.42,
    calmWorlds: ['mist','fog','night','sunrise','sunset','clear'].includes(atmosphere) ? 0.58 : 0.34,
    wildWorlds: ['storm','snow','wind'].includes(atmosphere) ? 0.78 : 0.3,
  };
  if (/collect|shell|crystal|stone|apple|berry|seed|acorn|leaf/.test(lower)) bias.collector = 0.78;
  if (/dart|sprint|jump|flight|swarm|wind|crash|charging/.test(lower)) bias.energy = 0.72;
  return bias;
}

function inferDepth(name: string, terrain: NatureTerrain): NatureDepthMode {
  const lower = name.toLowerCase();
  if (/horizon|ocean|range|sky|galaxy|sunset|sunrise|vista|valley|field|plain|salt flat/.test(lower)) return 'panorama';
  if (/trunk|leaf|shell|flower|crystal|stone|drop|web|fruit|mushroom|cactus|branch|bark/.test(lower)) return 'macro';
  if (/canopy|waterfall|cliff|peak|tower|spire|cloud|aurora/.test(lower)) return 'vertical';
  if (/path|trail|road|river|stream|bridge|avenue|tunnel|canyon/.test(lower)) return 'pathway';
  if (['shore','reef','lake','mountain','sky'].includes(terrain)) return 'horizon';
  return 'intimate';
}

function makeScenePlan(index: number, icon: string, name: string, collection: NatureCollectionId, terrain: NatureTerrain, palette: NaturePaletteKey): NatureScenePlan {
  const atmosphere = inferAtmosphere(name, collection);
  const depth = inferDepth(name, terrain);
  const renderCues = inferCues(name, icon, terrain, atmosphere);
  const subject = name.replace(/^(soft |pale |bright |dark |tiny |large |small )/i, '');
  const layerTemplates = {
    macro: [`The ${subject} sits close to the lens, oversized enough to read as a tiny landscape of its own.`, `Secondary forms repeat the subject at smaller scales, turning detail into depth.`, `The background dissolves into simple silhouettes so the focal object stays tactile and legible.`],
    pathway: [`A near-field marker frames the entrance into ${subject}.`, `A curving route pulls the eye diagonally through the miniature set with two or three staggered landmarks.`, `The far plane compresses into mist, ridge, canopy, or sky cards to exaggerate distance.`],
    panorama: [`A low foreground shelf gives the diorama a physical edge.`, `${subject} opens across a broad midground with asymmetric clusters rather than a centered postcard composition.`, `The horizon carries the quietest silhouettes and atmosphere, creating a wide toy-theatre sense of scale.`],
    vertical: [`Small foreground details establish the creature-sized scale.`, `${subject} rises through the center third with overlapping ledges, trunks, ice, cloud, or water forms.`, `High background layers fade toward the sky to make the little world feel taller than its footprint.`],
    horizon: [`Foreground stones, grass, foam, shells, or snow create a tactile lip around the scene.`, `${subject} occupies the middle distance with a clear horizontal rhythm.`, `A simplified distant horizon and soft atmospheric fade make the 2D layers feel spatial when the camera orbits.`],
    intimate: [`The foreground is deliberately cozy: a few readable props, low plants, stones, or roots sit within reach of the avatar.`, `${subject} becomes the central pocket of activity rather than a huge landscape.`, `The background forms a protective ring of softly layered silhouettes.`],
  }[depth];
  const motion = atmosphere === 'rain' ? 'Fine rain streaks fall at different depths while puddle rings and leaf tips pulse.'
    : atmosphere === 'storm' ? 'Cloud cards drift quickly, intermittent light flashes cross the set, and loose particles move in gusts.'
    : atmosphere === 'snow' ? 'Snowflakes drift on several depth planes with occasional sideways gusts.'
    : atmosphere === 'wind' ? 'Leaves, grass, clouds, and small particles oscillate at deliberately different frequencies.'
    : atmosphere === 'glow' ? 'Emissive motes breathe asynchronously and leave the darker geometry still enough to preserve contrast.'
    : atmosphere === 'night' ? 'Stars or luminous particles move almost imperceptibly while the foreground remains calm.'
    : /water|river|lake|pond|ocean|waterfall/.test(renderCues.join(' ')) ? 'Water surfaces use slow layered ripples while nearby reeds, foam, or reflections move at a second rhythm.'
    : 'Only a few scene elements move: foliage breathes, particles drift, and wildlife uses small looping gestures so the world feels alive without becoming noisy.';
  const lighting = atmosphere === 'night' ? 'Cool low-key ambient light with one warm or luminous focal rim and strong silhouette separation.'
    : atmosphere === 'storm' ? 'Muted diffuse daylight punctuated by brief high-contrast flashes and cool fog.'
    : atmosphere === 'sunrise' ? 'Low peach-gold key light skims the geometry so every layered plane gets a readable edge.'
    : atmosphere === 'sunset' ? 'Warm lateral light, long miniature shadows, and a cooler horizon balance the scene.'
    : atmosphere === 'glow' ? 'Dark ambient base plus emissive subject lights; glow is localized so it reads as bioluminescence rather than neon fog.'
    : atmosphere === 'frost' || atmosphere === 'snow' ? 'Soft blue-white hemisphere light with crisp pale highlights and slightly darker rock or vegetation anchors.'
    : `Soft natural daylight derived from the ${palette} palette, with a brighter focal accent and restrained fill.`;
  const camera = depth === 'macro' ? 'Low 42mm-equivalent macro orbit, shallow angle changes, subject kept slightly off-center.'
    : depth === 'panorama' ? 'Wide 32mm-equivalent orbit with a low horizon and slow parallax between foreground, midground, and backdrop cards.'
    : depth === 'vertical' ? 'Slightly lower camera target with extra upward framing; orbit reveals stacked vertical layers.'
    : depth === 'pathway' ? 'Three-quarter camera aimed along the route so orbiting changes how foreground markers overlap the destination.'
    : 'Gentle three-quarter orbit with enough parallax to expose the pop-up-book layering without distorting the tiny scene.';
  const visualThesis = `World ${String(index).padStart(3,'0')} is built around “${name}” as a ${depth} ${COLLECTION_LABEL[collection]} vignette. The goal is recognizability from silhouette first, then small animated details on closer inspection.`;
  return {
    collection,
    collectionLabel: COLLECTION_LABEL[collection],
    focalSubject: name,
    visualThesis,
    foreground: layerTemplates[0],
    midground: layerTemplates[1],
    backdrop: layerTemplates[2],
    atmosphere,
    motion,
    lighting,
    camera,
    depth,
    interactionCue: `Orbit around ${name}; the layered cards and low-poly props should separate visibly in parallax, while the avatar can ${/water|river|lake|ocean/.test(name) ? 'pause near the waterline' : /flower|garden|plant/.test(name) ? 'inspect the nearest plant cluster' : /sky|star|moon|aurora/.test(name) ? 'look upward and stargaze' : 'wander between the focal props'}.`,
    renderCues,
    density: 0.48 + ((index * 17) % 43) / 100,
    sparkle: atmosphere === 'glow' || atmosphere === 'night' ? 0.72 + ((index * 7) % 20) / 100 : ((index * 11) % 24) / 100,
  };
}

function makeDescription(index: number, name: string, collection: NatureCollectionId, scene: NatureScenePlan): string {
  const openings = [
    `A miniature study of ${name}, composed as a layered ${scene.depth} world rather than a flat icon.`,
    `${name[0].toUpperCase()}${name.slice(1)} becomes the hero of a tiny explorable diorama with deliberate foreground-to-horizon depth.`,
    `This pocket world turns ${name} into a small stage the avatar can inhabit, inspect, and orbit around.`,
    `A toy-scale nature vignette centered on ${name}, with enough parallax and ambient motion to reward looking from several angles.`,
    `The scene treats ${name} as an environmental story: one strong focal silhouette, supporting details, and a quiet atmospheric backdrop.`,
  ];
  return `${openings[index % openings.length]} ${scene.lighting} Collection: ${COLLECTION_LABEL[collection]}.`;
}

function compileWorld(row: ManifestRow): RichNatureWorldDefinition {
  const [index, icon, name, collection] = row;
  const theme = inferTheme(name, collection);
  const terrain = inferTerrain(name, theme);
  const palette = inferPalette(name, collection, theme, terrain);
  const baseBiome = inferBiome(theme, terrain);
  const scene = makeScenePlan(index, icon, name, collection, terrain, palette);
  const wildlife = inferWildlife(icon, name);
  const activities = inferActivities(theme, terrain, name);
  return {
    id: `w${String(index).padStart(3,'0')}-${slugify(name)}`,
    index,
    icon,
    name,
    theme,
    terrain,
    palette,
    baseBiome,
    description: makeDescription(index, name, collection, scene),
    moods: inferMoods(name, scene.atmosphere, collection),
    features: scene.renderCues,
    wildlife,
    activities,
    traitBias: inferTraitBias(theme, scene.atmosphere, name),
    seed: index * 7919 + 17,
    collection,
    scene,
  };
}

function enrichOriginal(world: NatureWorldDefinition): RichNatureWorldDefinition {
  const scene = makeScenePlan(world.index, world.icon, world.name, 'original-atlas', world.terrain, world.palette);
  return { ...world, collection: 'original-atlas', scene };
}

export const NATURE_WORLDS: RichNatureWorldDefinition[] = [
  ...ORIGINAL_NATURE_WORLDS.map(enrichOriginal),
  ...ADDITIONAL_WORLD_ROWS.map(compileWorld),
];

if (NATURE_WORLDS.length !== 1000) {
  throw new Error(`Nature atlas manifest invariant failed: expected 1000 worlds, got ${NATURE_WORLDS.length}`);
}

export const NATURE_WORLD_BY_ID: Record<string, RichNatureWorldDefinition> = Object.fromEntries(
  NATURE_WORLDS.map((world) => [world.id, world])
);

export const NATURE_WORLD_THEMES: Array<{ id: NatureWorldTheme; label: string; icon: string }> = [
  { id: 'forest', label: 'forests', icon: '🌲' },
  { id: 'water', label: 'waters', icon: '🌊' },
  { id: 'mountain', label: 'mountains + ice', icon: '🏔️' },
  { id: 'meadow', label: 'meadows + gardens', icon: '🌸' },
  { id: 'beyond', label: 'deserts + skies', icon: '🌌' },
];

export function getNatureWorld(worldId: string): RichNatureWorldDefinition {
  return NATURE_WORLD_BY_ID[worldId] ?? NATURE_WORLDS[0];
}

export function createDefaultAtlasProgress(): NatureAtlasProgress {
  return { schemaVersion: 1, discovered: [], favorites: [], visits: {}, recent: [] };
}

export function loadAtlasProgress(raw: string | null): NatureAtlasProgress {
  if (!raw) return createDefaultAtlasProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<NatureAtlasProgress>;
    if (parsed.schemaVersion !== 1) return createDefaultAtlasProgress();
    const valid = new Set(NATURE_WORLDS.map((world) => world.id));
    const discovered = Array.isArray(parsed.discovered) ? parsed.discovered.filter((id): id is string => typeof id === 'string' && valid.has(id)) : [];
    const favorites = Array.isArray(parsed.favorites) ? parsed.favorites.filter((id): id is string => typeof id === 'string' && valid.has(id)) : [];
    const recent = Array.isArray(parsed.recent) ? parsed.recent.filter((id): id is string => typeof id === 'string' && valid.has(id)).slice(0, 18) : [];
    const visits = Object.fromEntries(
      Object.entries(parsed.visits ?? {}).filter(([id, count]) => valid.has(id) && Number.isFinite(Number(count))).map(([id, count]) => [id, Math.max(0, Math.floor(Number(count)))])
    );
    return { schemaVersion: 1, discovered: unique(discovered), favorites: unique(favorites), visits, recent };
  } catch {
    return createDefaultAtlasProgress();
  }
}

export function recordAtlasVisit(progress: NatureAtlasProgress, worldId: string): NatureAtlasProgress {
  const world = getNatureWorld(worldId);
  return {
    ...progress,
    discovered: progress.discovered.includes(world.id) ? progress.discovered : [...progress.discovered, world.id],
    visits: { ...progress.visits, [world.id]: (progress.visits[world.id] ?? 0) + 1 },
    recent: [world.id, ...progress.recent.filter((id) => id !== world.id)].slice(0, 18),
  };
}

export function toggleAtlasFavorite(progress: NatureAtlasProgress, worldId: string): NatureAtlasProgress {
  const id = getNatureWorld(worldId).id;
  return {
    ...progress,
    favorites: progress.favorites.includes(id) ? progress.favorites.filter((entry) => entry !== id) : [...progress.favorites, id],
  };
}

function scoreMood(world: RichNatureWorldDefinition, mood: PersonaMoodSelfReport): number {
  return world.moods.includes(mood) ? 0.23 : 0;
}

export function scoreNatureWorld(profile: PersonaWorldProfile, progress: NatureAtlasProgress, world: RichNatureWorldDefinition, mood: PersonaMoodSelfReport): number {
  const traitScore = Object.entries(world.traitBias).reduce((score, [trait, weight]) => score + profile.traits[trait as PersonaTrait] * Number(weight), 0);
  const baseAffinity = profile.biomeAffinity[world.baseBiome] ?? 0.5;
  const visits = progress.visits[world.id] ?? 0;
  const novelty = 0.32 / (1 + visits * 0.5);
  const favorite = progress.favorites.includes(world.id) ? 0.14 : 0;
  const collectionNovelty = progress.recent.some((id) => getNatureWorld(id).collection === world.collection) ? 0 : 0.06;
  return traitScore * 0.4 + baseAffinity * 0.2 + scoreMood(world, mood) + novelty + favorite + collectionNovelty;
}

export function suggestNatureWorld(profile: PersonaWorldProfile, progress: NatureAtlasProgress, mood: PersonaMoodSelfReport, offset = 0): RichNatureWorldDefinition {
  const ranked = NATURE_WORLDS.map((world) => ({ world, score: scoreNatureWorld(profile, progress, world, mood) }))
    .sort((a,b) => b.score - a.score || a.world.index - b.world.index);
  return ranked[Math.abs(offset) % ranked.length]?.world ?? NATURE_WORLDS[0];
}

export function suggestWorldActivity(profile: PersonaWorldProfile, world: RichNatureWorldDefinition, mood: PersonaMoodSelfReport, offset = 0): PersonaActivity {
  const ranked = world.activities.map((activity) => {
    const count = profile.activityCounts[activity] ?? 0;
    const novelty = 0.28 / (1 + count * 0.5);
    const moodBoost = mood === 'sleepy' && ['rest','stargaze','warm-fire','fish'].includes(activity) ? 0.28
      : mood === 'energized' && ['explore','skip-stones','snow-angel','chase-fireflies'].includes(activity) ? 0.28
      : mood === 'curious' && ['explore','collect','stargaze','chase-fireflies'].includes(activity) ? 0.22
      : mood === 'calm' && ['garden','rest','fish','warm-fire','stargaze'].includes(activity) ? 0.22 : 0;
    return { activity, score: novelty + moodBoost + (activity === 'explore' ? profile.traits.explorer * 0.15 : 0) + (activity === 'collect' ? profile.traits.collector * 0.15 : 0) };
  }).sort((a,b) => b.score - a.score);
  return ranked[Math.abs(offset) % ranked.length]?.activity ?? world.activities[0] ?? 'explore';
}

export function recordNatureAdventure(profile: PersonaWorldProfile, world: RichNatureWorldDefinition, activity: PersonaActivity, mood: PersonaMoodSelfReport): PersonaWorldProfile {
  const next = recordAdventure(profile, world.baseBiome, activity, mood);
  const first = next.memories[0];
  if (!first) return next;
  return {
    ...next,
    memories: [
      { ...first, note: `${ACTIVITIES[activity].memory} in world ${String(world.index).padStart(3,'0')}, ${world.name}.` },
      ...next.memories.slice(1),
    ],
  };
}

export function explainNatureRecommendation(profile: PersonaWorldProfile, progress: NatureAtlasProgress, world: RichNatureWorldDefinition, mood: PersonaMoodSelfReport): string {
  const strongest = Object.entries(world.traitBias)
    .map(([trait, weight]) => ({ trait: trait as PersonaTrait, score: profile.traits[trait as PersonaTrait] * Number(weight) }))
    .sort((a,b) => b.score - a.score)[0]?.trait ?? 'curiosity';
  const visits = progress.visits[world.id] ?? 0;
  const novelty = visits === 0 ? 'It is still undiscovered in this browser' : `You have visited it ${visits} time${visits === 1 ? '' : 's'}`;
  return `${world.icon} ${world.name} matches the local ${strongest} preference and the current ${mood} visit state. ${novelty}. The recommendation can choose where to wander, but only explicit world, activity, and favorite choices train persistent preferences.`;
}

export function atlasSummary(progress: NatureAtlasProgress) {
  return {
    total: NATURE_WORLDS.length,
    discovered: progress.discovered.length,
    favorites: progress.favorites.length,
    completion: progress.discovered.length / NATURE_WORLDS.length,
    collectionsVisited: unique(progress.discovered.map((id) => getNatureWorld(id).collection)).length,
  };
}
