// Item keys and their economic definitions, derived from balance.js.
import { BALANCE as B } from "../config/balance.js";

export const SPECIES = ["chicken", "cow", "horse"];
export const CROPS = ["daisy", "wheat", "tulip", "cabbage", "sunflower", "lavender"];
export const SEEDS = CROPS.map((c) => "seed_" + c);
export const FEEDS = Object.keys(B.feed);
export const KITS = ["kit_bed", "kit_coop", "kit_barn", "kit_stable"];
export const BUILDING_TYPES = ["coop", "barn", "stable"];
export const cropGood = (crop) => B.crops[crop].good ?? crop;
export const GOODS = [...new Set([...CROPS.map(cropGood), "egg", "milk"])];
export const ANIMAL_ITEMS = SPECIES.flatMap((sp) =>
  ["f", "m"].map((sex) => ({ key: `animal_${sp}_${sex}`, sp, sex })),
);

export function itemKind(key) {
  if (["fence", "gate"].includes(key)) return "fence";
  if (["hand", "can", "fish", "flashlight"].includes(key)) return "tool";
  if (SEEDS.includes(key)) return "seed";
  if (FEEDS.includes(key)) return "feed";
  if (KITS.includes(key)) return "kit";
  if (GOODS.includes(key)) return "good";
  if (key?.startsWith("animal_")) return "animal";
  return null;
}

export const kitType = (key) => key.slice(4); // kit_barn -> barn
export const seedCrop = (key) => key.slice(5); // seed_tulip -> tulip

// Base unit value of a sellable good before the daily drift.
export function goodBaseValue(key) {
  if (key in B.goods) return B.goods[key];
  const crop = CROPS.find((c) => cropGood(c) === key);
  return crop ? B.crops[crop].sell : 0;
}

// Which foods each species accepts, best first.
export const foodsFor = (sp) => B.species[sp].food;

export const BUY_ORDER = [...SEEDS, ...FEEDS, ...ANIMAL_ITEMS.map((a) => a.key), "kit_coop", "kit_barn", "kit_stable", "kit_bed", "fence", "gate"];
