import type { PersonaMoodSelfReport } from './schema';
import {
  ACTIVITIES,
  recordAdventure,
  type PersonaActivity,
  type PersonaBiome,
  type PersonaTrait,
  type PersonaWorldProfile,
} from './world';

export const NATURE_ATLAS_STORAGE_KEY = 'sid.physio-persona.nature-atlas.v1';

export type NatureWorldTheme = 'forest' | 'water' | 'mountain' | 'meadow' | 'beyond';
export type NatureTerrain =
  | 'forest'
  | 'clearing'
  | 'cave'
  | 'shore'
  | 'reef'
  | 'lake'
  | 'river'
  | 'wetland'
  | 'ice'
  | 'mountain'
  | 'snow'
  | 'hill'
  | 'canyon'
  | 'volcanic'
  | 'meadow'
  | 'garden'
  | 'field'
  | 'desert'
  | 'sky';

export type NaturePaletteKey =
  | 'forest-mist'
  | 'forest-glow'
  | 'forest-autumn'
  | 'forest-bamboo'
  | 'forest-frost'
  | 'forest-twilight'
  | 'water-clear'
  | 'water-lagoon'
  | 'water-sunset'
  | 'water-ice'
  | 'water-bio'
  | 'mountain-alpine'
  | 'mountain-snow'
  | 'mountain-sunrise'
  | 'mountain-volcanic'
  | 'meadow-sun'
  | 'meadow-floral'
  | 'meadow-rain'
  | 'meadow-gold'
  | 'desert-sun'
  | 'desert-oasis'
  | 'sky-night'
  | 'sky-storm'
  | 'sky-aurora'
  | 'volcanic-shore';

export type NatureWorldPalette = {
  sky: string;
  fog: string;
  ground: string;
  accent: string;
  secondary: string;
  water: string;
  glow: string;
};

export type NatureWorldDefinition = {
  id: string;
  index: number;
  name: string;
  icon: string;
  theme: NatureWorldTheme;
  terrain: NatureTerrain;
  palette: NaturePaletteKey;
  baseBiome: PersonaBiome;
  description: string;
  moods: PersonaMoodSelfReport[];
  features: string[];
  wildlife: string[];
  activities: PersonaActivity[];
  traitBias: Partial<Record<PersonaTrait, number>>;
  seed: number;
};

export type NatureAtlasProgress = {
  schemaVersion: 1;
  discovered: string[];
  favorites: string[];
  visits: Record<string, number>;
  recent: string[];
};

export const NATURE_WORLD_PALETTES: Record<NaturePaletteKey, NatureWorldPalette> = {
  'forest-mist': { sky: '#90a9a3', fog: '#b9c7bd', ground: '#435b4b', accent: '#9bc5a6', secondary: '#617668', water: '#71999a', glow: '#d6efe1' },
  'forest-glow': { sky: '#173b35', fog: '#2b5145', ground: '#254435', accent: '#75c790', secondary: '#4f785c', water: '#4c8c80', glow: '#d8f58e' },
  'forest-autumn': { sky: '#9e8d72', fog: '#b5a68c', ground: '#5c4d39', accent: '#d4975f', secondary: '#8a6043', water: '#6d8a87', glow: '#ffd7a0' },
  'forest-bamboo': { sky: '#789d87', fog: '#a5bba7', ground: '#385b42', accent: '#8fbd75', secondary: '#58784f', water: '#6ea39b', glow: '#ddf2b8' },
  'forest-frost': { sky: '#8ca6b5', fog: '#c1d0d5', ground: '#526a65', accent: '#c5e6e8', secondary: '#6e8885', water: '#78a9b8', glow: '#efffff' },
  'forest-twilight': { sky: '#303a59', fog: '#4b516b', ground: '#33473e', accent: '#a5a7d6', secondary: '#5d607a', water: '#526c88', glow: '#d6d4ff' },
  'water-clear': { sky: '#87b7c3', fog: '#b8d3d3', ground: '#668574', accent: '#9de0d1', secondary: '#7f9583', water: '#4b9eb2', glow: '#d9ffff' },
  'water-lagoon': { sky: '#72b6b2', fog: '#a3d0c7', ground: '#7c8f6d', accent: '#79d4b8', secondary: '#5c917c', water: '#36a5a5', glow: '#d7fff0' },
  'water-sunset': { sky: '#b77973', fog: '#c89889', ground: '#806f58', accent: '#efb17f', secondary: '#916f70', water: '#547b98', glow: '#ffd9a6' },
  'water-ice': { sky: '#8ca9be', fog: '#c7d6df', ground: '#d7e3e5', accent: '#c7eff6', secondary: '#8299a6', water: '#6da9c5', glow: '#effcff' },
  'water-bio': { sky: '#142c46', fog: '#223b50', ground: '#244a54', accent: '#55d5cf', secondary: '#356f7b', water: '#176d89', glow: '#8effdf' },
  'mountain-alpine': { sky: '#86a5af', fog: '#b9c7ca', ground: '#667866', accent: '#b5d2aa', secondary: '#667b7f', water: '#6fa2ad', glow: '#e5f3d0' },
  'mountain-snow': { sky: '#7f9cae', fog: '#c4d1d8', ground: '#dbe6e9', accent: '#c9ecf5', secondary: '#687f8c', water: '#7eb5ca', glow: '#ffffff' },
  'mountain-sunrise': { sky: '#c18c7a', fog: '#d0afa0', ground: '#6d7163', accent: '#f0be82', secondary: '#8a7168', water: '#7396a8', glow: '#ffe2aa' },
  'mountain-volcanic': { sky: '#66544e', fog: '#76635b', ground: '#403d3c', accent: '#cf8261', secondary: '#6a5650', water: '#526c74', glow: '#ffb16f' },
  'meadow-sun': { sky: '#93b8af', fog: '#bfd1ba', ground: '#5f8059', accent: '#e3d679', secondary: '#8e9b6a', water: '#79aeb6', glow: '#fff3aa' },
  'meadow-floral': { sky: '#9fb9b4', fog: '#c8d0c1', ground: '#66825f', accent: '#d8a8c9', secondary: '#9b807d', water: '#80acb2', glow: '#ffe4ef' },
  'meadow-rain': { sky: '#738f91', fog: '#a8b5ad', ground: '#506e57', accent: '#99c4ae', secondary: '#6d8375', water: '#648fa0', glow: '#d8efdf' },
  'meadow-gold': { sky: '#b2a67f', fog: '#cbbf9d', ground: '#8a7749', accent: '#e3c86e', secondary: '#9d7e4d', water: '#7899a0', glow: '#ffe6a0' },
  'desert-sun': { sky: '#c89570', fog: '#d4b18e', ground: '#a66f4f', accent: '#e7bb73', secondary: '#875c4a', water: '#648c8a', glow: '#ffe1a3' },
  'desert-oasis': { sky: '#b89372', fog: '#cdb18f', ground: '#9b704f', accent: '#8dbb83', secondary: '#6e7959', water: '#4e9f9b', glow: '#d8f2b2' },
  'sky-night': { sky: '#17233f', fog: '#273652', ground: '#3b4a4c', accent: '#a9b7e7', secondary: '#5c668c', water: '#425f82', glow: '#e8edff' },
  'sky-storm': { sky: '#414d5c', fog: '#596371', ground: '#4f6258', accent: '#9bb4c8', secondary: '#65717b', water: '#53758b', glow: '#dcecff' },
  'sky-aurora': { sky: '#132b3b', fog: '#244452', ground: '#344f50', accent: '#78d9b4', secondary: '#6572a0', water: '#3d7485', glow: '#c6ffe2' },
  'volcanic-shore': { sky: '#514a4e', fog: '#6a6062', ground: '#302f33', accent: '#c77d69', secondary: '#65575d', water: '#456c7d', glow: '#ffb08f' },
};

const C = {
  calm: ['calm'] as PersonaMoodSelfReport[],
  curious: ['curious'] as PersonaMoodSelfReport[],
  energy: ['energized'] as PersonaMoodSelfReport[],
  sleepy: ['sleepy'] as PersonaMoodSelfReport[],
  calmCurious: ['calm', 'curious'] as PersonaMoodSelfReport[],
  curiousEnergy: ['curious', 'energized'] as PersonaMoodSelfReport[],
  calmSleepy: ['calm', 'sleepy'] as PersonaMoodSelfReport[],
  all: ['calm', 'curious', 'energized', 'sleepy'] as PersonaMoodSelfReport[],
};

const A = {
  wander: ['explore', 'collect', 'rest'] as PersonaActivity[],
  wonder: ['explore', 'collect', 'stargaze'] as PersonaActivity[],
  cozy: ['rest', 'stargaze', 'warm-fire'] as PersonaActivity[],
  water: ['skip-stones', 'fish', 'collect', 'rest'] as PersonaActivity[],
  activeWater: ['skip-stones', 'explore', 'collect'] as PersonaActivity[],
  garden: ['garden', 'collect', 'rest'] as PersonaActivity[],
  snow: ['snow-angel', 'explore', 'build-cairn', 'stargaze'] as PersonaActivity[],
  mountain: ['explore', 'build-cairn', 'stargaze', 'collect'] as PersonaActivity[],
  fireflies: ['chase-fireflies', 'explore', 'collect', 'rest'] as PersonaActivity[],
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function w(
  index: number,
  icon: string,
  name: string,
  theme: NatureWorldTheme,
  terrain: NatureTerrain,
  palette: NaturePaletteKey,
  baseBiome: PersonaBiome,
  description: string,
  moods: PersonaMoodSelfReport[],
  features: string[],
  wildlife: string[],
  activities: PersonaActivity[],
  traitBias: Partial<Record<PersonaTrait, number>>
): NatureWorldDefinition {
  return {
    id: `w${String(index).padStart(3, '0')}-${slugify(name)}`,
    index,
    icon,
    name,
    theme,
    terrain,
    palette,
    baseBiome,
    description,
    moods,
    features,
    wildlife,
    activities,
    traitBias,
    seed: index * 7919 + 17,
  };
}

export const NATURE_WORLDS: NatureWorldDefinition[] = [
  w(1,'🌲','misty pine grove','forest','forest','forest-mist','jungle','Tall pines fade into pearly fog while droplets gather on every needle.',C.calmCurious,['pine','mist','moss','dew'],[],A.wander,{calmWorlds:.7,explorer:.4}),
  w(2,'🍄','glowing mushroom patch','forest','clearing','forest-glow','jungle','A pocket clearing where luminous mushrooms turn the forest floor into a tiny lantern festival.',C.curious,['mushrooms','moss','glow'],[],A.fireflies,{curiosity:.85,collector:.55}),
  w(3,'🌳','ancient mossy oak','forest','forest','forest-mist','jungle','One enormous oak has accumulated enough moss, roots, and secrets to qualify as local infrastructure.',C.calmCurious,['oak','moss','roots'],[],A.wander,{calmWorlds:.6,curiosity:.5}),
  w(4,'🍂','crunchy autumn trail','forest','forest','forest-autumn','jungle','Copper leaves carpet a winding path made specifically for satisfying tiny footsteps.',C.energy,['autumn','path','leaves','pine'],[],['explore','collect','rest'],{energy:.55,explorer:.7}),
  w(5,'🎋','quiet bamboo forest','forest','forest','forest-bamboo','jungle','Tall bamboo sways overhead while the whole grove whispers at exactly library volume.',C.calm,['bamboo','mist','stones'],[],A.wander,{calmWorlds:.85,explorer:.35}),
  w(6,'🐿️','hidden acorn hollow','forest','clearing','forest-mist','jungle','An acorn stash is tucked between roots and suspiciously well organized for a woodland pantry.',C.curious,['oak','acorns','hollow'],['squirrel'],['collect','explore','rest'],{collector:.9,curiosity:.55}),
  w(7,'🪵','fallen log bridge','forest','forest','forest-mist','jungle','A mossy log crosses a miniature ravine and demands dramatically unnecessary balancing.',C.curiousEnergy,['log','moss','ferns','brook'],[],['explore','collect','skip-stones'],{explorer:.8,energy:.5}),
  w(8,'🦌','sunlit deer clearing','forest','clearing','meadow-sun','jungle','A warm shaft of sunlight opens in the trees where a shy deer occasionally pauses.',C.calmCurious,['pine','flowers','dapple'],['deer'],A.wander,{calmWorlds:.55,curiosity:.5}),
  w(9,'🕸️','dewy spiderweb canopy','forest','forest','forest-mist','jungle','Fine webs catch hundreds of droplets overhead, turning the canopy into a suspended constellation.',C.curious,['web','dew','pine','mist'],[],A.wonder,{curiosity:.9,collector:.3}),
  w(10,'🦇','twilight bat cave','forest','cave','forest-twilight','cave','A shallow cave opens beneath twilight trees while tiny bats make looping evening patrols.',C.curious,['cave','twilight','rocks'],['bat'],A.wonder,{curiosity:.75,wildWorlds:.5}),
  w(11,'🦊','sleepy fox den','forest','clearing','forest-autumn','jungle','A leaf-lined den sits beneath tangled roots, currently occupied by one professionally sleepy fox.',C.calmSleepy,['den','autumn','roots'],['fox'],['rest','collect','explore'],{calmWorlds:.8,collector:.25}),
  w(12,'🦉','whispering owl roost','forest','forest','forest-twilight','jungle','A high branch lookout belongs to a round owl who appears to know several things it will not explain.',C.calmCurious,['oak','twilight','stars'],['owl'],A.wonder,{curiosity:.65,calmWorlds:.55}),
  w(13,'🍃','breezy willow weeping','forest','clearing','water-clear','river','Long willow branches sweep over a quiet bank and move like green curtains in the wind.',C.calm,['willow','wind','water'],[],['rest','fish','collect'],{calmWorlds:.9}),
  w(14,'🌲','frosty evergreen stand','forest','forest','forest-frost','alpine','Blue-green pines hold a dusting of frost that flashes whenever the light moves.',C.calmSleepy,['pine','frost','snow'],[],A.snow,{calmWorlds:.55,wildWorlds:.35}),
  w(15,'🌱','sprouting fern gully','forest','forest','forest-glow','jungle','New fern curls unfurl between wet stones in a shaded green gully.',C.curious,['ferns','moss','brook'],[],A.wander,{curiosity:.7,collector:.35}),
  w(16,'🌳','dappled sunlight glade','forest','clearing','meadow-sun','jungle','Moving sun patches drift across soft grass beneath an open ring of trees.',C.calm,['dapple','flowers','oak'],[],['rest','garden','explore'],{calmWorlds:.85}),
  w(17,'🪵','hollow tree hideout','forest','forest','forest-mist','jungle','A giant hollow trunk contains a perfectly creature-sized room with root shelves and leaf flooring.',C.curious,['hollow','oak','moss'],[],['collect','rest','explore'],{curiosity:.72,collector:.58}),
  w(18,'🐻','cozy bear resting spot','forest','clearing','forest-autumn','cave','A sheltered patch of pine needles beside a boulder has been certified extremely nap-compatible.',C.sleepy,['pine','rocks','leaves'],['bear'],['rest','warm-fire','collect'],{calmWorlds:.9}),
  w(19,'🌲','starlit canopy lookout','forest','forest','sky-night','jungle','A tiny platform reaches above the treetops where the night sky suddenly becomes enormous.',C.calmCurious,['pine','stars','lookout'],[],['stargaze','rest','explore'],{curiosity:.72,calmWorlds:.68}),
  w(20,'🍄','fairy ring clearing','forest','clearing','forest-glow','jungle','A perfect mushroom circle glows faintly around a patch of grass with questionable magical zoning.',C.curious,['mushrooms','glow','flowers'],[],A.fireflies,{curiosity:.95,collector:.45}),

  w(21,'🌊','sparkling tide pool','water','shore','water-clear','coast','A clear rock pool catches sunlight, bubbles, shells, and tiny flashes of underwater color.',C.curious,['tidepool','rocks','sparkle'],['fish'],A.activeWater,{curiosity:.7,collector:.55}),
  w(22,'🐚','pastel seashell cove','water','shore','water-sunset','coast','Soft sand gathers pink, cream, and lavender shells in a tiny protected cove.',C.calmCurious,['shells','sand','cove'],[],['collect','rest','skip-stones'],{collector:.9,calmWorlds:.55}),
  w(23,'🏖️','warm sandy dune','water','shore','water-sunset','coast','Warm dunes roll above the sea with tufts of grass and a perfect breeze for doing very little.',C.calm,['dune','sand','grass','wind'],[],['rest','explore','collect'],{calmWorlds:.75,explorer:.3}),
  w(24,'🪸','vibrant coral reef','water','reef','water-lagoon','coast','A miniature reef blooms in impossible colors beneath glass-clear turquoise water.',C.curious,['coral','reef','bubbles'],['fish'],['explore','collect','chase-fireflies'],{curiosity:.9,wildWorlds:.35}),
  w(25,'🐢','lazy turtle lagoon','water','lake','water-lagoon','coast','A warm lagoon is occupied by a turtle whose schedule appears admirably empty.',C.calm,['lagoon','lily-pads','sand'],['turtle'],['rest','fish','collect'],{calmWorlds:.9}),
  w(26,'🦦','playful otter stream','water','river','water-clear','river','A quick little stream winds between smooth rocks while an otter treats it as a personal waterpark.',C.energy,['brook','rocks','reeds'],['otter'],['skip-stones','explore','collect'],{energy:.7,explorer:.55}),
  w(27,'🦢','misty morning lake','water','lake','forest-mist','river','A silver lake disappears into morning fog while a swan makes the whole place unnecessarily elegant.',C.calm,['lake','mist','reeds'],['swan'],['rest','fish','stargaze'],{calmWorlds:.95}),
  w(28,'🐸','lily pad pond','water','lake','water-lagoon','river','Round lily pads make a floating maze across a pond full of tiny frog opinions.',C.curious,['pond','lily-pads','flowers'],['frog'],['collect','fish','rest'],{curiosity:.58,calmWorlds:.55}),
  w(29,'🐟','crystal clear brook','water','river','water-clear','river','A bright brook reveals every pebble on its bed and every tiny fish pretending not to notice you.',C.calmCurious,['brook','rocks','sparkle'],['fish'],A.water,{calmWorlds:.75,collector:.35}),
  w(30,'💦','bubbling forest spring','water','river','water-clear','river','Cold water bubbles from mossy stones beneath the trees and immediately starts a miniature creek.',C.curious,['spring','moss','ferns'],[],A.water,{curiosity:.65,calmWorlds:.6}),
  w(31,'🧊','floating ice floe','water','ice','water-ice','alpine','A little slab of blue-white ice drifts on dark water under an enormous quiet sky.',C.calmSleepy,['ice','snow','water'],[],['explore','stargaze','rest'],{wildWorlds:.55,calmWorlds:.45}),
  w(32,'🛶','peaceful river delta','water','wetland','water-clear','river','Several tiny channels braid through reeds and sandy islands in a slow green delta.',C.calm,['delta','reeds','water','sand'],[],['fish','explore','rest'],{calmWorlds:.8,explorer:.45}),
  w(33,'🦀','rocky crab shore','water','shore','water-clear','coast','Rounded rocks meet foamy water while a crab patrols the shoreline with intense sideways purpose.',C.curiousEnergy,['shore','rocks','foam'],['crab'],['collect','skip-stones','explore'],{collector:.55,energy:.4}),
  w(34,'🌅','glowing sunset bay','water','shore','water-sunset','coast','The whole bay turns peach and gold as the sun drops toward a perfectly flat horizon.',C.calm,['bay','sunset','sand'],[],['rest','stargaze','skip-stones'],{calmWorlds:.9}),
  w(35,'🌊','crashing ocean cliff','water','shore','sky-storm','coast','Foamy water hits a dark cliff below while wind turns the overlook into a tiny heroic expedition.',C.energy,['cliff','waves','wind','rocks'],[],['explore','collect','stargaze'],{wildWorlds:.8,energy:.5}),
  w(36,'🐬','leaping dolphin strait','water','shore','water-clear','coast','A narrow bright-blue channel occasionally launches a dolphin into the air for no practical reason.',C.energy,['strait','waves','sparkle'],['dolphin'],['explore','collect','skip-stones'],{energy:.68,curiosity:.45}),
  w(37,'🐧','snowy penguin beach','water','ice','water-ice','alpine','Snow meets a dark little beach where penguins have mastered both waddling and social clustering.',C.curious,['snow','shore','ice'],['penguin'],['snow-angel','explore','collect'],{curiosity:.58,wildWorlds:.45}),
  w(38,'🌊','bioluminescent bay','water','shore','water-bio','coast','Every little wave glows electric turquoise after dark, leaving light along the shoreline.',C.curious,['bioluminescent','waves','stars'],[],['stargaze','collect','chase-fireflies'],{curiosity:.95,calmWorlds:.45}),
  w(39,'🪨','smooth skipping stone river','water','river','water-clear','river','A broad riverbank contains an absurdly good inventory of flat stones.',C.energy,['river','rocks','reeds'],[],['skip-stones','collect','rest'],{energy:.55,collector:.5}),
  w(40,'🦆','duckling reedy marsh','water','wetland','water-lagoon','river','Tall reeds form little waterways where ducklings travel in a surprisingly disciplined convoy.',C.calmCurious,['marsh','reeds','lily-pads'],['duck'],['explore','fish','rest'],{calmWorlds:.7,curiosity:.4}),

  w(41,'🏔️','alpine flower meadow','mountain','mountain','mountain-alpine','alpine','Tiny alpine flowers cover a high green shelf beneath snow-striped peaks.',C.calmCurious,['mountain','flowers','grass'],[],A.mountain,{explorer:.6,calmWorlds:.5}),
  w(42,'🐐','craggy goat ledge','mountain','mountain','mountain-alpine','alpine','A narrow rocky ledge has somehow become a goat lounge with excellent views.',C.energy,['ledge','rocks','mountain'],['goat'],['explore','build-cairn','collect'],{wildWorlds:.75,energy:.45}),
  w(43,'⛰️','breezy hilltop overlook','mountain','hill','mountain-alpine','alpine','Soft hills fall away below a windy little summit made for staring into distance.',C.calmCurious,['hill','wind','grass'],[],['stargaze','rest','explore'],{explorer:.6,calmWorlds:.6}),
  w(44,'❄️','sparkling snowdrift','mountain','snow','mountain-snow','alpine','Fresh snow heaps into glittering curves that look far too pristine to leave alone.',C.energy,['snowdrift','snow','sparkle'],[],A.snow,{energy:.6,wildWorlds:.45}),
  w(45,'🏂','untouched powder bowl','mountain','snow','mountain-snow','alpine','A broad bowl of untouched powder sits beneath quiet peaks like a tiny blank canvas.',C.energy,['powder','snow','mountain'],[],['snow-angel','explore','build-cairn'],{energy:.75,wildWorlds:.65}),
  w(46,'🏕️','starry high-camp','mountain','mountain','sky-night','alpine','A small high camp, a warm fire, and a ridiculous amount of sky share one rocky shelf.',C.calmCurious,['camp','stars','mountain','campfire'],[],['warm-fire','stargaze','rest'],{calmWorlds:.65,explorer:.65}),
  w(47,'🧊','glistening glacier cave','mountain','cave','water-ice','cave','Blue ice walls curve overhead and throw pale light across a crystal floor.',C.curious,['glacier','cave','ice','crystal'],[],['explore','collect','stargaze'],{curiosity:.9,wildWorlds:.55}),
  w(48,'🌲','snow-dusted timberline','mountain','snow','mountain-snow','alpine','The last little pines before open mountain carry white caps and stubbornly cling to the slope.',C.calmCurious,['pine','snow','mountain'],[],A.mountain,{explorer:.65,calmWorlds:.4}),
  w(49,'🦅','soaring eagle peak','mountain','mountain','mountain-alpine','alpine','A sharp summit stands above the cloud layer while an eagle circles the open air.',C.energy,['peak','clouds','rocks'],['eagle'],A.mountain,{wildWorlds:.8,explorer:.7}),
  w(50,'🗻','misty mountain pass','mountain','mountain','forest-mist','alpine','A narrow pass slips between grey peaks and disappears into cool moving mist.',C.curious,['pass','mist','rocks'],[],A.mountain,{curiosity:.62,explorer:.75}),
  w(51,'🐑','rolling emerald hills','mountain','hill','meadow-sun','meadow','Round green hills stack into the distance while sheep contribute moving white punctuation.',C.calm,['hill','grass','flowers'],['sheep'],['rest','explore','collect'],{calmWorlds:.85}),
  w(52,'🪨','mossy climbing boulder','mountain','hill','forest-mist','alpine','A huge mossy boulder sits in a clearing and clearly expects to be climbed despite being eight feet tall in tiny-person units.',C.energy,['boulder','moss','ferns'],[],['explore','build-cairn','collect'],{energy:.65,explorer:.7}),
  w(53,'⛰️','echoing canyon gorge','mountain','canyon','desert-sun','alpine','Layered canyon walls squeeze around a shadowy gorge where every tiny noise feels important.',C.curiousEnergy,['canyon','rocks','shadow'],[],A.mountain,{wildWorlds:.8,curiosity:.65}),
  w(54,'🌅','sunrise summit','mountain','mountain','mountain-sunrise','alpine','Warm sunrise spills over the horizon and catches every edge of the summit rocks.',C.calmCurious,['sunrise','peak','clouds'],[],['stargaze','rest','build-cairn'],{calmWorlds:.72,explorer:.55}),
  w(55,'🌋','sleepy volcano caldera','mountain','volcanic','mountain-volcanic','alpine','An ancient caldera rests under a hazy sky with just enough warmth to suggest the mountain is merely napping.',C.curious,['caldera','volcano','rocks'],[],['explore','collect','build-cairn'],{curiosity:.8,wildWorlds:.7}),
  w(56,'🐕','snowy husky trail','mountain','snow','mountain-snow','alpine','A packed trail zigzags through deep snow while an enthusiastic husky insists the route is obvious.',C.energy,['snow','trail','pine'],['husky'],['explore','snow-angel','collect'],{energy:.8,explorer:.65}),
  w(57,'🧣','chilly alpine ridge','mountain','snow','mountain-snow','alpine','Wind combs over a narrow snowy ridge where a tiny scarf suddenly feels like critical infrastructure.',C.curiousEnergy,['ridge','snow','wind'],[],A.mountain,{wildWorlds:.65,explorer:.7}),
  w(58,'🧊','frozen waterfall wall','mountain','snow','water-ice','alpine','A waterfall has stopped mid-fall into blue columns and glassy icicles.',C.curious,['waterfall','ice','rocks'],[],['explore','collect','build-cairn'],{curiosity:.8,collector:.35}),
  w(59,'🏔️','jagged granite spire','mountain','mountain','mountain-alpine','alpine','One ridiculous granite tooth rises above broken rock and makes the tiny horizon look gigantic.',C.energy,['spire','granite','rocks'],[],A.mountain,{wildWorlds:.85,explorer:.75}),
  w(60,'☁️','cloud-kissed peak','mountain','mountain','sky-night','alpine','Low clouds drift directly across a high summit, hiding and revealing the view every few seconds.',C.calmCurious,['peak','clouds','mist'],[],['stargaze','rest','explore'],{curiosity:.55,calmWorlds:.55}),

  w(61,'🌻','towering sunflower field','meadow','field','meadow-sun','meadow','Sunflowers rise far above the little explorer like a cheerful yellow forest.',C.energy,['sunflowers','field','sun'],[],['explore','garden','collect'],{energy:.45,collector:.35}),
  w(62,'🦋','fluttering butterfly garden','meadow','garden','meadow-floral','meadow','A dense flower garden has become an unofficial butterfly airport.',C.calmCurious,['flowers','garden','petals'],['butterfly'],A.garden,{calmWorlds:.7,curiosity:.5}),
  w(63,'🐝','buzzing clover patch','meadow','meadow','meadow-sun','meadow','A clover patch hums softly while round bees commute between tiny white flowers.',C.curious,['clover','flowers','grass'],['bee'],A.garden,{collector:.4,curiosity:.5}),
  w(64,'🌾','swaying tall grass','meadow','field','meadow-gold','meadow','Tall grass moves in slow waves and repeatedly hides the tiny character from the camera.',C.calm,['tall-grass','wind','field'],[],['rest','explore','stargaze'],{calmWorlds:.88}),
  w(65,'🌷','blooming tulip valley','meadow','garden','meadow-floral','meadow','Rows of tulips spill down a shallow valley in blocks of soft color.',C.calmCurious,['tulips','flowers','valley'],[],A.garden,{collector:.55,calmWorlds:.65}),
  w(66,'🍓','wild strawberry patch','meadow','meadow','meadow-sun','meadow','Small red berries hide beneath leaves like edible collectibles with excellent level design.',C.curious,['berries','flowers','grass'],[],['collect','garden','rest'],{collector:.95,curiosity:.45}),
  w(67,'🍒','blossoming cherry orchard','meadow','garden','meadow-floral','meadow','Pale blossoms drift between neat little trees and gather along the path.',C.calm,['cherry','petals','path'],[],['rest','collect','stargaze'],{calmWorlds:.9,collector:.3}),
  w(68,'🍇','tangled grape arbor','meadow','garden','meadow-floral','meadow','Vines curl over a tiny arbor with clusters of purple fruit hanging at suspiciously convenient heights.',C.curious,['grapes','vines','garden'],[],['collect','garden','rest'],{collector:.85,curiosity:.45}),
  w(69,'🪴','secret walled garden','meadow','garden','meadow-floral','cave','A stone wall hides a pocket garden with mossy corners and one narrow gate.',C.curious,['garden-wall','flowers','moss'],[],A.garden,{curiosity:.75,calmWorlds:.6}),
  w(70,'🌸','falling petal path','meadow','garden','meadow-floral','meadow','A path beneath flowering trees is continuously repaved by falling pink petals.',C.calm,['petals','cherry','path'],[],['explore','rest','collect'],{calmWorlds:.85,explorer:.35}),
  w(71,'🌾','golden wheat field','meadow','field','meadow-gold','meadow','A golden field stretches to a tiny horizon while grain heads glow in low light.',C.calm,['wheat','field','wind'],[],['rest','explore','stargaze'],{calmWorlds:.82}),
  w(72,'🐇','hopping bunny meadow','meadow','meadow','meadow-sun','meadow','Soft grass, little flowers, and one rabbit who has interpreted the meadow as a trampoline.',C.curiousEnergy,['grass','flowers','hill'],['bunny'],['explore','collect','garden'],{energy:.42,curiosity:.4}),
  w(73,'🐞','ladybug leaf cluster','meadow','garden','meadow-floral','meadow','Huge overlapping leaves host tiny red ladybugs like moving enamel buttons.',C.curious,['leaves','flowers','dew'],['ladybug'],['collect','garden','rest'],{collector:.65,curiosity:.7}),
  w(74,'🐌','rainy snail trail','meadow','meadow','meadow-rain','meadow','Fresh rain darkens the path while a snail leaves an extremely committed silver route across it.',C.calm,['rain','path','moss'],['snail'],['rest','collect','explore'],{calmWorlds:.75,curiosity:.35}),
  w(75,'🌾','breezy lavender field','meadow','field','meadow-floral','meadow','Rows of lavender ripple purple in the breeze and make the tiny world feel suspiciously expensive.',C.calm,['lavender','field','wind'],[],['rest','garden','stargaze'],{calmWorlds:.95}),
  w(76,'🌼','dandelion wish hill','meadow','hill','meadow-sun','meadow','A small hill is covered in dandelion puffballs waiting for one poorly aimed gust.',C.calmCurious,['dandelions','hill','wind'],[],['collect','rest','explore'],{curiosity:.45,calmWorlds:.65}),
  w(77,'🐛','fuzzy caterpillar branch','meadow','garden','meadow-floral','jungle','One low branch has become a very slow elevated walkway for a fuzzy green caterpillar.',C.curious,['branch','leaves','flowers'],['caterpillar'],['collect','explore','rest'],{curiosity:.8,collector:.35}),
  w(78,'🕸️','frosty morning meadow','meadow','meadow','forest-frost','meadow','Frost outlines every blade of grass and a few tiny webs before the morning sun reaches them.',C.calm,['frost','web','grass','dew'],[],['rest','collect','stargaze'],{calmWorlds:.85,collector:.25}),
  w(79,'🍄','wild truffle hideaway','meadow','forest','forest-mist','jungle','A damp little grove hides truffles beneath leaves and turns every patch of soil into a treasure hunt.',C.curious,['mushrooms','leaves','moss'],[],['collect','explore','rest'],{collector:.95,curiosity:.7}),
  w(80,'🌹','thorny rose bramble','meadow','garden','meadow-floral','jungle','Wild roses make a beautiful tangled wall with a strong opinion about personal space.',C.curious,['roses','vines','flowers'],[],['collect','explore','garden'],{curiosity:.55,wildWorlds:.35}),

  w(81,'🌵','blooming saguaro desert','beyond','desert','desert-sun','alpine','Tall saguaros carry bright desert flowers beneath a huge warm sky.',C.curiousEnergy,['cactus','flowers','sand'],[],['explore','collect','stargaze'],{wildWorlds:.6,explorer:.7}),
  w(82,'🏜️','painted sandstone canyon','beyond','canyon','desert-sun','alpine','Striped sandstone walls fold into a miniature canyon painted in rust, peach, and gold.',C.curious,['sandstone','canyon','rocks'],[],A.mountain,{curiosity:.75,explorer:.7}),
  w(83,'🦎','sun-baked lizard rock','beyond','desert','desert-sun','alpine','A broad warm rock has been claimed by a small lizard with impeccable basking instincts.',C.energy,['rocks','sand','sun'],['lizard'],['explore','collect','rest'],{wildWorlds:.45,energy:.35}),
  w(84,'🦂','quiet desert oasis','beyond','desert','desert-oasis','river','A ring of green surrounds a tiny blue pool tucked between warm dunes.',C.calmCurious,['oasis','palm','sand','water'],['scorpion'],['rest','collect','stargaze'],{calmWorlds:.55,curiosity:.6}),
  w(85,'🌌','sparkling Milky Way sky','beyond','sky','sky-night','alpine','The ground goes quiet beneath a dense river of stars stretching from horizon to horizon.',C.calmCurious,['milky-way','stars','rocks'],[],['stargaze','rest','build-cairn'],{curiosity:.8,calmWorlds:.75}),
  w(86,'🌠','shooting star overlook','beyond','hill','sky-night','alpine','A dark overlook faces an open sky where meteors occasionally scratch bright lines overhead.',C.curious,['meteor','stars','hill'],[],['stargaze','collect','rest'],{curiosity:.9,explorer:.4}),
  w(87,'🌕','bright harvest moon field','beyond','field','sky-night','meadow','A huge warm moon hangs over a quiet field and turns every grass tip silver.',C.calmSleepy,['moon','field','grass'],[],['stargaze','rest','collect'],{calmWorlds:.95}),
  w(88,'🌈','colorful post-rain rainbow','beyond','meadow','meadow-rain','meadow','Rain has just stopped, everything is glossy, and a broad rainbow sits absurdly close to the ground.',C.all,['rainbow','rain','flowers','dew'],[],['explore','collect','chase-fireflies'],{curiosity:.65,calmWorlds:.5}),
  w(89,'🌩️','distant rolling thunderstorm','beyond','hill','sky-storm','alpine','Dark clouds rumble beyond the hills while the tiny foreground remains safely dry and dramatic.',C.curiousEnergy,['thunder','clouds','wind'],[],['stargaze','explore','rest'],{wildWorlds:.8,curiosity:.5}),
  w(90,'🌬️','dancing dust devil plain','beyond','desert','desert-sun','alpine','A tiny column of dust spins across the plain and keeps changing its mind about direction.',C.energy,['dust-devil','sand','wind'],[],['explore','collect','build-cairn'],{energy:.75,wildWorlds:.7}),
  w(91,'☁️','fluffy cloud shadow valley','beyond','hill','mountain-alpine','meadow','Big soft clouds paint moving islands of shade across a green valley.',C.calm,['clouds','hill','grass','dapple'],[],['rest','explore','stargaze'],{calmWorlds:.88}),
  w(92,'🦇','desert twilight flight','beyond','desert','forest-twilight','alpine','Purple twilight cools the desert while bats zip between silhouetted rocks.',C.curious,['twilight','sand','rocks'],['bat'],['explore','stargaze','collect'],{curiosity:.72,wildWorlds:.45}),
  w(93,'🏜️','rusty red rock arch','beyond','desert','desert-sun','alpine','A red sandstone arch frames a tiny slice of blue sky like nature built its own portal.',C.curiousEnergy,['red-arch','sandstone','rocks'],[],['explore','build-cairn','collect'],{explorer:.85,curiosity:.6}),
  w(94,'🌵','prickly pear patch','beyond','desert','desert-oasis','alpine','Flat green cactus pads bloom with bright flowers across a rocky patch.',C.curious,['prickly-pear','flowers','rocks'],[],['collect','explore','garden'],{collector:.45,curiosity:.55}),
  w(95,'🧊','sparkling frost window','beyond','sky','forest-frost','cave','Crystal frost branches across an icy opening, framing the outside world through geometric lace.',C.calmCurious,['frost','crystal','ice','window'],[],['collect','stargaze','rest'],{curiosity:.78,calmWorlds:.65}),
  w(96,'🌋','black sand beach','beyond','shore','volcanic-shore','coast','Dark volcanic sand meets steel-blue water beneath warm rust-colored cliffs.',C.curiousEnergy,['black-sand','waves','volcano','rocks'],[],['explore','collect','skip-stones'],{wildWorlds:.72,explorer:.62}),
  w(97,'🌠','shimmering aurora borealis','beyond','snow','sky-aurora','alpine','Green and violet light ribbons drift above a snow field with impossible quiet.',C.calmCurious,['aurora','stars','snow'],[],['stargaze','snow-angel','rest'],{curiosity:.85,calmWorlds:.75}),
  w(98,'🌒','crescent moon lake reflection','beyond','lake','sky-night','river','A thin moon hangs above perfectly still water and appears again upside down beneath it.',C.calmSleepy,['moon','lake','reflection','stars'],[],['stargaze','rest','fish'],{calmWorlds:.98}),
  w(99,'☄️','fiery meteor shower ridge','beyond','mountain','sky-night','alpine','A dark ridge becomes front-row seating for a busy meteor shower.',C.curiousEnergy,['meteor','stars','ridge','glow'],[],['stargaze','build-cairn','explore'],{curiosity:.9,wildWorlds:.55}),
  w(100,'🌍','quiet edge of the world','beyond','hill','sky-night','alpine','Land falls away into cloud and stars at a peaceful little place that feels like the map simply ends.',C.calmCurious,['world-edge','clouds','stars','rocks'],[],['stargaze','rest','build-cairn'],{curiosity:.9,calmWorlds:.8,explorer:.65}),
];

if (NATURE_WORLDS.length !== 100) {
  throw new Error(`Nature atlas must contain exactly 100 worlds; found ${NATURE_WORLDS.length}.`);
}

export const NATURE_WORLD_BY_ID = Object.fromEntries(
  NATURE_WORLDS.map((world) => [world.id, world])
) as Record<string, NatureWorldDefinition>;

export const NATURE_WORLD_THEMES: Array<{ id: NatureWorldTheme; label: string; icon: string }> = [
  { id: 'forest', label: 'forests', icon: '🌲' },
  { id: 'water', label: 'waters', icon: '🌊' },
  { id: 'mountain', label: 'mountains', icon: '🏔️' },
  { id: 'meadow', label: 'meadows', icon: '🌼' },
  { id: 'beyond', label: 'skies + beyond', icon: '🌌' },
];

export function getNatureWorld(worldId: string): NatureWorldDefinition {
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
    return {
      schemaVersion: 1,
      discovered: Array.isArray(parsed.discovered) ? parsed.discovered.filter((id): id is string => typeof id === 'string' && valid.has(id)).slice(0, 100) : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((id): id is string => typeof id === 'string' && valid.has(id)).slice(0, 100) : [],
      visits: Object.fromEntries(Object.entries(parsed.visits ?? {}).filter(([id]) => valid.has(id)).map(([id, count]) => [id, Math.max(0, Math.floor(Number(count) || 0))])),
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((id): id is string => typeof id === 'string' && valid.has(id)).slice(0, 12) : [],
    };
  } catch {
    return createDefaultAtlasProgress();
  }
}

export function recordAtlasVisit(progress: NatureAtlasProgress, worldId: string): NatureAtlasProgress {
  const world = getNatureWorld(worldId);
  const discovered = progress.discovered.includes(world.id) ? progress.discovered : [...progress.discovered, world.id];
  return {
    ...progress,
    discovered,
    visits: { ...progress.visits, [world.id]: (progress.visits[world.id] ?? 0) + 1 },
    recent: [world.id, ...progress.recent.filter((id) => id !== world.id)].slice(0, 12),
  };
}

export function toggleAtlasFavorite(progress: NatureAtlasProgress, worldId: string): NatureAtlasProgress {
  const id = getNatureWorld(worldId).id;
  const favorites = progress.favorites.includes(id)
    ? progress.favorites.filter((entry) => entry !== id)
    : [...progress.favorites, id];
  return { ...progress, favorites };
}

function moodMatch(world: NatureWorldDefinition, mood: PersonaMoodSelfReport): number {
  return world.moods.includes(mood) ? 0.22 : 0;
}

export function scoreNatureWorld(
  profile: PersonaWorldProfile,
  progress: NatureAtlasProgress,
  world: NatureWorldDefinition,
  mood: PersonaMoodSelfReport
): number {
  const traitScore = Object.entries(world.traitBias).reduce(
    (sum, [trait, weight]) => sum + profile.traits[trait as PersonaTrait] * Number(weight),
    0
  );
  const baseAffinity = profile.biomeAffinity[world.baseBiome] ?? 0.5;
  const visits = progress.visits[world.id] ?? 0;
  const novelty = 0.24 / (1 + visits * 0.65);
  const favorite = progress.favorites.includes(world.id) ? 0.12 : 0;
  return traitScore * 0.42 + baseAffinity * 0.24 + moodMatch(world, mood) + novelty + favorite;
}

export function suggestNatureWorld(
  profile: PersonaWorldProfile,
  progress: NatureAtlasProgress,
  mood: PersonaMoodSelfReport,
  offset = 0
): NatureWorldDefinition {
  const ranked = [...NATURE_WORLDS]
    .map((world) => ({ world, score: scoreNatureWorld(profile, progress, world, mood) }))
    .sort((a, b) => b.score - a.score || a.world.index - b.world.index);
  return ranked[Math.abs(offset) % ranked.length]?.world ?? NATURE_WORLDS[0];
}

export function suggestWorldActivity(
  profile: PersonaWorldProfile,
  world: NatureWorldDefinition,
  mood: PersonaMoodSelfReport,
  offset = 0
): PersonaActivity {
  const ranked = world.activities
    .map((activity) => {
      const count = profile.activityCounts[activity] ?? 0;
      const novelty = 0.32 / (1 + count * 0.5);
      const moodBoost =
        mood === 'sleepy' && ['rest','stargaze','warm-fire','fish'].includes(activity) ? 0.32 :
        mood === 'energized' && ['explore','skip-stones','snow-angel','chase-fireflies'].includes(activity) ? 0.3 :
        mood === 'curious' && ['explore','collect','stargaze','chase-fireflies'].includes(activity) ? 0.25 :
        mood === 'calm' && ['garden','rest','fish','warm-fire','stargaze'].includes(activity) ? 0.26 : 0;
      return { activity, score: novelty + moodBoost };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[Math.abs(offset) % ranked.length]?.activity ?? world.activities[0] ?? 'explore';
}

export function recordNatureAdventure(
  profile: PersonaWorldProfile,
  world: NatureWorldDefinition,
  activity: PersonaActivity,
  mood: PersonaMoodSelfReport
): PersonaWorldProfile {
  const next = recordAdventure(profile, world.baseBiome, activity, mood);
  const first = next.memories[0];
  if (!first) return next;
  return {
    ...next,
    memories: [
      { ...first, note: `${ACTIVITIES[activity].memory} in ${world.name}.` },
      ...next.memories.slice(1),
    ],
  };
}

export function explainNatureRecommendation(
  profile: PersonaWorldProfile,
  progress: NatureAtlasProgress,
  world: NatureWorldDefinition,
  mood: PersonaMoodSelfReport
): string {
  const strongest = Object.entries(world.traitBias)
    .map(([trait, weight]) => ({ trait: trait as PersonaTrait, score: profile.traits[trait as PersonaTrait] * Number(weight) }))
    .sort((a, b) => b.score - a.score)[0]?.trait ?? 'curiosity';
  const visitCount = progress.visits[world.id] ?? 0;
  const novelty = visitCount === 0 ? 'It is still undiscovered, so novelty gives it a small boost.' : `You have visited it ${visitCount} time${visitCount === 1 ? '' : 's'}, so the director gently favors less-seen places.`;
  return `${world.name} matches your editable ${strongest} game preference and the current ${mood} visit mood. ${novelty} Mood affects this recommendation only; explicit choices update the saved persona.`;
}
