#!/usr/bin/env node
/**
 * Speed Round Quiz - a CLI trivia game played against ONE game-wide clock.
 *
 * Pick a category, then answer as many questions as you can before the
 * countdown reaches zero. Streaks of correct answers earn bonus points.
 *
 * Run with:  node quiz.js
 * Requires:  Node.js 18 or newer.
 */

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

// ---------------------------------------------------------------------------
// Configuration & data
// ---------------------------------------------------------------------------

/** Total seconds for the whole game. */
const GAME_TIME_LIMIT = 40;

/** Remaining-seconds values at which a warning is printed. */
const WARNING_POINTS = [20, 10, 5];

const POINTS_PER_CORRECT = 10;
const STREAK_BONUS = 5; // awarded for every correct answer once streak >= 3
const STREAK_THRESHOLD = 3;

/** Every question has a category; `answer` is the 0-based index of the right option. */
const questions = [
  // --- JavaScript ---
  {
    category: "JavaScript",
    question: "Which array method adds an item to the END of an array?",
    options: ["push", "pop", "shift", "unshift"],
    answer: 0,
  },
  {
    category: "JavaScript",
    question: "What does NaN stand for?",
    options: ["Not a Number", "No arithmetic Notation", "Null and Nothing", "New array Number"],
    answer: 0,
  },
  {
    category: "JavaScript",
    question: "Which method converts a JSON string into a JavaScript object?",
    options: ["JSON.stringify", "JSON.parse", "JSON.object", "JSON.convert"],
    answer: 1,
  },
  {
    category: "JavaScript",
    question: "What is the result of 2 + '2' in JavaScript?",
    options: ["4", "NaN", "'22'", "Error"],
    answer: 2,
  },
  // --- Web Basics ---
  {
    category: "Web Basics",
    question: "Which HTML tag creates a hyperlink?",
    options: ["<link>", "<a>", "<href>", "<url>"],
    answer: 1,
  },
  {
    category: "Web Basics",
    question: "Which CSS property changes the colour of text?",
    options: ["color", "font-color", "text-style", "foreground"],
    answer: 0,
  },
  {
    category: "Web Basics",
    question: "What does CSS stand for?",
    options: ["Computer Style Sheets", "Creative Style System", "Cascading Style Sheets", "Colorful Style Sheets"],
    answer: 2,
  },
  {
    category: "Web Basics",
    question: "Which HTML tag defines the largest heading?",
    options: ["<head>", "<h6>", "<title>", "<h1>"],
    answer: 3,
  },
  // --- General Knowledge ---
  {
    category: "General Knowledge",
    question: "What is the capital city of Kenya?",
    options: ["Mombasa", "Nairobi", "Kisumu", "Nakuru"],
    answer: 1,
  },
  {
    category: "General Knowledge",
    question: "Which is the largest planet in our solar system?",
    options: ["Jupiter", "Saturn", "Earth", "Neptune"],
    answer: 0,
  },
  {
    category: "General Knowledge",
    question: "How many days are there in a leap year?",
    options: ["365", "364", "366", "367"],
    answer: 2,
  },
  {
    category: "General Knowledge",
    question: "What is the chemical formula for water?",
    options: ["CO2", "H2O", "O2", "NaCl"],
    answer: 1,
  },
];

// ---------------------------------------------------------------------------
// Pure helper functions (easy to unit test)
// ---------------------------------------------------------------------------

/**
 * Convert raw input into an option index. Accepts "1"-"N" or "a"-letter.
 * @param {string} input - Text typed by the player.
 * @param {number} optionCount - Number of options available.
 * @returns {number} Zero-based index, or -1 when invalid.
 */
function parseChoice(input, optionCount) {
  const text = String(input).trim().toLowerCase();

  if (/^\d+$/.test(text)) {
    const number = Number.parseInt(text, 10);
    return number >= 1 && number <= optionCount ? number - 1 : -1;
  }
  if (/^[a-z]$/.test(text)) {
    const index = text.charCodeAt(0) - "a".charCodeAt(0);
    return index < optionCount ? index : -1;
  }
  return -1;
}

/**
 * Build the category menu: "All" followed by each unique category.
 * Uses map() to extract categories and a Set to remove duplicates.
 * @param {{category: string}[]} allQuestions
 * @returns {string[]} Category names.
 */
function getCategories(allQuestions) {
  return ["All", ...new Set(allQuestions.map((q) => q.category))];
}

/**
 * Keep only the questions for the chosen category.
 * @param {{category: string}[]} allQuestions
 * @param {string} category - A category name or "All".
 * @returns {Array} The matching questions.
 */
function filterByCategory(allQuestions, category) {
  return category === "All" ? [...allQuestions] : allQuestions.filter((q) => q.category === category);
}

/**
 * Work out how many points came from base answers vs streak bonuses.
 * @param {{correct: boolean}[]} results - Answered questions, in order.
 * @returns {{basePoints: number, streakBonus: number, totalPoints: number}}
 */
function scoreBreakdown(results) {
  let streak = 0;
  let basePoints = 0;
  let streakBonus = 0;

  for (const result of results) {
    if (!result.correct) {
      streak = 0;
      continue;
    }

    streak += 1;
    basePoints += POINTS_PER_CORRECT;
    if (streak >= STREAK_THRESHOLD) streakBonus += STREAK_BONUS;
  }

  return { basePoints, streakBonus, totalPoints: basePoints + streakBonus };
}

/**
 * Work out total points. Each correct answer is worth POINTS_PER_CORRECT;
 * from the 3rd correct answer in a row, each earns a STREAK_BONUS as well.
 * @param {{correct: boolean}[]} results - Answered questions, in order.
 * @returns {number} Total points.
 */
function calculatePoints(results) {
  return scoreBreakdown(results).totalPoints;
}

/**
 * Find the longest run of consecutive correct answers.
 * @param {{correct: boolean}[]} results
 * @returns {number} Best streak.
 */
function longestStreak(results) {
  let best = 0;
  let current = 0;
  for (const result of results) {
    current = result.correct ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/**
 * Return a shuffled copy of an array (Fisher-Yates).
 * @param {Array} items
 * @returns {Array} New shuffled array.
 */
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Lettered option lines, e.g. "  A) push".
 * @param {string[]} options
 * @returns {string}
 */
function formatOptions(options) {
  return options.map((option, i) => `  ${String.fromCharCode(65 + i)}) ${option}`).join("\n");
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

/**
 * Start a countdown using setInterval.
 * @param {number} seconds - Starting value.
 * @param {(remaining: number) => void} onTick - Called every second.
 * @param {() => void} onExpire - Called once when the clock hits zero.
 * @returns {{stop: () => void, getRemaining: () => number}} Timer controls.
 */
function startCountdown(seconds, onTick, onExpire) {
  let remaining = Math.max(0, Math.trunc(seconds));
  let expired = false;
  let intervalId = null;

  const finish = () => {
    if (expired) return;
    expired = true;
    if (intervalId !== null) clearInterval(intervalId);
    onExpire();
  };

  if (remaining <= 0) {
    onTick(0);
    finish();
    return {
      stop: () => {},
      getRemaining: () => 0,
    };
  }

  intervalId = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    onTick(remaining);
    if (remaining <= 0) finish();
  }, 1000);

  return {
    stop: () => {
      if (intervalId !== null) clearInterval(intervalId);
      intervalId = null;
    },
    getRemaining: () => remaining,
  };
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

/**
 * Ask one question. Keeps prompting until the answer is valid.
 * Rejects with an AbortError if the game clock runs out (via `signal`).
 * @param {readline.Interface} rl
 * @param {object} q - The question object.
 * @param {number} number - 1-based question number.
 * @param {number} total - Number of questions in this round.
 * @param {{getRemaining: () => number}} timer - The game clock.
 * @param {AbortSignal} signal - Aborted when time is up.
 * @returns {Promise<{question: string, choice: number, correct: boolean}>}
 */
async function askQuestion(rl, q, number, total, timer, signal) {
  console.log(`\nQuestion ${number} of ${total}`);
  console.log(q.question);
  console.log(formatOptions(q.options));

  while (true) {
    const raw = await rl.question(`[${timer.getRemaining()}s left] Your answer: `, { signal });
    const choice = parseChoice(raw, q.options.length);

    if (choice === -1) {
      console.log(`  Please enter a number 1-${q.options.length} or a letter A-${String.fromCharCode(64 + q.options.length)}.`);
      continue;
    }

    const correct = choice === q.answer;
    console.log(correct ? "  Correct!" : `  Incorrect. The answer was ${String.fromCharCode(65 + q.answer)}) ${q.options[q.answer]}.`);
    return { question: q.question, choice, correct };
  }
}

/**
 * Play one timed round.
 * @param {readline.Interface} rl
 * @param {Array} pool - Questions available for this round.
 * @returns {Promise<{results: Array, queueSize: number, timeExpired: boolean, elapsedMs: number}>}
 */
async function playRound(rl, pool) {
  const queue = shuffle(pool);
  const results = [];
  const controller = new AbortController();
  const startTime = Date.now();
  let timeExpired = false;

  const timer = startCountdown(
    GAME_TIME_LIMIT,
    (remaining) => {
      if (WARNING_POINTS.includes(remaining)) console.log(`\n ${remaining} seconds left!`);
    },
    () => controller.abort()
  );

  try {
    for (const [index, q] of queue.entries()) {
      results.push(await askQuestion(rl, q, index + 1, queue.length, timer, controller.signal));
    }
  } catch (error) {
    if (error.name !== "AbortError") throw error;
    timeExpired = true;
    console.log("\n\n  TIME'S UP!");
  } finally {
    timer.stop();
  }

  return { results, queueSize: queue.length, timeExpired, elapsedMs: Date.now() - startTime };
}

/**
 * Print the end-of-game summary.
 * @param {string} category
 * @param {{results: Array, queueSize: number, timeExpired: boolean, elapsedMs: number}} round
 */
function showSummary(category, round) {
  const { results, queueSize, timeExpired, elapsedMs } = round;
  const correctCount = results.filter((r) => r.correct).length;
  const wrongCount = results.length - correctCount;
  const accuracy = results.length === 0 ? 0 : (correctCount / results.length) * 100;
  const breakdown = scoreBreakdown(results);

  console.log("\n==============================");
  console.log("          GAME OVER");
  console.log("==============================");
  console.log(`Category:       ${category}`);
  console.log(`Ended because:  ${timeExpired ? "the clock ran out" : "you answered every question"}`);
  console.log(`Answered:       ${results.length} of ${queueSize}`);
  console.log(`Correct:        ${correctCount}`);
  console.log(`Incorrect:      ${wrongCount}`);
  console.log(`Accuracy:       ${accuracy.toFixed(0)}%`);
  console.log(`Longest streak: ${longestStreak(results)}`);
  console.log(`Time used:      ${Math.min(elapsedMs / 1000, GAME_TIME_LIMIT).toFixed(1)}s`);
  console.log("------------------------------");
  console.log(`Base points:    ${breakdown.basePoints}`);
  console.log(`Streak bonus:   ${breakdown.streakBonus}`);
  console.log(`TOTAL POINTS:   ${breakdown.totalPoints}`);
}

/**
 * Let the player choose a category from a numbered menu.
 * @param {readline.Interface} rl
 * @returns {Promise<string>} The chosen category name.
 */
async function chooseCategory(rl) {
  const categories = getCategories(questions);
  console.log("\nChoose a category:");
  categories.forEach((name, i) => {
    const count = filterByCategory(questions, name).length;
    console.log(`  ${i + 1}) ${name} (${count} questions)`);
  });

  while (true) {
    const raw = await rl.question("Category number: ");
    const index = parseChoice(raw, categories.length);
    if (index !== -1) return categories[index];
    console.log(`  Please enter a number from 1 to ${categories.length}.`);
  }
}

/**
 * Read a yes/no response and keep prompting until the player enters a valid value.
 * @param {readline.Interface} rl
 * @param {string} prompt
 * @returns {Promise<boolean>}
 */
async function readYesNo(rl, prompt) {
  while (true) {
    const answer = await rl.question(prompt);
    const normalized = answer.trim().toLowerCase();

    if (normalized === "y" || normalized === "yes") return true;
    if (normalized === "n" || normalized === "no") return false;

    console.log("  Please enter y or n.");
  }
}

/** Entry point. */
async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log("==============================");
    console.log("   WELCOME TO SPEED ROUND QUIZ");
    console.log("==============================");
    console.log(`You have ${GAME_TIME_LIMIT} seconds in total. Answer as many as you can!`);
    console.log(`Get ${STREAK_THRESHOLD}+ correct in a row for +${STREAK_BONUS} bonus points each.`);

    let playing = true;
    while (playing) {
      const category = await chooseCategory(rl);
      await rl.question("\nPress Enter when you are ready - the clock starts immediately...");
      const round = await playRound(rl, filterByCategory(questions, category));
      showSummary(category, round);

      playing = await readYesNo(rl, "\nPlay again? (y/n): ");
    }
    console.log("\nThanks for playing. Goodbye!");
  } catch (error) {
    console.log("\nGame ended early. Goodbye!");
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseChoice,
  getCategories,
  filterByCategory,
  calculatePoints,
  scoreBreakdown,
  longestStreak,
  shuffle,
  formatOptions,
  startCountdown,
};
