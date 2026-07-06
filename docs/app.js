/* Park View Farm Monthly Order Planner
   Reads docs/inventory.json (refreshed daily by GitHub Action) and turns
   "how our family eats" into a clickable order list. No backend, no cart API:
   each line links to its GrazeCart product page. */

"use strict";

const WEEKS_PER_MONTH = 4.33;
const KID_APPETITE = 0.6; // kids count as 0.6 adult servings
const STORE = "https://parkviewfamilyfarm.com";
const APP_BASE = "https://bel9777.github.io/pvf-order-planner/";
// One-click cart fill only works same-origin (GrazeCart Livewire calls need
// the customer's session + CSRF). On github.io we fall back to the link list.
const CAN_CART = /(^|\.)parkviewfamilyfarm\.com$/.test(location.hostname);

/* ------------------------------------------------------------------ *
 * Product knowledge: meal group, adult servings per package, and how
 * many extra lunch servings the leftovers give. `rotate` is rotation
 * priority (1 = farm default pick, higher = later, 0 = swap-only).
 * Products not listed here fall back to category defaults so new
 * store items never break the planner.
 * ------------------------------------------------------------------ */
const META = {
  // breakfast
  "pork-smoked-bacon":            { group: "breakfast", servings: 4,   rotate: 1 },
  "pork-breakfast-sausage-links": { group: "breakfast", servings: 3,   rotate: 1 },
  "canadian-bacon":               { group: "breakfast", servings: 5,   rotate: 2 },
  "pork-ham-steak":               { group: "breakfast", servings: 5,   rotate: 2 },
  "irish-bacon":                  { group: "breakfast", servings: 5,   rotate: 3 },
  "pork-belly-sliced":            { group: "breakfast", servings: 6,   rotate: 3 },
  "jowl-bacon":                   { group: "breakfast", servings: 3,   rotate: 3 },
  // chicken dinners
  "chicken-whole-bird":     { group: "chicken", servings: 4,   leftovers: 2, rotate: 1 },
  "chicken-leg-quarters":   { group: "chicken", servings: 2,   rotate: 1 },
  "chicken-drumsticks":     { group: "chicken", servings: 2,   rotate: 2 },
  "chicken-thighs":         { group: "chicken", servings: 3,   rotate: 2 },
  "chicken-spatchcocked":   { group: "chicken", servings: 4,   leftovers: 2, rotate: 2 },
  "chicken-breast-boneless":{ group: "chicken", servings: 3,   rotate: 3 },
  "chicken-breast-bone-in": { group: "chicken", servings: 3,   rotate: 3 },
  "chicken-wings":          { group: "chicken", servings: 1.5, rotate: 3 },
  // pork dinners
  "pork-chops":                    { group: "pork", servings: 2,   rotate: 1 },
  "pork-butt-roast":               { group: "pork", servings: 4,   leftovers: 2, rotate: 1 },
  "pork-italian-sausage-links":    { group: "pork", servings: 3,   rotate: 2 },
  "pork-ground":                   { group: "pork", servings: 3,   rotate: 2 },
  "smoked-pork-chops":             { group: "pork", servings: 2,   rotate: 3 },
  "shoulder-steaks":               { group: "pork", servings: 2,   rotate: 3 },
  "pork-spare-ribs":               { group: "pork", servings: 1.5, rotate: 3 },
  "uncured-pork-hot-dogs":         { group: "pork", servings: 3,   rotate: 3 },
  "pork-italian-sausage-links-hot":{ group: "pork", servings: 3,   rotate: 0 },
  "chorizo-sausage-links":         { group: "pork", servings: 3,   rotate: 0 },
  // turkey dinners
  "bone-in-turkey-breast": { group: "turkey", servings: 5,   leftovers: 2, rotate: 1 },
  "turkey-legs":           { group: "turkey", servings: 2,   rotate: 2 },
  "turkey-thighs":         { group: "turkey", servings: 3,   rotate: 2 },
  "turkey-ground":         { group: "turkey", servings: 3,   rotate: 2 },
  "turkey-wings":          { group: "turkey", servings: 2,   rotate: 3 },
  "spatchcock-turkey":     { group: "turkey", servings: 8,   leftovers: 6, rotate: 3 },
  "whole-turkey":          { group: "turkey", servings: 8,   leftovers: 8, rotate: 0 },
  // lamb dinners
  "lamb-leg-roast": { group: "lamb", servings: 3,   leftovers: 1, rotate: 1 },
  "lamb-ground":    { group: "lamb", servings: 3,   rotate: 1 },
  "lamb-steaks":    { group: "lamb", servings: 1.5, rotate: 2 },
  "lamb-rib-chops": { group: "lamb", servings: 1.5, rotate: 2 },
  "lamb-shanks":    { group: "lamb", servings: 2,   rotate: 2 },
  // eggs
  "chicken-eggs": { group: "eggs", servings: 6, rotate: 1 },
  // pantry / stock
  "chicken-stock-bag":        { group: "pantry", servings: 0, rotate: 1 },
  "turkey-stock-bag":         { group: "pantry", servings: 0, rotate: 2 },
  "pasture-raised-pork-bones":{ group: "pantry", servings: 0, rotate: 1 },
  "turkey-necks":             { group: "pantry", servings: 0, rotate: 2 },
  "fresh-ham-hocks":          { group: "pantry", servings: 0, rotate: 0 },
  "pork-smoked-ham-hocks":    { group: "pantry", servings: 0, rotate: 0 },
  // not part of meal planning
  "1-2-hog-pre-order-deposit": { group: "other" },
  "pork-essentials-box-15-lb-freezer-bundle":   { group: "other" },
  "pork-family-box-25-lb-freezer-bundle":       { group: "other" },
  "pork-freezer-builder-37-lb-stock-up-bundle": { group: "other" },
};

const CATEGORY_FALLBACK_GROUP = {
  chicken: "chicken", pork: "pork", turkey: "turkey", lamb: "lamb", eggs: "eggs",
};

const GROUP_LABELS = {
  breakfast: "Breakfast",
  chicken: "Dinners: Chicken",
  pork: "Dinners: Pork",
  turkey: "Dinners: Turkey",
  lamb: "Dinners: Lamb",
  eggs: "Eggs",
  pantry: "Stock & Broth Makings",
};

const PROTEINS = [
  { key: "chicken", label: "Chicken" },
  { key: "pork",    label: "Pork" },
  { key: "turkey",  label: "Turkey" },
  { key: "lamb",    label: "Lamb" },
];
const FREQ_OPTIONS = [
  { label: "Skip",    weight: 0 },
  { label: "Sometimes", weight: 1 },
  { label: "Regular",  weight: 2 },
  { label: "Often",    weight: 3 },
];
const DEFAULT_FREQ = { chicken: 2, pork: 2, turkey: 1, lamb: 0 };

/* ------------------------------------------------------------------ *
 * Delivery schedule rules (mirror the GrazeCart overrides):
 * Rochester = first Saturday (July shifts to second Saturday for the 4th),
 * Buffalo = third Saturday. Order deadline = Thursday before, 11:59 PM.
 * ------------------------------------------------------------------ */
function nthSaturday(year, month, n) {
  const first = new Date(year, month, 1);
  const offset = (6 - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + 7 * (n - 1));
}
function deliveryDateFor(zone, year, month) {
  if (zone === "rochester") return nthSaturday(year, month, month === 6 ? 2 : 1);
  return nthSaturday(year, month, 3);
}
function nextDelivery(zone, now) {
  for (let i = 0; i < 14; i++) {
    const probe = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const delivery = deliveryDateFor(zone, probe.getFullYear(), probe.getMonth());
    const deadline = new Date(delivery);
    deadline.setDate(delivery.getDate() - 2);
    deadline.setHours(23, 59, 59, 0);
    if (deadline > now) return { delivery, deadline };
  }
  return null;
}
const fmtDay = (d) =>
  d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtShort = (d) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/* ------------------------------------------------------------------ */

const state = {
  zone: "rochester",
  adults: 2,
  kids: 2,
  dinners: 3,
  breakfasts: 2,
  eggDozens: 1,
  leftovers: true,
  stock: false,
  freq: { ...DEFAULT_FREQ },
};

let inventory = null;   // slug -> product (in-stock knowledge included)
let planLines = [];     // current built plan
let planBuilt = false;  // once true, input changes rebuild the plan live

function metaFor(p) {
  const m = META[p.slug];
  if (m) return m;
  const group = CATEGORY_FALLBACK_GROUP[p.category];
  if (!group) return { group: "other" };
  // Unknown new product: rough serving estimate from weight, joins the
  // end of the rotation so it can still show up in big orders.
  const servings = Math.max(1, Math.round((p.avg_weight_lb || 1) * 2));
  return { group, servings, rotate: 4 };
}

function unitPrice(p) {
  if (p.price == null) return 0;
  return p.price_unit === "lb" ? p.price * (p.avg_weight_lb || 1) : p.price;
}

function groupProducts(group, { inStockOnly = true } = {}) {
  return Object.values(inventory)
    .filter((p) => metaFor(p).group === group)
    .filter((p) => !inStockOnly || p.in_stock)
    .sort((a, b) => (metaFor(a).rotate ?? 9) - (metaFor(b).rotate ?? 9) || unitPrice(a) - unitPrice(b));
}

function rotationFor(group, preferLeftovers) {
  let items = groupProducts(group).filter((p) => (metaFor(p).rotate ?? 0) > 0);
  if (!preferLeftovers) {
    // No lunch-leftover planning: nudge big roasts later in the rotation.
    items = items.slice().sort((a, b) => {
      const ra = (metaFor(a).rotate ?? 9) + ((metaFor(a).leftovers || 0) >= 2 ? 1 : 0);
      const rb = (metaFor(b).rotate ?? 9) + ((metaFor(b).leftovers || 0) >= 2 ? 1 : 0);
      return ra - rb;
    });
  }
  return items;
}

/* Greedy variety fill: walk the rotation adding one package at a time
   until the group's servings are covered. Variety scales with volume:
   roughly one distinct cut per 2.5 meals, so a light month gets the
   farm's default picks and a heavy month gets range. */
function fillGroup(group, servingsNeeded, eaters, preferLeftovers) {
  let rotation = rotationFor(group, preferLeftovers);
  if (!rotation.length || servingsNeeded <= 0) return [];
  const meals = servingsNeeded / Math.max(1, eaters);
  const variety = Math.min(rotation.length, Math.max(1, Math.ceil(meals / 2.5)));
  rotation = rotation.slice(0, variety);
  const units = new Map();
  let remaining = servingsNeeded;
  let idx = 0;
  let guard = 400;
  while (remaining > 0 && guard-- > 0) {
    const p = rotation[idx % rotation.length];
    units.set(p.slug, (units.get(p.slug) || 0) + 1);
    remaining -= metaFor(p).servings || 1;
    idx++;
  }
  return [...units.entries()].map(([slug, qty]) => makeLine(inventory[slug], qty));
}

function makeLine(product, qty) {
  const m = metaFor(product);
  return {
    slug: product.slug,
    qty,
    group: m.group,
    servingsEach: m.servings || 1,
    leftoversEach: m.leftovers || 0,
  };
}

function buildPlan() {
  const eaters = state.adults + state.kids * KID_APPETITE;
  const lines = [];

  // Breakfast
  const breakfastServings = state.breakfasts * WEEKS_PER_MONTH * eaters;
  lines.push(...fillGroup("breakfast", breakfastServings, eaters, state.leftovers));

  // Dinners split across chosen proteins
  const weights = PROTEINS.map((p) => ({ key: p.key, w: state.freq[p.key] || 0 }))
    .filter((x) => x.w > 0 && rotationFor(x.key, state.leftovers).length > 0);
  const totalW = weights.reduce((s, x) => s + x.w, 0);
  const dinnerServings = state.dinners * WEEKS_PER_MONTH * eaters;
  if (totalW > 0) {
    for (const { key, w } of weights) {
      lines.push(...fillGroup(key, (dinnerServings * w) / totalW, eaters, state.leftovers));
    }
  }

  // Eggs
  const dozens = Math.round(state.eggDozens * WEEKS_PER_MONTH);
  const eggs = groupProducts("eggs")[0];
  if (dozens > 0 && eggs) lines.push(makeLine(eggs, dozens));

  // Stock makings
  if (state.stock) {
    const bag = groupProducts("pantry").find((p) => /stock-bag/.test(p.slug));
    const bones = groupProducts("pantry").find((p) => /bones|necks/.test(p.slug));
    if (bag) lines.push(makeLine(bag, 2));
    if (bones) lines.push(makeLine(bones, 1));
  }

  return lines;
}

/* ------------------------- rendering ------------------------------ */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function linePrice(line) {
  return unitPrice(inventory[line.slug]) * line.qty;
}

function renderZones() {
  const now = new Date();
  for (const zone of ["rochester", "buffalo"]) {
    const next = nextDelivery(zone, now);
    $(`#zone-when-${zone}`).textContent = next
      ? `Next: ${fmtShort(next.delivery)} · order by ${fmtShort(next.deadline)}`
      : "";
  }
  $$(".zone").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.zone === state.zone));
  });
}

function renderProteins() {
  const wrap = $("#protein-rows");
  wrap.innerHTML = "";
  for (const { key, label } of PROTEINS) {
    const available = rotationFor(key, true).length > 0;
    const row = document.createElement("div");
    row.className = "protein-row" + (available ? "" : " protein-row--out");
    const chips = FREQ_OPTIONS.map(
      (o, i) =>
        `<button class="freq-chip" data-key="${key}" data-weight="${o.weight}"
           aria-pressed="${(available ? state.freq[key] : 0) === o.weight}"
           ${available ? "" : "disabled"}>${o.label}</button>`
    ).join("");
    row.innerHTML = `
      <span class="protein-row__name">${label}</span>
      <div class="freq-chips">${chips}</div>
      ${available ? "" : `<span class="protein-row__note">Sold out right now. We'll leave it off this month's plan.</span>`}`;
    wrap.appendChild(row);
  }
}

/* Rebuild the plan from current inputs. Runs on every input change once
   the first plan exists, so + / - update the list immediately. Manual
   swaps and removes reset here on purpose: inputs drive the plan. */
function refreshPlan(scroll = false) {
  planLines = buildPlan();
  renderResults(scroll);
}

function renderResults(scroll = false) {
  const results = $("#results");
  results.hidden = false;

  // Delivery header
  const next = nextDelivery(state.zone, new Date());
  const zoneName = state.zone === "rochester" ? "Rochester" : "Buffalo";
  $("#results-delivery-head").textContent =
    `${zoneName} delivery: ${fmtDay(next.delivery)}`;
  $("#results-delivery-sub").textContent =
    `Order by ${fmtDay(next.deadline)}, 11:59 PM. We pack your order Friday and it rides out Saturday morning.`;
  $("#howto-deadline").textContent =
    `Finish checkout by ${fmtDay(next.deadline)} to make the ${fmtShort(next.delivery)} route.`;

  // Sections
  const bySection = new Map();
  for (const line of planLines) {
    if (!bySection.has(line.group)) bySection.set(line.group, []);
    bySection.get(line.group).push(line);
  }
  const order = ["breakfast", "chicken", "pork", "turkey", "lamb", "eggs", "pantry"];
  const wrap = $("#order-sections");
  wrap.innerHTML = "";
  const eaters = state.adults + state.kids * KID_APPETITE;

  for (const group of order) {
    const lines = bySection.get(group);
    if (!lines || !lines.length) continue;
    const section = document.createElement("div");
    section.className = "order-section";

    let covers = "";
    if (group === "eggs") {
      covers = `${lines[0].qty} dozen for the month`;
    } else if (group === "pantry") {
      covers = "For soup, stock, and slow days";
    } else {
      const servings = lines.reduce((s, l) => s + l.qty * l.servingsEach, 0);
      const meals = Math.floor(servings / eaters);
      const kind = (group === "breakfast" ? "breakfast" : "dinner") + (meals === 1 ? "" : "s");
      covers = `Covers about ${meals} family ${kind}`;
      if (state.leftovers) {
        const lunches = Math.floor(
          lines.reduce((s, l) => s + l.qty * l.leftoversEach, 0) / Math.max(1, eaters)
        );
        if (lunches > 0) covers += `, plus roughly ${lunches} ${lunches === 1 ? "lunch" : "lunches"} of leftovers`;
      }
    }

    section.innerHTML = `<h3>${GROUP_LABELS[group]}</h3><p class="covers">${covers}</p>`;
    for (const line of lines) section.appendChild(renderLine(line));
    wrap.appendChild(section);
  }

  if (!planLines.length) {
    wrap.innerHTML = `<div class="card"><p>Nothing on the list yet. Set a few
      meals or eggs above and it fills in on its own.</p></div>`;
  }

  renderTotal();
  if (scroll) results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderLine(line) {
  const p = inventory[line.slug];
  const el = document.createElement("div");
  el.className = "order-item";
  el.dataset.slug = line.slug;
  const weightTxt = p.avg_weight_lb
    ? `~${(p.avg_weight_lb * line.qty).toFixed(1)} lb total · `
    : "";
  const priceTxt = p.price != null
    ? p.price_unit === "lb" ? `$${p.price.toFixed(2)}/lb` : `$${p.price.toFixed(2)} each`
    : "";
  el.innerHTML = `
    <span class="order-item__qty">${line.qty}&times;</span>
    <div class="order-item__body">
      <div class="order-item__name"><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a></div>
      <div class="order-item__meta">${weightTxt}${priceTxt}</div>
    </div>
    <span class="order-item__price">$${linePrice(line).toFixed(2)}</span>
    <div class="order-item__actions">
      <button class="swap-btn" data-slug="${line.slug}">swap</button>
      <button class="remove-btn" data-slug="${line.slug}">remove</button>
    </div>`;
  return el;
}

function renderTotal() {
  const total = planLines.reduce((s, l) => s + linePrice(l), 0);
  $("#order-total").textContent = `$${total.toFixed(2)}`;
  renderMonthSummary();
  const fill = $("#meter-fill");
  fill.style.width = Math.min(100, (total / 250) * 100) + "%";
  fill.classList.toggle("meter__fill--under", total < 100);
  const status = $("#delivery-status");
  if (total >= 200) {
    status.textContent = "You're over $200. Delivery is free.";
    status.className = "delivery-status delivery-status--ok";
  } else if (total >= 100) {
    status.textContent =
      `You've cleared the $100 minimum. Add $${(200 - total).toFixed(2)} more and delivery is free.`;
    status.className = "delivery-status delivery-status--warn";
  } else {
    status.textContent =
      `Orders need to reach $100. You're $${(100 - total).toFixed(2)} short.`;
    status.className = "delivery-status delivery-status--warn";
  }
}

/* "One delivery covers about N dinners, M breakfasts, and L lunches for
   your family this month" + honest per-plate math on the meat. */
function renderMonthSummary() {
  const el = $("#month-summary");
  const eaters = Math.max(1, state.adults + state.kids * KID_APPETITE);
  const DINNER_GROUPS = ["chicken", "pork", "turkey", "lamb"];
  let dinnerServ = 0, breakfastServ = 0, leftoverServ = 0, meatCost = 0;
  for (const line of planLines) {
    if (DINNER_GROUPS.includes(line.group)) {
      dinnerServ += line.qty * line.servingsEach;
      leftoverServ += line.qty * line.leftoversEach;
      meatCost += linePrice(line);
    } else if (line.group === "breakfast") {
      breakfastServ += line.qty * line.servingsEach;
      meatCost += linePrice(line);
    }
  }
  if (!state.leftovers) leftoverServ = 0;
  const plates = dinnerServ + breakfastServ + leftoverServ;
  if (plates <= 0) { el.textContent = ""; return; }

  const parts = [];
  const dinners = Math.floor(dinnerServ / eaters);
  const breakfasts = Math.floor(breakfastServ / eaters);
  const lunches = Math.floor(leftoverServ / eaters);
  if (dinners) parts.push(`${dinners} dinner${dinners === 1 ? "" : "s"}`);
  if (breakfasts) parts.push(`${breakfasts} breakfast${breakfasts === 1 ? "" : "s"}`);
  if (lunches) parts.push(`${lunches} lunch${lunches === 1 ? "" : "es"} of leftovers`);
  const list = parts.length > 1
    ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
    : parts[0];
  const plate = meatCost / plates;
  el.innerHTML = `One delivery covers about ${list} for your family this month.
    The meat works out to about <strong>$${plate.toFixed(2)} a plate</strong>.`;
}

function openSwapMenu(afterEl, line) {
  closeSwapMenus();
  const alternates = groupProducts(line.group).filter((p) => p.slug !== line.slug);
  if (!alternates.length) return;
  const menu = document.createElement("div");
  menu.className = "swap-menu";
  for (const alt of alternates) {
    const m = metaFor(alt);
    const covered = line.qty * line.servingsEach;
    const qty = Math.max(1, Math.ceil(covered / (m.servings || 1)));
    const btn = document.createElement("button");
    btn.innerHTML = `${qty}&times; ${alt.name} <span class="swap-price">$${(unitPrice(alt) * qty).toFixed(2)}</span>`;
    btn.addEventListener("click", () => {
      Object.assign(line, makeLine(alt, qty));
      renderResults();
      persist();
    });
    menu.appendChild(btn);
  }
  afterEl.insertAdjacentElement("afterend", menu);
}
function closeSwapMenus() {
  $$(".swap-menu").forEach((m) => m.remove());
}

/* --------------------- one-click cart fill ------------------------ *
 * Same-origin only. For each plan line: fetch the product page, lift the
 * add-to-cart Livewire component's wire:snapshot, then POST /livewire/update
 * with qty stacked addToCart calls. This mirrors exactly what the store's
 * own Add to Cart button does, using the customer's session.
 * ------------------------------------------------------------------ */

function csrfToken() {
  return document.querySelector("#csrfToken")?.content
      || document.querySelector('meta[name="csrf-token"]')?.content || null;
}

function signedIn() {
  // GrazeCart shows a Sign In link in the auxiliary menu only when logged out.
  return !document.querySelector('.auxiliaryMenu a[href*="/login"]');
}

async function fetchAddSnapshot(slug) {
  const resp = await fetch(`/store/product/${slug}`);
  if (!resp.ok) throw new Error(`product page ${resp.status}`);
  const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
  const el = [...doc.querySelectorAll("[wire\\:snapshot]")].find((e) =>
    e.getAttribute("wire:snapshot").includes("theme.add-product-button"));
  if (!el) throw new Error("no add-to-cart component");
  return el.getAttribute("wire:snapshot");
}

async function addLineToCart(line, token) {
  const snapshot = await fetchAddSnapshot(line.slug);
  const productId = JSON.parse(snapshot).data.product[1].key;
  const calls = Array.from({ length: line.qty }, () => ({
    path: "", method: "addToCart", params: [productId],
  }));
  const resp = await fetch("/livewire/update", {
    method: "POST",
    headers: { "Content-type": "application/json", "X-Livewire": "" },
    body: JSON.stringify({ _token: token, components: [{ snapshot, updates: {}, calls }] }),
  });
  if (!resp.ok) throw new Error(`livewire ${resp.status}`);
  const data = await resp.json();
  if (!data?.components) throw new Error("unexpected response");
}

async function addAllToCart() {
  const btn = $("#add-all-btn");
  const status = $("#add-all-status");
  if (btn.dataset.done) { location.href = "/cart"; return; }
  status.hidden = true;

  const token = csrfToken();
  if (!token || !signedIn()) {
    status.hidden = false;
    status.innerHTML = `You'll need to <a href="/login">sign in</a> first.
      Your answers are saved on this device, so your plan will be waiting when you're back.`;
    return;
  }

  btn.disabled = true;
  const lines = planLines.filter((l) => inventory[l.slug]?.in_stock);
  const failed = [];
  let done = 0;
  for (const line of lines) {
    btn.textContent = `Adding to your cart: ${++done} of ${lines.length}`;
    try {
      await addLineToCart(line, token);
    } catch (e) {
      failed.push(inventory[line.slug].name);
    }
  }

  if (failed.length === lines.length) {
    btn.disabled = false;
    btn.textContent = "Add everything to my cart";
    status.hidden = false;
    status.textContent = "That didn't work. Use the item links above instead, or refresh and try again.";
  } else if (failed.length) {
    btn.disabled = false;
    btn.textContent = "Open my cart";
    btn.dataset.done = "1";
    status.hidden = false;
    status.textContent = `Everything's in your cart except: ${failed.join(", ")}. Tap those in the list above to add them.`;
  } else {
    btn.textContent = "Done! Taking you to your cart";
    setTimeout(() => { location.href = "/cart"; }, 600);
  }
}

/* ------------------------- wiring --------------------------------- */

function persist() {
  try {
    localStorage.setItem("pvf-planner-v1", JSON.stringify(state));
  } catch (e) { /* private mode etc. */ }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem("pvf-planner-v1"));
    if (saved && typeof saved === "object") {
      Object.assign(state, saved, { freq: { ...DEFAULT_FREQ, ...(saved.freq || {}) } });
    }
  } catch (e) { /* ignore */ }
}

function syncControls() {
  $$(".stepper").forEach((st) => {
    $(".stepper__value", st).textContent = state[st.dataset.input];
  });
  $("#opt-leftovers").checked = state.leftovers;
  $("#opt-stock").checked = state.stock;
  renderZones();
  renderProteins();
}

function wire() {
  $$(".stepper").forEach((st) => {
    const key = st.dataset.input;
    const min = Number(st.dataset.min), max = Number(st.dataset.max);
    $$(".stepper__btn", st).forEach((btn) =>
      btn.addEventListener("click", () => {
        state[key] = Math.min(max, Math.max(min, state[key] + Number(btn.dataset.dir)));
        $(".stepper__value", st).textContent = state[key];
        persist();
        if (planBuilt) refreshPlan();
      })
    );
  });

  $$(".zone").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.zone = btn.dataset.zone;
      renderZones();
      persist();
      if (planBuilt) refreshPlan();
    })
  );

  $("#opt-leftovers").addEventListener("change", (e) => {
    state.leftovers = e.target.checked; persist();
    if (planBuilt) refreshPlan();
  });
  $("#opt-stock").addEventListener("change", (e) => {
    state.stock = e.target.checked; persist();
    if (planBuilt) refreshPlan();
  });

  $("#protein-rows").addEventListener("click", (e) => {
    const chip = e.target.closest(".freq-chip");
    if (!chip) return;
    state.freq[chip.dataset.key] = Number(chip.dataset.weight);
    renderProteins();
    persist();
    if (planBuilt) refreshPlan();
  });

  $("#build-btn").addEventListener("click", () => {
    planLines = buildPlan();
    if (!planLines.length) {
      alert("Set at least one meal per week (or some eggs) and we'll build your order.");
      return;
    }
    planBuilt = true;
    $("#build-btn").textContent = "Rebuild my order";
    renderResults(true);
  });

  if (CAN_CART) {
    $("#add-all-btn").hidden = false;
    $("#howto-store-link").hidden = true;
    $("#add-all-btn").addEventListener("click", addAllToCart);
  }

  $("#order-sections").addEventListener("click", (e) => {
    const swap = e.target.closest(".swap-btn");
    const remove = e.target.closest(".remove-btn");
    if (swap) {
      const line = planLines.find((l) => l.slug === swap.dataset.slug);
      if (line) openSwapMenu(swap.closest(".order-item"), line);
    } else if (remove) {
      planLines = planLines.filter((l) => l.slug !== remove.dataset.slug);
      renderResults();
    } else if (!e.target.closest(".swap-menu")) {
      closeSwapMenus();
    }
  });
}

async function init() {
  restore();
  const resp = await fetch(APP_BASE + "inventory.json", { cache: "no-cache" });
  const data = await resp.json();
  inventory = {};
  for (const p of data.products) inventory[p.slug] = p;
  const dateEl = $("#inventory-date");
  if (dateEl) {
    dateEl.textContent = new Date(data.scraped_at).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  }
  syncControls();
  wire();
}

init().catch((err) => {
  console.error(err);
  document.querySelector("#planner").insertAdjacentHTML(
    "afterbegin",
    `<div class="card"><p>We couldn't load today's inventory. Refresh the page,
     or head straight to <a href="${STORE}/store">the store</a>.</p></div>`
  );
});
