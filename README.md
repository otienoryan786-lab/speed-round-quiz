# Speed Round Quiz

A command-line trivia game played against **one game-wide countdown**. Pick a category, then answer as many questions as you can before the clock hits zero. Streaks earn bonus points.

## Features
- Category menu (built from the question data with `map` + `Set`) and an "All" option
- One 40-second countdown for the whole game using `setInterval`, with warnings at 20, 10 and 5 seconds
- The time remaining is shown in every prompt
- Immediate correct / incorrect feedback
- Scoring: 10 points per correct answer, +5 bonus for each correct answer once you have 3+ in a row
- Game-over summary: answered, correct, longest streak, time used, total points
- Play-again option

## Requirements
Node.js 18 or newer.

## Run / Test
```bash
node quiz.js      # or: npm start
npm test
```

## How it meets the lab requirements
| Requirement | Where |
|---|---|
| Start a game / view questions sequentially | `main`, `playRound` (`for...of` over the question queue) |
| Select answers + validation | `askQuestion`, `parseChoice` (number or letter, re-prompts on bad input) |
| Feedback on answers and at game over | `askQuestion`, `showSummary` |
| Timer | `startCountdown` (`setInterval`) + `AbortController` to stop the prompt at zero |
| Arrays | `questions` array of objects |
| Array iteration methods | `map` (categories, options), `filter` (category + correct count), `reduce` (points) |
| Loops and functions | `for...of`, `while`, and small single-purpose functions with JSDoc |
# speed-round-quiz
