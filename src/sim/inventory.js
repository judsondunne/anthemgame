// Canonical inventory slots. The aggregate `inv` remains an adapter for older
// actions and saved games; every mutation reconciles that adapter first.
import { BALANCE as B } from '../config/balance.js';
import { itemKind } from './catalog.js';

export const TOOLS = ['hand', 'can', 'fish', 'flashlight'];
export const HOTBAR_SIZE = B.inventory.hotbarSlots;
export const SLOT_COUNT = HOTBAR_SIZE + B.inventory.backpackSlots;
export const stackLimit = key => TOOLS.includes(key) ? 1 : B.inventory.stackMax;
const valid = key => TOOLS.includes(key) || !!itemKind(key) && itemKind(key) !== 'animal';
const fail = reason => ({ ok: false, reason });
const aggregate = slots => {
  const out = {};
  for (const q of slots) if (q && !TOOLS.includes(q.key)) out[q.key] = (out[q.key] || 0) + q.n;
  return out;
};
function publish(s) { s.inv = aggregate(s.slots); return s; }
function order(key) {
  const hot = TOOLS.includes(key) || key.startsWith('seed_') || key.startsWith('feed_') || ['fence', 'gate'].includes(key);
  return Array.from({ length: SLOT_COUNT }, (_, i) => hot ? i : (i + HOTBAR_SIZE) % SLOT_COUNT);
}
function insert(s, key, n) {
  let left = n;
  const ids = order(key), limit = stackLimit(key);
  for (const i of ids) {
    const q = s.slots[i];
    if (q?.key !== key || q.n >= limit) continue;
    const add = Math.min(limit - q.n, left);
    q.n += add; left -= add;
    if (!left) return 0;
  }
  for (const i of ids) {
    if (s.slots[i]) continue;
    const add = Math.min(limit, left);
    s.slots[i] = { key, n: add }; left -= add;
    if (!left) return 0;
  }
  return left;
}

export function initializeInventory(s, slots = null) {
  s.slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const q = slots?.[i];
    return q && valid(q.key) && Number.isInteger(q.n) && q.n > 0 ? { key: q.key, n: Math.min(q.n, stackLimit(q.key)) } : null;
  });
  const supplied = !!slots;
  if (!supplied) {
    TOOLS.forEach((key, i) => { s.slots[i] = { key, n: 1 }; });
    for (const [key, n] of Object.entries(s.inv || {})) if (valid(key) && !TOOLS.includes(key) && n > 0) {
      const left = insert(s, key, Math.floor(n));
      if (left) { s.inventoryOverflow ??= []; s.inventoryOverflow.push({ key, n: left }); }
    }
  }
  // Corrupt/older layouts cannot remove a permanent tool. Prefer the hotbar.
  const seen = new Set();
  for (let i = 0; i < s.slots.length; i++) {
    const q = s.slots[i];
    if (!q || !TOOLS.includes(q.key)) continue;
    if (seen.has(q.key)) s.slots[i] = null; else { seen.add(q.key); q.n = 1; }
  }
  for (const key of TOOLS) if (!seen.has(key)) {
    const empty = s.slots.findIndex(q => !q);
    if (empty >= 0) s.slots[empty] = { key, n: 1 };
    else {
      // Reserve permanent tools even in a malformed completely full layout;
      // displaced items remain in overflow, then are restored as space opens.
      s.inventoryOverflow ??= [];
      const replace = s.slots.findLastIndex(q => q && !TOOLS.includes(q.key));
      s.inventoryOverflow.push(s.slots[replace]);
      s.slots[replace] = { key, n: 1 };
    }
  }
  s.selectedSlot = Number.isInteger(s.selectedSlot) ? Math.max(0, Math.min(HOTBAR_SIZE - 1, s.selectedSlot)) : 0;
  return publish(s);
}

export function syncInventory(s) {
  if (!Array.isArray(s.slots) || s.slots.length !== SLOT_COUNT) return initializeInventory(s);
  const current = aggregate(s.slots), desired = s.inv || {};
  for (const key of new Set([...Object.keys(current), ...Object.keys(desired)])) {
    if (!valid(key) || TOOLS.includes(key)) continue;
    const want = Math.max(0, Math.floor(Number(desired[key]) || 0));
    let delta = want - (current[key] || 0);
    if (delta > 0) {
      const left = insert(s, key, delta);
      if (left) { s.inventoryOverflow ??= []; s.inventoryOverflow.push({ key, n: left }); }
    } else for (let i = s.slots.length - 1; i >= 0 && delta < 0; i--) {
      const q = s.slots[i];
      if (q?.key !== key) continue;
      const n = Math.min(q.n, -delta); q.n -= n; delta += n;
      if (!q.n) s.slots[i] = null;
    }
  }
  if (s.inventoryOverflow?.length) {
    s.inventoryOverflow = s.inventoryOverflow.flatMap(q => {
      const left = insert(s, q.key, q.n);
      return left ? [{ key: q.key, n: left }] : [];
    });
  }
  return publish(s);
}

export function inventoryCapacity(s, key) {
  syncInventory(s);
  if (!valid(key)) return 0;
  return s.slots.reduce((n, q) => n + (!q ? stackLimit(key) : q.key === key ? stackLimit(key) - q.n : 0), 0);
}
export function addInventory(s, key, n = 1) {
  if (!valid(key) || !Number.isInteger(n) || n < 1) return fail('unknown');
  syncInventory(s);
  if (TOOLS.includes(key)) return s.slots.some(q => q?.key === key) ? fail('permanent') : fail('unknown');
  if (inventoryCapacity(s, key) < n) return fail('stack');
  insert(s, key, n); publish(s);
  return { ok: true, added: n };
}
export function removeInventory(s, key, n = 1) {
  syncInventory(s);
  if (TOOLS.includes(key)) return fail('permanent');
  if (!Number.isInteger(n) || n < 1 || (s.inv[key] || 0) < n) return fail('none');
  s.inv[key] -= n;
  syncInventory(s);
  return { ok: true, removed: n };
}
export function selectedItem(s) { syncInventory(s); return s.slots[s.selectedSlot] || null; }
export function selectSlot(s, index) {
  if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) return fail('slot');
  syncInventory(s); s.selectedSlot = index;
  s.ui.tool = s.slots[index]?.key || 'empty';
  return { ok: true, item: s.slots[index] };
}

export function moveSlot(s, from, to, { split = false, quick = false } = {}) {
  syncInventory(s);
  if (!Number.isInteger(from) || from < 0 || from >= SLOT_COUNT || !s.slots[from]) return fail('slot');
  const source = s.slots[from];
  if (quick) {
    const lo = from < HOTBAR_SIZE ? HOTBAR_SIZE : 0, hi = from < HOTBAR_SIZE ? SLOT_COUNT : HOTBAR_SIZE;
    const ids = Array.from({ length: hi - lo }, (_, i) => lo + i);
    to = ids.find(i => s.slots[i]?.key === source.key && s.slots[i].n < stackLimit(source.key)) ?? ids.find(i => !s.slots[i]);
  }
  // A drop outside the panel always cancels. Tools are movable, never discardable.
  if (!Number.isInteger(to) || to < 0 || to >= SLOT_COUNT) return fail('slot');
  if (from === to) return { ok: true, moved: 0 };
  const target = s.slots[to], take = split ? Math.ceil(source.n / 2) : source.n;
  let moved = take;
  if (!target) {
    s.slots[to] = { key: source.key, n: take }; source.n -= take;
    if (!source.n) s.slots[from] = null;
  } else if (target.key === source.key) {
    moved = Math.min(take, stackLimit(source.key) - target.n);
    if (!moved) return fail('stack');
    target.n += moved; source.n -= moved;
    if (!source.n) s.slots[from] = null;
  } else {
    if (split) return fail('occupied');
    s.slots[from] = target; s.slots[to] = source;
  }
  publish(s);
  if (s.selectedSlot === from || s.selectedSlot === to) s.ui.tool = s.slots[s.selectedSlot]?.key || 'empty';
  return { ok: true, moved };
}
export const splitSlot = (s, from, to) => moveSlot(s, from, to, { split: true });
