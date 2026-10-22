import { NIGHT_ICONS } from "./night-icons.js";
// Icon-only interface: every glyph is an inline SVG on a 48x48 grid using the
// garden palette. No letters anywhere.
import { PALETTE as C } from './theme/palette.js';
export { PALETTE } from './theme/palette.js';
const svg = (body, vb = "0 0 48 48") => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const S = `stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- glyph parts (no outer svg) ----------
const parts = {
  clock: `<circle cx="24" cy="24" r="17" fill="${C.paper}" ${S}/><path d="M24 13v12l8 5" fill="none" ${S}/>`,
  coin: `<circle cx="24" cy="24" r="17" fill="${C.gold}" ${S}/><circle cx="24" cy="24" r="11.5" fill="none" stroke="${C.goldDark}" stroke-width="2"/><path d="M24 31c0-6 0-9 0-13m0 4c-3-4-7-3-8-1 3 2 6 2 8 1m0-2c2-4 6-4 8-2-2 3-5 3-8 2" fill="${C.cream}" stroke="${C.goldDark}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  daisy: `<path d="M24 44V27" stroke="${C.leaf}" stroke-width="3" stroke-linecap="round"/><path d="M24 36c-6-1-9-5-9-8 5 0 8 3 9 8" fill="${C.sage}" stroke="${C.sageDark}" stroke-width="1.5"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="24" cy="10" rx="4" ry="7" fill="${C.white}" stroke="${C.stone}" stroke-width="1.3" transform="rotate(${a} 24 19)"/>`).join("")}<circle cx="24" cy="19" r="5" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5"/>`,
  tulip: `<path d="M24 44V26" stroke="${C.leaf}" stroke-width="3" stroke-linecap="round"/><path d="M24 40c-7-2-10-8-9-13 6 2 9 7 9 13m0-2c6-2 9-7 9-12-6 1-9 6-9 12" fill="${C.sage}" stroke="${C.sageDark}" stroke-width="1.5"/><path d="M14 10l5 5 5-8 5 8 5-5v9c0 6-4 10-10 10s-10-4-10-10Z" fill="${C.terra}" ${S}/>`,
  sunflower: `<path d="M24 45V30" stroke="${C.leaf}" stroke-width="3" stroke-linecap="round"/><path d="M24 39c-6 0-9-4-10-8 5 0 9 3 10 8" fill="${C.sage}" stroke="${C.sageDark}" stroke-width="1.5"/>${Array.from({ length: 12 }, (_, i) => `<ellipse cx="24" cy="5.5" rx="3.2" ry="6" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.2" transform="rotate(${i * 30} 24 18)"/>`).join("")}<circle cx="24" cy="18" r="7" fill="${C.woodDark}" stroke="${C.ink}" stroke-width="1.6"/><circle cx="22" cy="16" r="1.2" fill="${C.wood}"/><circle cx="26" cy="19" r="1.2" fill="${C.wood}"/><circle cx="22" cy="20.5" r="1" fill="${C.wood}"/>`,
  lavender: `<path d="M16 44c2-12 4-20 8-30m0 30V12m8 32c-2-12-4-20-8-30" fill="none" stroke="${C.leaf}" stroke-width="2.4" stroke-linecap="round"/>${[
    [16, 18],
    [24, 10],
    [32, 18],
  ]
    .map(([x, y]) =>
      [0, 1, 2, 3, 4]
        .map((k) => `<ellipse cx="${x + (k % 2 ? 2.4 : -2.4)}" cy="${y + k * 4}" rx="2.8" ry="3.6" fill="${k % 2 ? C.lav : C.lavDark}"/>`)
        .join(""),
    )
    .join("")}`,
  cabbage: `<path d="M8 28c0-11 7-18 16-18s16 7 16 18-7 14-16 14S8 39 8 28Z" fill="${C.sage}" ${S}/><path d="M14 30c0-8 4-13 10-13s10 5 10 13" fill="#a8c695" stroke="${C.sageDark}" stroke-width="1.8"/><path d="M24 42V20m-8 18 8-8 8 8" fill="none" stroke="${C.sageDark}" stroke-width="1.6" stroke-linecap="round"/>`,
  hay: `<path d="M7 18l6-6h22l6 6v18l-6 6H13l-6-6Z" fill="${C.gold}" ${S}/><path d="M7 18h34M13 12v30m22-30v30" stroke="${C.goldDark}" stroke-width="1.6"/><path d="M18 18v24m6-24v24m6-24v24" stroke="${C.terra}" stroke-width="3"/><path d="M10 25h4m4 7h4m8-9h4m-2 11h4" stroke="${C.goldDark}" stroke-width="1.4" stroke-linecap="round"/>`,
  egg: `<path d="M24 6c8 0 14 13 14 22s-6 15-14 15-14-6-14-15S16 6 24 6Z" fill="${C.cream}" ${S}/><path d="M17 26c0-6 3-12 6-14" fill="none" stroke="${C.white}" stroke-width="3" stroke-linecap="round"/>`,
  milk: `<path d="M14 18l4-8h12l4 8v24H14Z" fill="${C.white}" ${S}/><path d="M18 10h12l-3-4h-6Z" fill="${C.sky}" ${S}/><path d="M14 18h20" stroke="${C.ink}" stroke-width="2"/><path d="M14 27h20v9H14Z" fill="${C.sky}"/><path d="M20 31a4 3 0 1 0 8 0" fill="none" stroke="${C.white}" stroke-width="1.8" stroke-linecap="round"/><path d="M14 18l4-8h12l4 8v24H14Z" fill="none" ${S}/>`,
  heart: `<path d="M24 40C2 26 12 6 24 17 36 6 46 26 24 40Z" fill="${C.blush}" ${S}/>`,
  drop: `<path d="M24 6C20 14 11 22 11 30a13 13 0 0 0 26 0c0-8-9-16-13-24Z" fill="${C.sky}" ${S}/><path d="M17 30c0 4 3 7 6 7" fill="none" stroke="${C.skyLight}" stroke-width="3" stroke-linecap="round"/>`,
  grain: `<path d="M24 44V12" stroke="${C.goldDark}" stroke-width="2.4" stroke-linecap="round"/>${[14, 21, 28]
    .map((y) => `<ellipse cx="18" cy="${y}" rx="5" ry="3" transform="rotate(-35 18 ${y})" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.4"/><ellipse cx="30" cy="${y}" rx="5" ry="3" transform="rotate(35 30 ${y})" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.4"/>`)
    .join("")}<ellipse cx="24" cy="8" rx="3" ry="5" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.4"/>`,
  hand: `<path d="M17 40c-4-3-8-9-9-13-1-3 2-5 4-3l4 4V11a3 3 0 0 1 6 0v11-14a3 3 0 0 1 6 0v14-11a3 3 0 0 1 6 0v13-8a3 3 0 0 1 6 0v12c0 8-4 13-11 14Z" fill="${C.cream}" ${S}/><path d="M22 22v6m6-6v6m6-5v5" stroke="${C.wood}" stroke-width="1.6" stroke-linecap="round"/>`,
  can: `<path d="M9 22c-6-10 2-14 7-8" fill="none" stroke="${C.woodDark}" stroke-width="3" stroke-linecap="round"/><path d="M11 18h20l-2 22H13Z" fill="${C.sky}" ${S}/><path d="M29 24l9-7 4 4-11 9" fill="${C.skyLight}" ${S}/><path d="M39 13l5-2m-4 6 5 1m-9-7 1-5" stroke="${C.sky}" stroke-width="2.2" stroke-linecap="round"/><path d="M15 24h11" stroke="${C.skyLight}" stroke-width="2.5" stroke-linecap="round"/>`,
  fishfood: `<path d="M12 14h24v28H12Z" fill="${C.wood}" ${S}/><path d="M10 8h28v7H10Z" fill="${C.sage}" ${S}/><path d="M16 28c5-7 12-7 16 0-4 7-11 7-16 0Zm16 0 5-4v8Z" fill="${C.terra}" stroke="${C.terraDark}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="20.5" cy="27" r="1.3" fill="${C.ink}"/>`,
  stall: `<path d="M8 44V22m32 22V22" stroke="${C.woodDark}" stroke-width="3" stroke-linecap="round"/><path d="M6 32h36v6H6Z" fill="${C.wood}" ${S}/><path d="M4 16 10 6h28l6 10Z" fill="${C.terra}" ${S}/><path d="M4 16c2 5 6 5 8 0 2 5 6 5 8 0 2 5 6 5 8 0 2 5 6 5 8 0 2 5 6 5 8 0" fill="${C.cream}" ${S}/><path d="M17 6l-3 10m10-10v10m7-10 3 10" stroke="${C.cream}" stroke-width="2.4"/><circle cx="16" cy="29" r="3" fill="${C.terra}"/><circle cx="24" cy="29" r="3" fill="${C.gold}"/><circle cx="32" cy="29" r="3" fill="${C.sage}"/>`,
  basket: `<path d="M8 20h32l-4 22H12Z" fill="${C.wood}" ${S}/><path d="M14 20c0-9 5-14 10-14s10 5 10 14" fill="none" stroke="${C.woodDark}" stroke-width="3" stroke-linecap="round"/><path d="M12 28h24M13 35h22M18 20l2 22m10-22-2 22" stroke="${C.woodDark}" stroke-width="1.6"/>`,
  coins: `<ellipse cx="20" cy="36" rx="12" ry="5" fill="${C.goldDark}" ${S}/><ellipse cx="20" cy="30" rx="12" ry="5" fill="${C.gold}" ${S}/><ellipse cx="20" cy="24" rx="12" ry="5" fill="${C.gold}" ${S}/><path d="M36 26V8m-6 6 6-6 6 6" fill="none" stroke="${C.sageDark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="M14 14l20 20M34 14 14 34" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>`,
  check: `<path d="M11 25l9 9 17-19" fill="none" stroke="${C.white}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: `<path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/><rect x="10" y="21" width="28" height="22" rx="5" fill="${C.gold}" ${S}/><circle cx="24" cy="30" r="3" fill="${C.ink}"/><path d="M24 31v6" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`,
  unlock: `<path d="M15 22v-6a9 9 0 0 1 17-4" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/><rect x="10" y="21" width="28" height="22" rx="5" fill="${C.gold}" ${S}/><circle cx="24" cy="30" r="3" fill="${C.ink}"/><path d="M24 31v6" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`,
  all: `<ellipse cx="17" cy="33" rx="9" ry="4" fill="${C.gold}" ${S}/><ellipse cx="17" cy="27" rx="9" ry="4" fill="${C.gold}" ${S}/><ellipse cx="31" cy="33" rx="9" ry="4" fill="${C.gold}" ${S}/><ellipse cx="31" cy="27" rx="9" ry="4" fill="${C.gold}" ${S}/><ellipse cx="24" cy="21" rx="9" ry="4" fill="${C.gold}" ${S}/><ellipse cx="24" cy="15" rx="9" ry="4" fill="${C.gold}" ${S}/>`,
  sun: `<circle cx="24" cy="24" r="8" fill="${C.gold}" ${S}/>${Array.from({ length: 8 }, (_, i) => `<path d="M24 6v5" stroke="${C.goldDark}" stroke-width="3" stroke-linecap="round" transform="rotate(${i * 45} 24 24)"/>`).join("")}`,
  moon: `<path d="M31 37A15 15 0 1 1 22 9a12 12 0 0 0 9 28Z" fill="${C.cream}" ${S}/><circle cx="35" cy="12" r="1.8" fill="${C.cream}"/><circle cx="40" cy="21" r="1.2" fill="${C.cream}"/>`,
  speaker: `<path d="M8 19h7l9-8v26l-9-8H8Z" fill="${C.cream}" ${S}/><path d="M30 17c4 4 4 10 0 14m5-19c7 7 7 17 0 24" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>`,
  muted: `<path d="M8 19h7l9-8v26l-9-8H8Z" fill="${C.cream}" ${S}/><path d="M31 19l10 10m0-10L31 29" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>`,
  up: `<path d="M24 12 34 26H14Z" fill="${C.sage}" stroke="${C.sageDark}" stroke-width="2" stroke-linejoin="round"/><path d="M24 26v10" stroke="${C.sageDark}" stroke-width="4" stroke-linecap="round"/>`,
  down: `<path d="M24 36 34 22H14Z" fill="${C.terra}" stroke="${C.terraDark}" stroke-width="2" stroke-linejoin="round"/><path d="M24 22V12" stroke="${C.terraDark}" stroke-width="4" stroke-linecap="round"/>`,
  house: `<path d="M8 24 24 10l16 14v18H8Z" fill="${C.cream}" ${S}/><path d="M20 42V30h8v12" fill="${C.wood}" ${S}/>`,
  female: `<circle cx="24" cy="18" r="9" fill="none" stroke="${C.terra}" stroke-width="4"/><path d="M24 27v15m-6-7h12" stroke="${C.terra}" stroke-width="4" stroke-linecap="round"/>`,
  male: `<circle cx="20" cy="28" r="9" fill="none" stroke="${C.sky}" stroke-width="4"/><path d="M27 21 39 9m-9 0h9v9" fill="none" stroke="${C.sky}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  sparkle: `<path d="M24 4c2 10 6 14 16 16-10 2-14 6-16 16-2-10-6-14-16-16 10-2 14-6 16-16Z" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1.5" stroke-linejoin="round"/>`,
};

// Animal heads (mature silhouettes) used on shop tiles and feed sacks.
const heads = {
  chicken: (rooster) =>
    `<path d="M${rooster ? "15 13c0-6 3-9 5-6 1-4 5-4 6 0 2-3 6-1 4 4" : "18 13c0-4 2-6 4-4 1-3 5-3 5 0 2-1 4 1 2 4"}" fill="${C.terra}" ${S}/><path d="M12 30c0-11 5-18 13-18s13 7 13 17-6 15-13 15-13-4-13-14Z" fill="${rooster ? "#e9c79b" : C.cream}" ${S}/><path d="M37 27l7 3-7 3Z" fill="${C.gold}" ${S}/><path d="M33 34c2 4 1 7-2 7" fill="${C.terra}" stroke="${C.terraDark}" stroke-width="1.6"/><circle cx="30" cy="24" r="2.4" fill="${C.ink}"/>${rooster ? `<path d="M12 30c-6-4-7-12-3-16 0 6 2 9 5 11" fill="${C.terraDark}" ${S}/>` : ""}`,
  cow: (bull) =>
    `${bull ? `<path d="M10 17c-6-1-7-6-5-9 1 3 4 4 8 4m25 5c6-1 7-6 5-9-1 3-4 4-8 4" fill="${C.cream}" ${S}/>` : `<path d="M11 15c-4-4-2-7 1-7 2 0 3 3 3 6m22 1c4-4 2-7-1-7-2 0-3 3-3 6" fill="${C.cream}" ${S}/>`}<path d="M11 22c0-8 6-12 13-12s13 4 13 12v6H11Z" fill="${bull ? C.woodDark : C.white}" ${S}/><path d="M9 18c-5 0-6 4-4 6 2 1 4 0 6-1m28-5c5 0 6 4 4 6-2 1-4 0-6-1" fill="${bull ? C.woodDark : C.white}" ${S}/>${bull ? "" : `<path d="M14 14c3 1 5 4 4 7-4 0-6-3-4-7Z" fill="${C.ink}"/>`}<rect x="12" y="27" width="24" height="15" rx="7" fill="${C.blush}" ${S}/><circle cx="19" cy="34" r="2" fill="${C.terraDark}"/><circle cx="29" cy="34" r="2" fill="${C.terraDark}"/><circle cx="18" cy="22" r="2.2" fill="${bull ? C.cream : C.ink}"/><circle cx="30" cy="22" r="2.2" fill="${bull ? C.cream : C.ink}"/>`,
  horse: (stallion) =>
    `<path d="M16 12l-3-8 7 5m14 3 3-8-7 5" fill="${stallion ? C.woodDark : C.wood}" ${S}/><path d="M14 16c0-6 5-9 10-9s10 3 10 9l-1 18c0 5-4 9-9 9s-9-4-9-9Z" fill="${stallion ? C.woodDark : C.wood}" ${S}/><path d="M24 6c-5 1-7 6-6 12 3-3 4-7 6-12Zm0 0c4 2 6 6 5 12-2-3-3-7-5-12Z" fill="${stallion ? C.ink : C.woodDark}"/><rect x="16" y="31" width="16" height="12" rx="6" fill="${C.paper}" ${S}/><circle cx="20.5" cy="37" r="1.6" fill="${C.ink}"/><circle cx="27.5" cy="37" r="1.6" fill="${C.ink}"/><circle cx="19" cy="21" r="2.1" fill="${C.ink}"/><circle cx="29" cy="21" r="2.1" fill="${C.ink}"/><path d="M22 13l2 4 2-4" fill="${C.white}"/>`,
};

const sack = (inner, tint) =>
  `<path d="M12 14c-4 8-5 18-3 26 1 3 4 4 15 4s14-1 15-4c2-8 1-18-3-26Z" fill="${tint}" ${S}/><path d="M14 14c2-6 18-6 20 0-6 3-14 3-20 0Z" fill="${C.wood}" ${S}/><path d="M18 8l6 4 6-4" fill="none" stroke="${C.woodDark}" stroke-width="2.4" stroke-linecap="round"/><g transform="translate(13 20) scale(.46)">${inner}</g>`;

const packet = (inner, tint) =>
  `<path d="M10 8h28v34a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2Z" fill="${tint}" ${S}/><path d="M10 8l4 5 4-5 4 5 4-5 4 5 4-5 4 5" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/><rect x="13" y="16" width="22" height="22" rx="5" fill="${C.white}" stroke="${C.ink}" stroke-width="1.4"/><g transform="translate(14 17) scale(.42)">${inner}</g>`;

const buildingIcons = {
  coop: `<path d="M6 24 24 9l18 15" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 22h30v20H9Z" fill="${C.wood}" ${S}/><path d="M4 24 24 7l20 17-4 2L24 12 8 26Z" fill="${C.sage}" ${S}/><path d="M19 42V31a5 5 0 0 1 10 0v11Z" fill="${C.woodDark}" ${S}/><path d="M9 42h30" stroke="${C.ink}" stroke-width="2"/><path d="M14 36h1m18 0h1" stroke="${C.ink}" stroke-width="2"/><g transform="translate(30 8) scale(.32)">${heads.chicken(false)}</g>`,
  barn: `<path d="M5 22 15 9h18l10 13v21H5Z" fill="${C.terra}" ${S}/><path d="M3 23 15 8h18l12 15" fill="none" stroke="${C.cream}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 43V27h18v16Z" fill="${C.cream}" ${S}/><path d="M15 27l18 16m0-16L15 43" stroke="${C.terra}" stroke-width="2.4"/><rect x="20" y="14" width="8" height="7" fill="${C.cream}" stroke="${C.ink}" stroke-width="1.6"/>`,
  stable: `<path d="M4 21 24 9l20 12" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20h34v23H7Z" fill="${C.woodDark}" ${S}/><path d="M3 22 24 8l21 14-3 2L24 12 6 24Z" fill="${C.sageDark}" ${S}/><path d="M11 43V29h11v14m4 0V29h11v14" fill="${C.wood}" ${S}/><path d="M11 33h11m4 0h11" stroke="${C.ink}" stroke-width="1.6"/><path d="M17 23a7 7 0 1 1 14 0l-2 0a5 5 0 1 0-10 0Z" fill="${C.stone}" stroke="${C.ink}" stroke-width="1.4"/>`,
  bed: `<path d="M5 26 24 18l19 8-19 9Z" fill="${C.woodDark}" ${S}/><path d="M5 26v6l19 9 19-9v-6l-19 9Z" fill="${C.wood}" ${S}/><path d="M12 25l14 6m-7-9 14 6" stroke="#6e573d" stroke-width="2.2" stroke-linecap="round"/><path d="M16 24c-1-5 1-8 4-9 0 4-1 7-4 9Zm0 0c1-4 4-5 6-4-1 3-3 4-6 4m10 4c-1-5 1-8 4-9 0 4-1 7-4 9Zm0 0c1-4 4-5 6-4-1 3-3 4-6 4" fill="${C.sage}" stroke="${C.sageDark}" stroke-width="1.2"/>`,
};

export const ICONS = {
  ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, svg(v)])),
  hen: svg(heads.chicken(false)),
  rooster: svg(heads.chicken(true)),
  cowF: svg(heads.cow(false)),
  cowM: svg(heads.cow(true)),
  horseF: svg(heads.horse(false)),
  horseM: svg(heads.horse(true)),
  ...Object.fromEntries(Object.entries(buildingIcons).map(([k, v]) => [k, svg(v)])),
};

const CROP_TINT = { daisy: "#e8eedc", wheat: "#f0dca4", tulip: "#f2c8bd", cabbage: "#cfe0bf", sunflower: "#f5dc95", lavender: "#ddd2ee" };
const cropGlyph = (crop) => (crop === "wheat" ? parts.grain : parts[crop]);

// Icon for any inventory/shop key.
const modelIcons = new Map();
const modelCursors = new Map();

// Install model thumbnails once before the UI is constructed. Abstract glyphs
// remain vector SVG; inventory items use the same downloaded models as the farm.
export function registerItemIcons(entries) {
  for (const [key, value] of Object.entries(entries)) {
    modelIcons.set(key, value.html);
    modelCursors.set(key, value.cursor);
  }
  for (const [glyph, key] of Object.entries({hen:'animal_chicken_f',rooster:'animal_chicken_m',cowF:'animal_cow_f',cowM:'animal_cow_m',horseF:'animal_horse_f',horseM:'animal_horse_m',coop:'kit_coop',barn:'kit_barn',stable:'kit_stable',bed:'kit_bed'})) {
    if (modelIcons.has(key)) ICONS[glyph] = modelIcons.get(key);
  }
  for (const key of ['can','fish','flashlight']) if (modelIcons.has(key)) TOOL_ICONS[key] = modelIcons.get(key);
}

export function itemIcon(key) {
  if (modelIcons.has(key)) return modelIcons.get(key);
  if (NIGHT_ICONS[key]) return NIGHT_ICONS[key];
  if (key.startsWith("seed_")) {
    const crop = key.slice(5);
    return svg(packet(cropGlyph(crop), CROP_TINT[crop]));
  }
  if (key === "feed_chicken") return svg(sack(heads.chicken(false), C.paper));
  if (key === "feed_cow") return svg(sack(heads.cow(false), "#e7e1cf"));
  if (key === "feed_horse") return svg(sack(heads.horse(false), "#ecd9bd"));
  if (key.startsWith("kit_")) return ICONS[key.slice(4)];
  const animal = /^animal_(chicken|cow|horse)_(f|m)$/.exec(key);
  if (animal) return ICONS[{ chicken: ["hen", "rooster"], cow: ["cowF", "cowM"], horse: ["horseF", "horseM"] }[animal[1]][animal[2] === "f" ? 0 : 1]];
  return ICONS[key] ?? ICONS.sparkle;
}

export const TOOL_ICONS = { hand: ICONS.hand, can: ICONS.can, fish: ICONS.fishfood, flashlight: NIGHT_ICONS.flashlight };

// Small CSS cursor reflecting the selected item (desktop pointers).
export function cursorFor(key) {
  if (modelCursors.has(key)) return `url("${modelCursors.get(key)}") 5 5, pointer`;
  const raw = key in TOOL_ICONS ? TOOL_ICONS[key] : itemIcon(key);
  const s = raw.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" ');
  return `url("data:image/svg+xml,${encodeURIComponent(s)}") 8 8, pointer`;
}
