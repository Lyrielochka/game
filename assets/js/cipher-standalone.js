import { byId, normalize } from "./modules/utils.js";
import { showRoundFragmentReward } from "./modules/fragment-reward.js";

const BEST_KEY = "pro_cipher_unity_best";
const ROUND_SECONDS = 75;
const TASKS_PER_ROUND = 12;
const MAX_SKIPS = 3;
const TICK_MS = 200;

const TASK_POOL = [
  { answer: "РОДИНА", clue: "Место, где твой дом и твой народ." },
  { answer: "ФЛАГ", clue: "Государственный символ на полотне." },
  { answer: "ГЕРБ", clue: "Официальный знак страны." },
  { answer: "ГИМН", clue: "Торжественная песня государства." },
  { answer: "НАРОД", clue: "Люди одной страны." },
  { answer: "МИР", clue: "Спокойная жизнь без войны." },
  { answer: "ЧЕСТЬ", clue: "Что важно беречь защитнику." },
  { answer: "ДОЛГ", clue: "Обязанность перед страной и людьми." },
  { answer: "ПАМЯТЬ", clue: "Мы храним ее о героях прошлого." },
  { answer: "ОТВАГА", clue: "Смелость в трудную минуту." },
  { answer: "СЛУЖБА", clue: "Дело во благо Родины." },
  { answer: "ЕДИНСТВО", clue: "Когда все держатся вместе." },
  { answer: "ДРУЖБА", clue: "Сила, которая объединяет людей." },
  { answer: "СЕМЬЯ", clue: "Самые близкие люди рядом." },
  { answer: "ЗЕМЛЯ", clue: "Родной край под ногами." },
  { answer: "ГОРОД", clue: "Место, где мы живем и трудимся." },
  { answer: "ИСТОРИЯ", clue: "События прошлого нашей страны." },
  { answer: "ПОБЕДА", clue: "Результат мужества и единства." },
  { answer: "ЗАЩИТА", clue: "Охрана Родины и ее людей." }
];

const timerEl = byId("cipherTimer");
const progressEl = byId("cipherProgress");
const comboEl = byId("cipherCombo");
const statusEl = byId("cipherStatus");
const clueEl = byId("cipherClue");
const scrambleEl = byId("cipherScramble");
const inputEl = byId("cipherInput");
const checkBtn = byId("cipherCheck");
const skipBtn = byId("cipherSkip");
const scoreEl = byId("cipherScore");
const solvedEl = byId("cipherSolved");
const streakEl = byId("cipherStreak");
const bestEl = byId("cipherBest");
const feedbackEl = byId("cipherFeedback");
const startBtn = byId("cipherStart");
const restartBtn = byId("cipherRestart");

if (!timerEl || !progressEl || !comboEl || !statusEl || !clueEl || !scrambleEl || !inputEl || !checkBtn || !skipBtn || !scoreEl || !solvedEl || !streakEl || !bestEl || !feedbackEl || !startBtn || !restartBtn) {
  throw new Error("Cipher mode: required DOM nodes not found");
}

const state = {
  running: false,
  intervalId: 0,
  roundEndAt: 0,
  tasks: [],
  taskIndex: 0,
  score: 0,
  solved: 0,
  combo: 0,
  bestCombo: 0,
  skipsLeft: MAX_SKIPS,
  best: Number(localStorage.getItem(BEST_KEY) || "0")
};

function setFeedback(text, bad = false) {
  feedbackEl.textContent = text;
  feedbackEl.classList.toggle("bad", Boolean(bad));
}

function setStatus(text) {
  statusEl.textContent = `Статус: ${text}`;
}

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function scrambleWord(word) {
  const chars = word.split("");
  if (chars.length < 2) {
    return word;
  }

  let mixed = chars;
  for (let i = 0; i < 7; i += 1) {
    mixed = shuffle(mixed);
    if (mixed.join("") !== word) {
      return mixed.join("");
    }
  }
  return word.split("").reverse().join("");
}

function getTimeLeft() {
  return Math.max(0, Math.ceil((state.roundEndAt - Date.now()) / 1000));
}

function updateHud() {
  timerEl.textContent = `Время: ${getTimeLeft()}`;
  progressEl.textContent = `Задачи: ${state.solved} / ${state.tasks.length}`;
  comboEl.textContent = `Комбо: x${state.combo}`;
  scoreEl.textContent = String(state.score);
  solvedEl.textContent = String(state.solved);
  streakEl.textContent = String(state.bestCombo);
  bestEl.textContent = String(state.best);
  skipBtn.textContent = `Пропуск (${state.skipsLeft})`;
}

function setControlsEnabled(enabled) {
  inputEl.disabled = !enabled;
  checkBtn.disabled = !enabled;
  skipBtn.disabled = !enabled;
}

function renderTask() {
  const task = state.tasks[state.taskIndex];
  if (!task) {
    clueEl.textContent = "Все шифры в раунде решены.";
    scrambleEl.textContent = "---";
    setControlsEnabled(false);
    return;
  }

  clueEl.textContent = `Подсказка: ${task.clue}`;
  scrambleEl.textContent = task.scramble;
  inputEl.value = "";
  inputEl.focus();
}

function calcPoints(answerLength) {
  const base = 70 + answerLength * 10;
  const comboBonus = Math.round(base * Math.min(1.2, state.combo * 0.12));
  const timeBonus = getTimeLeft() * 2;
  return base + comboBonus + timeBonus;
}

function completeCurrentTask() {
  const task = state.tasks[state.taskIndex];
  const gained = calcPoints(task.answer.length);

  state.solved += 1;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.score += gained;
  state.taskIndex += 1;

  if (state.taskIndex >= state.tasks.length) {
    finishRound("Ты прошел весь набор шифров до таймера.", false);
    return;
  }

  setFeedback(`Верно: +${gained} очков. Отличный темп.`, false);
  renderTask();
  updateHud();
}

function failAttempt() {
  state.combo = 0;
  setFeedback("Пока не совпадает. Проверь порядок букв и попробуй снова.", true);
  updateHud();
}

function skipTask() {
  if (!state.running) {
    return;
  }
  if (state.skipsLeft <= 0) {
    setFeedback("Лимит пропусков исчерпан.", true);
    return;
  }

  state.skipsLeft -= 1;
  state.combo = 0;
  state.taskIndex += 1;

  if (state.taskIndex >= state.tasks.length) {
    finishRound("Все шифры завершены. Пропуски тоже считаются.", false);
    return;
  }

  setFeedback("Шифр пропущен. Продолжаем следующий.", true);
  renderTask();
  updateHud();
}

function checkAnswer() {
  if (!state.running) {
    return;
  }

  const task = state.tasks[state.taskIndex];
  if (!task) {
    return;
  }

  const entered = normalize(inputEl.value);
  if (!entered) {
    setFeedback("Сначала введи ответ.", true);
    return;
  }

  if (entered === task.answerNorm) {
    completeCurrentTask();
    return;
  }

  failAttempt();
}

function stopTimer() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = 0;
  }
}

function finishRound(message, bad) {
  state.running = false;
  stopTimer();
  setControlsEnabled(false);
  setStatus("раунд завершен");

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(state.best));
  }

  setFeedback(
    `${message} Итог: ${state.score} очков, решено ${state.solved}/${state.tasks.length}, лучшая серия x${state.bestCombo}.`,
    bad
  );
  updateHud();
  showRoundFragmentReward(1);
}

function tick() {
  if (!state.running) {
    return;
  }
  const left = getTimeLeft();
  timerEl.textContent = `Время: ${left}`;
  if (left <= 0) {
    finishRound("Время вышло.", true);
  }
}

function startRound() {
  stopTimer();
  state.running = true;
  state.roundEndAt = Date.now() + ROUND_SECONDS * 1000;
  state.tasks = shuffle(TASK_POOL).slice(0, TASKS_PER_ROUND).map((task) => ({
    ...task,
    answerNorm: normalize(task.answer),
    scramble: scrambleWord(task.answer)
  }));
  state.taskIndex = 0;
  state.score = 0;
  state.solved = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.skipsLeft = MAX_SKIPS;

  setStatus("в процессе");
  setFeedback("Расшифруй максимум слов до конца таймера.", false);
  setControlsEnabled(true);
  renderTask();
  updateHud();

  state.intervalId = setInterval(tick, TICK_MS);
}

function handleInputKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    checkAnswer();
  }
}

startBtn.addEventListener("click", startRound);
restartBtn.addEventListener("click", startRound);
checkBtn.addEventListener("click", checkAnswer);
skipBtn.addEventListener("click", skipTask);
inputEl.addEventListener("keydown", handleInputKey);

window.addEventListener("beforeunload", stopTimer);

(function init() {
  setStatus("готов");
  setFeedback("Нажми «Старт раунда», чтобы получить первый шифр.", false);
  setControlsEnabled(false);
  updateHud();
})();
