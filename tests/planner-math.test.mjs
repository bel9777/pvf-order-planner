import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const APP_PATH = new URL("../docs/app.js", import.meta.url);
const INVENTORY_PATH = new URL("../docs/inventory.json", import.meta.url);

let source = fs.readFileSync(APP_PATH, "utf8");
source = source.replace(/\ninit\(\)\.catch\([\s\S]*$/m, "\n");
source += `
globalThis.__test = {
  WEEKS_PER_MONTH, KID_APPETITE, DEFAULT_FREQ, state,
  metaFor, rotationFor, makeLine, buildPlan, linePrice, orderTotal,
  renderMonthSummary, deliveryDateFor,
  setInventory(value) { inventory = value; },
  setPlanLines(value) { planLines = value; },
};
`;

const monthSummary = { textContent: "", innerHTML: "" };
const context = vm.createContext({
  console,
  Date,
  Math,
  Number,
  location: { hostname: "bel9777.github.io" },
  document: {
    querySelector(selector) {
      if (selector === "#month-summary") return monthSummary;
      return null;
    },
    querySelectorAll() { return []; },
  },
});
vm.runInContext(source, context, { filename: APP_PATH.pathname });

const planner = context.__test;
const inventoryData = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
const inventory = Object.fromEntries(inventoryData.products.map((p) => [p.slug, p]));
planner.setInventory(inventory);

const DINNER_GROUPS = ["chicken", "pork", "turkey", "lamb"];

function setState(values = {}) {
  Object.assign(planner.state, {
    zone: "rochester",
    adults: 2,
    kids: 2,
    dinners: 3,
    breakfasts: 2,
    eggDozens: 1,
    leftovers: true,
    stock: false,
    freq: { ...planner.DEFAULT_FREQ },
  }, values);
  if (values.freq) planner.state.freq = { ...values.freq };
}

function dinnerServings(lines) {
  return lines
    .filter((line) => DINNER_GROUPS.includes(line.group))
    .reduce((sum, line) => sum + line.qty * line.servingsEach, 0);
}

function wholeDinnerMeals(lines, eaters) {
  return DINNER_GROUPS.reduce((sum, group) => {
    const servings = lines
      .filter((line) => line.group === group)
      .reduce((groupSum, line) => groupSum + line.qty * line.servingsEach, 0);
    return sum + Math.floor(servings / eaters);
  }, 0);
}

test("default plan closely covers requested meals with consistent summary counts", () => {
  setState();
  const lines = planner.buildPlan();
  const eaters = planner.state.adults + planner.state.kids * planner.KID_APPETITE;
  const requestedServings = planner.state.dinners * planner.WEEKS_PER_MONTH * eaters;

  assert.equal(dinnerServings(lines), 42);
  assert.ok(dinnerServings(lines) >= requestedServings);
  assert.equal(wholeDinnerMeals(lines, eaters), 13);
  assert.equal(lines.find((line) => line.group === "eggs")?.qty, 5);

  planner.setPlanLines(lines);
  monthSummary.innerHTML = "";
  planner.renderMonthSummary();
  assert.match(monthSummary.innerHTML, /13 dinners/);
  assert.doesNotMatch(monthSummary.innerHTML, /undefined/);
});

test("a small varied dinner request no longer forces one package from every protein", () => {
  setState({
    adults: 1,
    kids: 0,
    dinners: 1,
    breakfasts: 0,
    eggDozens: 0,
    leftovers: false,
    freq: { chicken: 3, pork: 1, turkey: 1, lamb: 0 },
  });
  const lines = planner.buildPlan();
  const target = planner.WEEKS_PER_MONTH;
  const actual = dinnerServings(lines);

  assert.deepEqual([...new Set(lines.map((line) => line.group))], ["chicken"]);
  assert.ok(actual >= target);
  assert.ok(actual / target < 1.5);
});

test("single-cut plans choose a package size that avoids needless overfill", () => {
  setState({
    adults: 1,
    kids: 2,
    dinners: 1,
    breakfasts: 0,
    eggDozens: 0,
    leftovers: true,
    freq: { chicken: 0, pork: 0, turkey: 3, lamb: 0 },
  });
  const lines = planner.buildPlan();
  const target = planner.WEEKS_PER_MONTH * (1 + 2 * planner.KID_APPETITE);
  const actual = dinnerServings(lines);

  assert.equal(lines.map((line) => line.slug).join(","), "turkey-legs");
  assert.ok(actual >= target);
  assert.ok(actual / target < 1.3);
});

test("turning leftovers off removes automatic roast and whole-bird choices", () => {
  for (const group of ["chicken", "pork", "turkey"]) {
    const withLeftovers = planner.rotationFor(group, true).map((p) => p.slug);
    const withoutLeftovers = planner.rotationFor(group, false).map((p) => p.slug);
    assert.notDeepEqual(withoutLeftovers, withLeftovers);
    assert.ok(planner.rotationFor(group, false).every((p) => !(planner.metaFor(p).leftovers || 0)));
  }
});

test("manual removals below one family meal render a useful summary", () => {
  setState({ adults: 8, kids: 8, leftovers: true });
  const tinyPlan = [planner.makeLine(inventory["chicken-leg-quarters"], 1)];
  planner.setPlanLines(tinyPlan);
  monthSummary.innerHTML = "";
  planner.renderMonthSummary();

  assert.match(monthSummary.innerHTML, /not enough for a full family meal/);
  assert.doesNotMatch(monthSummary.innerHTML, /undefined/);
});

test("egg planning always covers the 4.33-week target", () => {
  for (let weekly = 1; weekly <= 6; weekly++) {
    setState({
      adults: 1,
      kids: 0,
      dinners: 0,
      breakfasts: 0,
      eggDozens: weekly,
      freq: { chicken: 0, pork: 0, turkey: 0, lamb: 0 },
    });
    const eggs = planner.buildPlan().find((line) => line.group === "eggs");
    assert.equal(eggs?.qty, Math.ceil(weekly * planner.WEEKS_PER_MONTH));
  }
});

test("displayed line prices reconcile exactly to the displayed subtotal", () => {
  const lines = [
    planner.makeLine(inventory["jowl-bacon"], 1),
    planner.makeLine(inventory["chicken-leg-quarters"], 3),
    planner.makeLine(inventory["uncured-pork-hot-dogs"], 2),
  ];
  assert.equal(planner.linePrice(lines[0]), 11.73);
  const sum = Math.round(lines.reduce((total, line) => total + planner.linePrice(line), 0) * 100) / 100;
  assert.equal(planner.orderTotal(lines), sum);
});

test("representative allowed-input sweep never underfills and avoids severe overfill", () => {
  const households = [
    { adults: 1, kids: 0 },
    { adults: 2, kids: 2 },
    { adults: 8, kids: 8 },
  ];
  for (const household of households) {
    const eaters = household.adults + household.kids * planner.KID_APPETITE;
    for (let dinners = 1; dinners <= 7; dinners++) {
      for (let mask = 1; mask < 256; mask++) {
        const freq = {
          chicken: mask & 3,
          pork: (mask >> 2) & 3,
          turkey: (mask >> 4) & 3,
          lamb: (mask >> 6) & 3,
        };
        for (const leftovers of [false, true]) {
          setState({
            ...household,
            dinners,
            breakfasts: 0,
            eggDozens: 0,
            leftovers,
            freq,
          });
          const lines = planner.buildPlan();
          if (!lines.some((line) => DINNER_GROUPS.includes(line.group))) continue;
          const target = dinners * planner.WEEKS_PER_MONTH * eaters;
          const actual = dinnerServings(lines);
          assert.ok(actual + 1e-9 >= target, `underfill for ${JSON.stringify({ household, dinners, freq, leftovers })}`);
          assert.ok(actual / target < 1.75, `severe overfill for ${JSON.stringify({ household, dinners, freq, leftovers, target, actual })}`);
        }
      }
    }
  }
});

test("2026 delivery-date rules remain unchanged", () => {
  const julyRochester = planner.deliveryDateFor("rochester", 2026, 6);
  const augustRochester = planner.deliveryDateFor("rochester", 2026, 7);
  const augustBuffalo = planner.deliveryDateFor("buffalo", 2026, 7);
  assert.equal(julyRochester.getDate(), 11);
  assert.equal(augustRochester.getDate(), 1);
  assert.equal(augustBuffalo.getDate(), 15);
});
