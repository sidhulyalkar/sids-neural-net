/** Deliberately unserious names. Seed is stored with a round so its nine
 * holes keep their identities across scorecard views, refreshes and replays. */
export const DISC_GOLF_FUNNY_NAMES=[
 "Certified Goose Problem","Unauthorized Pancake","Bigfoot's Parking Ticket",
 "Duck Duck Bogey","Emotional Support Frisbee","Sir Throws-a-Lot",
 "The Shrimp Incident","Oops! All Trees","Aggressive Noodle",
 "The Last Brain Cell","Rotisserie Regret","Someone Ate My Disc",
 "Slightly Feral","Tax Evasion Alley","Attack of the Lawn Chair",
 "Not a Fetch Quest","FBI: Frisbee Bureau","The Disc Is Lava",
 "Hot Dog Economics","Questionable Aerodynamics","Flight Risk",
 "Chaos Goblin","Par Wars","That's Not a Duck",
 "Dude, Where's My Basket?","Tree Attorney","Unsupervised Potato",
] as const;
export function discGolfName(index:number,seed:number):string{
 const count=DISC_GOLF_FUNNY_NAMES.length;
 const normalized=Math.max(0,Math.floor(Number.isFinite(seed)?seed:0));
 const start=normalized%count;
 const stride=Math.floor(normalized/count)%2===0?5:7;
 const hole=Math.max(0,Math.floor(Number.isFinite(index)?index:0));
 return DISC_GOLF_FUNNY_NAMES[(start+hole*stride)%count];
}
export function newDiscGolfNameSeed():number{
 return Math.floor(Math.random()*0x7fffffff);
}
