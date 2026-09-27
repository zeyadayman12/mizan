// Automatic tests for Mizan's money math (engine.js).
// Run with:  npm test     (or: node --test tests/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Load engine.js into a sandbox, the same way the browser loads it as a plain script.
const ctx = vm.createContext({ console });
vm.runInContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8"), ctx);
const E = ctx;

// A fresh app state, like a new install.
function fresh(extraPots = []) {
  const s = {
    settings: {
      rounding: 5,
      gold: { every: 500, buy: 250 },
      goldPrice: null,
      nisab: { grams: 85, karat: 21 },
      sources: [],
      sourceRules: {},
      pots: [
        { id: "sadaqah", pct: 10, base: "gross", core: true },
        { id: "savings", pct: 20, base: "gross", core: true },
        { id: "me", pct: 70, base: "rest", core: true },
      ],
    },
    incomes: [], spends: [], moves: [], gold: [], wishes: [], loans: [],
    zakat: { hawlStart: null },
  };
  for (const p of extraPots) {
    s.settings.pots.push({ base: "rest", custom: true, ...p });
    s.settings.pots.find(x => x.id === "me").pct -= p.pct;
  }
  E.state = s;
  return s;
}
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const addIncome = (amount, opts = {}) => {
  const res = E.computeSplit(amount, opts.earmark || null, opts.source, opts.sadPct);
  E.state.incomes.push({ id: "i" + E.state.incomes.length, createdAt: Date.now(), date: opts.date || E.today(),
    source: opts.source || "Dad", amount, split: res.split });
  return res;
};

/* ---------------- split ---------------- */

test("default split of 1,000: 10% sadaqah, 20% savings, rest to Me", () => {
  fresh();
  const { split } = E.computeSplit(1000, null, "Dad");
  assert.deepEqual({ ...split }, { sadaqah: 100, savings: 200, me: 700 });
});

test("parts always add up exactly and are never negative", () => {
  for (const rounding of [1, 5, 10]) {
    fresh([{ id: "nour", pct: 10 }, { id: "buy", pct: 15 }, { id: "out", pct: 10 }]);
    E.state.settings.rounding = rounding;
    for (const amount of [1, 7, 45, 50, 99, 333, 1000, 1234.5, 7777, 250000]) {
      for (const earmark of [null, { pot: "nour", amount: amount / 3 }, { pot: "buy", amount: amount * 5 }]) {
        for (const sadPct of [undefined, 15, 50, 100]) {
          const { split } = E.computeSplit(amount, earmark, "Dad", sadPct);
          assert.ok(Math.abs(sum(split) - amount) < 0.001, `sum for ${amount}/${rounding}`);
          for (const v of Object.values(split)) assert.ok(v >= 0, `negative part for ${amount}`);
        }
      }
    }
  }
});

test("sadaqah rounds UP, savings rounds to nearest", () => {
  fresh();
  const { split } = E.computeSplit(312, null, "Dad"); // sadaqah 31.2 -> 35 (up) ; savings 62.4 -> 60 (nearest)
  assert.equal(split.sadaqah, 35);
  assert.equal(split.savings, 60);
  assert.equal(split.me, 312 - 35 - 60);
});

test("custom pots share what is left after sadaqah and savings", () => {
  fresh([{ id: "nour", pct: 10 }]);           // Me becomes 60
  const { split } = E.computeSplit(1000, null, "Dad");
  assert.equal(split.nour, 100);               // 700 * 10/70
  assert.equal(split.me, 600);
});

test("setting money aside goes to that pot first, the rest splits normally", () => {
  fresh([{ id: "nour", pct: 10 }]);
  const { split, ear, capped } = E.computeSplit(1000, { pot: "nour", amount: 300 }, "Dad");
  assert.equal(ear, 300);
  assert.equal(capped, false);
  assert.equal(split.nour, 300 + 55);          // 300 + floor5(400 * 10/70 = 57.1)
  assert.equal(sum(split), 1000);
});

test("setting aside more than is left is capped", () => {
  fresh([{ id: "buy", pct: 15 }]);
  const { ear, capped } = E.computeSplit(500, { pot: "buy", amount: 1000 }, "Dad");
  assert.equal(ear, 350);                      // 500 - 50 sadaqah - 100 savings
  assert.equal(capped, true);
});

test("extra sadaqah changes only that entry; savings stays at 20%", () => {
  fresh();
  const extra = E.computeSplit(1000, null, "Dad", 20).split;
  assert.equal(extra.sadaqah, 200);
  assert.equal(extra.savings, 200);
  assert.equal(extra.me, 600);
  const next = E.computeSplit(1000, null, "Dad").split;
  assert.equal(next.sadaqah, 100);
});

test("a lower sadaqah % than normal is ignored", () => {
  fresh();
  assert.equal(E.computeSplit(1000, null, "Dad", 5).split.sadaqah, 100);
});

test("a source can have its own split", () => {
  fresh();
  E.state.settings.sourceRules.Eidiya = { sadaqah: 10, savings: 40, me: 50 };
  const { split } = E.computeSplit(1000, null, "Eidiya");
  assert.deepEqual({ ...split }, { sadaqah: 100, savings: 400, me: 500 });
  assert.equal(E.computeSplit(1000, null, "Dad").split.savings, 200);
});

/* ---------------- balances ---------------- */

test("balances follow income, spending, moves, gold, loans and resets", () => {
  fresh([{ id: "nour", pct: 10 }]);
  addIncome(1000);                                                   // sad 100, sav 200, nour 100, me 600
  E.state.spends.push({ id: "s1", date: E.today(), pot: "me", amount: 50, type: "spend" });
  E.state.spends.push({ id: "s2", date: E.today(), pot: "sadaqah", amount: 100, type: "give" });
  E.state.moves.push({ id: "m1", date: E.today(), from: "nour", to: "me", amount: 100, note: "reset" });
  E.state.gold.push({ id: "g1", date: E.today(), egp: 150, grams: 0.03, karat: 21 });
  E.state.loans.push({ id: "l1", dir: "lent", person: "Omar", amount: 200, pot: "me", pays: [{ amount: 80 }] });
  E.state.loans.push({ id: "l2", dir: "borrowed", person: "Ali", amount: 100, pot: "me", pays: [] });
  const b = E.balances();
  assert.equal(b.sadaqah, 0);
  assert.equal(b.savings, 50);          // 200 - 150 gold
  assert.equal(b.nour, 0);
  assert.equal(b.me, 600 - 50 + 100 - 200 + 80 + 100);
  const lt = E.loanTotals();
  assert.equal(lt.owedToMe, 120);
  assert.equal(lt.iOwe, 100);
});

test("gold rule: every 500 saved asks for 250 of gold", () => {
  fresh();
  addIncome(1500);                       // savings 300
  assert.equal(E.goldStatus().due, 0);
  assert.equal(E.goldStatus().toNext, 200);
  addIncome(1000);                       // savings 500 total
  assert.equal(E.goldStatus().due, 250);
  E.state.gold.push({ id: "g", date: E.today(), egp: 250, grams: 0.05, karat: 21 });
  assert.equal(E.goldStatus().due, 0);
});

test("savings total = savings cash + gold value", () => {
  fresh();
  addIncome(5000);                       // savings 1000
  E.state.gold.push({ id: "g", date: E.today(), egp: 250, grams: 0.1, karat: 21 });
  assert.equal(E.savedTotal(), 750 + 250);             // no price yet: gold counted at what you paid
  E.state.settings.goldPrice = { p21: 4000, date: E.today() };
  assert.equal(E.savedTotal(), 750 + 400);             // 0.1 g x 4000
});

/* ---------------- zakat ---------------- */

test("zakat needs a gold price, then is due after a lunar year above nisab", () => {
  fresh();
  assert.equal(E.zakatStatus().needPrice, true);
  E.state.settings.goldPrice = { p21: 4000, date: E.today() };
  addIncome(2_000_000);                                  // savings 400,000 + me etc. — well above nisab 340,000
  E.state.zakat.hawlStart = E.addDays(E.today(), -100);
  let z = E.zakatStatus();
  assert.equal(z.above, true);
  assert.equal(z.due, false);
  E.state.zakat.hawlStart = E.addDays(E.today(), -354);
  z = E.zakatStatus();
  assert.equal(z.due, true);
  assert.equal(z.amount, Math.ceil(z.wealth * 0.025));
  assert.equal(z.nisab, 85 * 4000);
});

/* ---------------- undo window ---------------- */

test("money in can be undone for 10 minutes only", () => {
  assert.ok(E.undoLeft({ createdAt: Date.now() }) > 9 * 60 * 1000);
  assert.equal(E.undoLeft({ createdAt: Date.now() - 11 * 60 * 1000 }), 0);
  assert.equal(E.undoLeft({ createdAt: Date.now() + 60 * 1000 }), 0);    // clock moved back: final
  assert.equal(E.undoLeft({}), 0);                                         // old entries: final
});

/* ---------------- goals ---------------- */

test("goals: ready when the pot covers it, behind when the date is too close", () => {
  fresh([{ id: "buy", pct: 20 }]);
  addIncome(1000);                                        // buy pot: floor5(700 * 20/70) = 200
  const ready = { id: "w1", name: "Case", price: 150, pot: "buy", bought: false };
  const later = { id: "w2", name: "Keyboard", price: 1500, pot: "buy", bought: false, due: E.addDays(E.today(), 10) };
  E.state.wishes.push(ready, later);
  const b = E.balances();
  assert.equal(E.goalStatus(ready, b).kind, "ready");
  const st = E.goalStatus(later, b);
  assert.equal(st.kind, "behind");
  assert.equal(st.covered, 50);                           // 200 - 150 used by the first goal
  assert.ok(st.extra > 0);
});

/* ---------------- monthly report ---------------- */

test("monthly report: resets are not counted as spending", () => {
  fresh();
  addIncome(1000);
  const d = E.today();
  E.state.spends.push({ id: "a", date: d, pot: "me", amount: 70, type: "spend" });
  E.state.spends.push({ id: "b", date: d, pot: "me", amount: 500, type: "reset" });
  E.state.spends.push({ id: "c", date: d, pot: "sadaqah", amount: 100, type: "give" });
  const m = E.monthStats(E.monthKey(d));
  assert.equal(m.in, 1000);
  assert.equal(m.spent, 70);
  assert.equal(m.gave, 100);
  assert.equal(m.saved, 200);
});
