const test = require("node:test");
const assert = require("node:assert");
const {
  parseChoice,
  getCategories,
  filterByCategory,
  calculatePoints,
  scoreBreakdown,
  longestStreak,
  shuffle,
  startCountdown,
} = require("./quiz");

test("parseChoice handles numbers, letters and bad input", () => {
  assert.strictEqual(parseChoice("2", 4), 1);
  assert.strictEqual(parseChoice(" D ", 4), 3);
  assert.strictEqual(parseChoice("5", 4), -1);
  assert.strictEqual(parseChoice("", 4), -1);
  assert.strictEqual(parseChoice("hello", 4), -1);
});

test("getCategories starts with All and has no duplicates", () => {
  const data = [{ category: "A" }, { category: "B" }, { category: "A" }];
  assert.deepStrictEqual(getCategories(data), ["All", "A", "B"]);
});

test("filterByCategory filters or returns everything for All", () => {
  const data = [{ category: "A" }, { category: "B" }, { category: "A" }];
  assert.strictEqual(filterByCategory(data, "A").length, 2);
  assert.strictEqual(filterByCategory(data, "All").length, 3);
});

test("calculatePoints adds streak bonus from the 3rd correct in a row", () => {
  const r = (...flags) => flags.map((correct) => ({ correct }));
  assert.strictEqual(calculatePoints(r(true, true)), 20);
  assert.strictEqual(calculatePoints(r(true, true, true)), 35); // 10+10+(10+5)
  assert.strictEqual(calculatePoints(r(true, true, true, false, true)), 45);
  assert.strictEqual(calculatePoints([]), 0);
});

test("longestStreak finds the best run", () => {
  const r = (...flags) => flags.map((correct) => ({ correct }));
  assert.strictEqual(longestStreak(r(true, false, true, true, true, false)), 3);
  assert.strictEqual(longestStreak([]), 0);
});

test("shuffle keeps items and does not mutate", () => {
  const original = [1, 2, 3, 4];
  assert.deepStrictEqual([...shuffle(original)].sort(), original);
  assert.deepStrictEqual(original, [1, 2, 3, 4]);
});

test("scoreBreakdown separates base points from streak bonuses", () => {
  const results = [
    { correct: true },
    { correct: true },
    { correct: true },
    { correct: true },
    { correct: false },
    { correct: true },
  ];

  assert.deepStrictEqual(scoreBreakdown(results), {
    basePoints: 50,
    streakBonus: 10,
    totalPoints: 60,
  });
});

test("startCountdown expires at zero without producing negatives", () => {
  const events = [];
  const timer = startCountdown(0, (remaining) => events.push(remaining), () => events.push("expire"));

  assert.deepStrictEqual(events, [0, "expire"]);
  assert.strictEqual(timer.getRemaining(), 0);
});
