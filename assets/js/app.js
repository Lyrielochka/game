import { byId } from "./modules/utils.js";

const STAGES = [
  { num: 1, sectionId: "station1", statusId: "cipherStatus", doneKeywords: ["раунд завершен"], nextButtonId: "next1" },
  { num: 2, sectionId: "station2", statusId: "heritageStatus", doneKeywords: ["победа"], nextButtonId: "next2" },
  { num: 3, sectionId: "station3", statusId: "guardianStatus", doneKeywords: ["раунд завершен"], nextButtonId: "next3" },
  { num: 4, sectionId: "station4", statusId: "soloDashStatus", doneKeywords: ["финиш"], nextButtonId: "next4" },
  { num: 5, sectionId: "station5", statusId: "timelineState", doneKeywords: ["раунд завершен"], nextButtonId: "finishGame" }
];

const RUN_MAX_SCORE = 1500;
const RUN_IDEAL_TIME_SECONDS = 180;
const RUN_ZERO_TIME_SECONDS = 900;
const RUN_TIMER_INTERVAL_MS = 250;
const STAGE_POLL_INTERVAL_MS = 300;

const HOME_LAST_RESULT_KEY = "pro_edinstvo_last_score";
const BEST_RUN_SCORE_KEY = "pro_edinstvo_best";
const HOME_MUSIC_KEY = "pro_home_music_enabled";
const ROUND_MUSIC_SRC = "./музыка/1 раунд.mp3";
const ROUND_MUSIC_STAGES = new Set([1, 2, 3, 5]);
const PLAYER_NAME_KEY = "pro_edinstvo_player_name";
const HONOR_BOARD_EMAIL = "egortt@yandex.by";
const RESULT_CONFETTI_TIMEOUT_MS = 5200;
// Вставь сюда ссылку на опубликованный CSV Google Таблицы.
// Пример: https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv
const HONOR_BOARD_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1G6xWbYN_P5uJcRWKRte3yLFNrnODy0OhKN1YYg5DxAk/export?format=csv&gid=0";
const HONOR_BOARD_MAX_ROWS = 6;
const HONOR_BOARD_FETCH_TIMEOUT_MS = 7000;
// Вставь сюда URL Google Apps Script Web App для авто-отправки результатов.
// Пример: https://script.google.com/macros/s/.../exec

const state = {
  current: 0,
  completed: new Set(),
  run: {
    enabled: false,
    active: false,
    startedAt: 0,
    elapsedMs: 0,
    timerId: 0
  },
  stagePollId: 0,
  confettiTimerId: 0,
  lastResult: null
};

const homeScene = byId("homeScene");
const homeMusicToggle = byId("homeMusicToggle");
const homeRulesBtn = byId("homeRulesBtn");
const homeMascotImage = document.querySelector(".home-mascot-image");
const HOME_MASCOT_EXPLAIN_SRC = "./обьясняет.png";
const HOME_MASCOT_DEFAULT_SRC = homeMascotImage?.getAttribute("src") || "./масскот.png";
let isHomeMusicEnabled = localStorage.getItem(HOME_MUSIC_KEY) !== "0";

const homeMusic = new Audio("./музыка/летний фон.mp3");
homeMusic.preload = "auto";
homeMusic.loop = true;
homeMusic.volume = 0.42;

const roundMusic = new Audio(ROUND_MUSIC_SRC);
roundMusic.preload = "auto";
roundMusic.loop = true;
roundMusic.volume = 0.44;

const MASCOT_NAME = "Лада";
const HOME_RULE_STEPS = [
  {
    title: `Привет! Я ${MASCOT_NAME}`,
    text: "Рада видеть тебя в PROЕдинство. Сегодня мы спасаем волшебную Хронику поколений и собираем истории родной Беларуси."
  },
  {
    title: "1. Взломай код",
    text: "Озорной ветер перепутал буквы. Раскрути буквенный вихрь, собери слова-ценности и верни первый фрагмент."
  },
  {
    title: "2. Найди пару",
    text: "В зале памяти карточки играют в прятки. Находи пары и собирай факты о событиях, символах и героях страны."
  },
  {
    title: "3. Битва фактов",
    text: "Весёлый Хранитель фактов приготовил викторину. Отвечай смело, держи комбо и получай золотой ключ."
  },
  {
    title: "4. Прорыв",
    text: "Прыжок, ещё прыжок и ты мчишься к финишу. Пройди маршрут прорыва и передай сигнал в финальный модуль."
  },
  {
    title: "5. Лови быстрее",
    text: "Лови шарики памяти быстро и аккуратно. Каждый точный удар возвращает краски в Хронику поколений."
  },
  {
    title: "Готово",
    text: `${MASCOT_NAME} верит в тебя. Жми старт, проходи 5 этапов и покажи, как круто быть частью сильной и дружной страны.`
  }
];

const homeRulesGuide = {
  open: false,
  index: 0,
  root: null,
  bubble: null,
  nameEl: null,
  titleEl: null,
  textEl: null,
  progressEl: null,
  prevBtn: null,
  nextBtn: null,
  closeBtn: null
};

function detectCsvDelimiter(csvText) {
  const firstLine = (csvText || "").split(/\r?\n/, 1)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvRows(csvText, delimiter) {
  const rows = [];
  let row = [];
  let value = "";
  let isQuoted = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];

    if (isQuoted) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          isQuoted = false;
        }
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') {
      isQuoted = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(value);
      value = "";
      continue;
    }

    if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (ch !== "\r") {
      value += ch;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => String(cell || "").trim() !== ""));
}

function parseScoreValue(rawValue) {
  const cleaned = String(rawValue || "")
    .replace(/\s/g, "")
    .replace(/[^\d-]/g, "");
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatScoreLabel(score) {
  return `${Number(score || 0).toLocaleString("ru-RU")} очков`;
}

function parseHonorBoardEntries(csvText) {
  if (!csvText || !csvText.trim()) {
    return [];
  }

  const delimiter = detectCsvDelimiter(csvText);
  const rows = parseCsvRows(csvText, delimiter);
  const entries = [];

  rows.forEach((row) => {
    const name = String(row[0] || "").trim();
    const score = parseScoreValue(row[1]);
    if (!name || !Number.isFinite(score)) {
      return;
    }
    entries.push({ name, score });
  });

  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, HONOR_BOARD_MAX_ROWS);
}

function normalizePlayerName(rawName) {
  return String(rawName || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

function getStoredPlayerName() {
  return normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY) || "");
}

function setPlayerNameInputValue(name) {
  const playerNameInput = byId("playerNameInput");
  if (!playerNameInput) {
    return;
  }
  playerNameInput.value = normalizePlayerName(name || "");
}

function savePlayerNameFromInput(showStatusMessage = false) {
  const playerNameInput = byId("playerNameInput");
  if (!playerNameInput) {
    return "";
  }

  const playerName = normalizePlayerName(playerNameInput.value || "");
  playerNameInput.value = playerName;

  if (!playerName) {
    localStorage.removeItem(PLAYER_NAME_KEY);
    if (showStatusMessage) {
      setResultSyncStatus("Имя очищено. Укажи новое имя перед отправкой результата.");
    }
    return "";
  }

  localStorage.setItem(PLAYER_NAME_KEY, playerName);
  if (showStatusMessage) {
    setResultSyncStatus(`Имя сохранено: ${playerName}`);
  }
  return playerName;
}

function getPlayerNameForSubmit() {
  const inputName = savePlayerNameFromInput(false);
  if (inputName) {
    return inputName;
  }

  const savedName = getStoredPlayerName();
  if (savedName) {
    return savedName;
  }

  const enteredName = window.prompt("Введите имя для отправки результата на доску почета:", "Игрок");
  const playerName = normalizePlayerName(enteredName || "");
  if (!playerName) {
    return "";
  }

  localStorage.setItem(PLAYER_NAME_KEY, playerName);
  setPlayerNameInputValue(playerName);
  return playerName;
}

function setResultSyncStatus(message) {
  const statusNode = byId("resultSyncStatus");
  if (!statusNode) {
    return;
  }
  statusNode.textContent = message;
}

function clearResultConfetti() {
  const confettiRoot = byId("confetti");
  if (!confettiRoot) {
    return;
  }
  if (state.confettiTimerId) {
    clearTimeout(state.confettiTimerId);
    state.confettiTimerId = 0;
  }
  confettiRoot.innerHTML = "";
  confettiRoot.classList.add("hidden");
}

function launchResultConfetti() {
  const confettiRoot = byId("confetti");
  if (!confettiRoot) {
    return;
  }

  clearResultConfetti();
  confettiRoot.classList.remove("hidden");
  const piecesCount = 110;
  for (let i = 0; i < piecesCount; i += 1) {
    const piece = document.createElement("i");
    const hue = Math.round(15 + Math.random() * 140);
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDuration = `${2.1 + Math.random() * 2.7}s`;
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.transform = `rotate(${Math.round(Math.random() * 360)}deg)`;
    piece.style.opacity = String(0.55 + Math.random() * 0.4);
    piece.style.background = `hsl(${hue} 92% 62%)`;
    confettiRoot.appendChild(piece);
  }

  state.confettiTimerId = window.setTimeout(() => {
    clearResultConfetti();
  }, RESULT_CONFETTI_TIMEOUT_MS);
}

function getRunPaceLabel(elapsedMs) {
  const elapsedSeconds = Math.round(elapsedMs / 1000);
  if (elapsedSeconds <= 180) {
    return "Молниеносный";
  }
  if (elapsedSeconds <= 300) {
    return "Отличный";
  }
  if (elapsedSeconds <= 540) {
    return "Уверенный";
  }
  return "Тренировочный";
}

function buildResultMailto(playerName, resultData) {
  const subject = `PROЕдинство: результат ${playerName} — ${resultData.finalScore}/${RUN_MAX_SCORE}`;
  const finishedAt = new Date(resultData.finishedAt).toLocaleString("ru-RU");
  const body = [
    "Здравствуйте!",
    "",
    "Прошу добавить мой результат на доску почета PROЕдинство.",
    "",
    `Имя: ${playerName}`,
    `Очки: ${resultData.finalScore} / ${RUN_MAX_SCORE} (${resultData.percent}%)`,
    `Уровень: ${resultData.levelText}`,
    `Время прохождения: ${formatDuration(resultData.elapsedMs)}`,
    `Пройдено этапов: ${resultData.completedStages}/${STAGES.length}`,
    `Дата прохождения: ${finishedAt}`,
    "",
    "Спасибо!"
  ].join("\n");

  return `mailto:${HONOR_BOARD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function sendResultByEmail() {
  if (!state.lastResult) {
    setResultSyncStatus("Сначала завершите миссию, чтобы отправить результат.");
    return;
  }

  const playerName = getPlayerNameForSubmit();
  if (!playerName) {
    setResultSyncStatus("Отправка отменена: имя не указано.");
    return;
  }

  const mailtoUrl = buildResultMailto(playerName, state.lastResult);
  window.location.href = mailtoUrl;
  setResultSyncStatus(`Открылось письмо на ${HONOR_BOARD_EMAIL}. Отправьте его, чтобы попасть на доску почета.`);
}

function renderHomeHonorBoard(entries) {
  const list = byId("homeHonorBoardList");
  if (!list) {
    return;
  }

  list.innerHTML = "";
  entries.forEach((entry, index) => {
    const row = document.createElement("li");
    row.className = "right-board-row";

    const medal = document.createElement("div");
    medal.className = "img-slot right-medal-slot";
    medal.setAttribute("data-slot", `right-medal-${index + 1}`);
    medal.textContent = `medal-${index + 1}.png`;

    const name = document.createElement("span");
    name.className = "right-board-name";
    name.textContent = entry.name;

    const score = document.createElement("span");
    score.className = "right-board-score";
    score.textContent = formatScoreLabel(entry.score);

    row.append(medal, name, score);
    list.appendChild(row);
  });
}

async function loadHomeHonorBoard() {
  const list = byId("homeHonorBoardList");
  const csvUrl = HONOR_BOARD_CSV_URL.trim();
  if (!list || !document.body.classList.contains("home-page") || !csvUrl) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HONOR_BOARD_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(csvUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const entries = parseHonorBoardEntries(csvText);
    if (!entries.length) {
      throw new Error("Empty honor board payload");
    }

    renderHomeHonorBoard(entries);
  } catch (_) {
    // Если таблица недоступна, остается встроенный список из index.html.
  } finally {
    clearTimeout(timeoutId);
  }
}

function updateHomeMusicButton() {
  if (!homeMusicToggle) {
    return;
  }

  homeMusicToggle.classList.toggle("is-on", isHomeMusicEnabled);
  homeMusicToggle.classList.toggle("is-off", !isHomeMusicEnabled);
  homeMusicToggle.setAttribute("aria-pressed", String(isHomeMusicEnabled));
  homeMusicToggle.setAttribute(
    "aria-label",
    isHomeMusicEnabled ? "Выключить музыку на главной" : "Включить музыку на главной"
  );
}

function stopHomeMusic(resetTime = false) {
  homeMusic.pause();
  if (resetTime) {
    homeMusic.currentTime = 0;
  }
}

function tryPlayHomeMusic() {
  if (!isHomeMusicEnabled || !document.body.classList.contains("home-page")) {
    return;
  }

  const playPromise = homeMusic.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function syncHomeMusic() {
  if (document.body.classList.contains("home-page") && isHomeMusicEnabled) {
    tryPlayHomeMusic();
  } else {
    stopHomeMusic(false);
  }
  updateHomeMusicButton();
}

function stopRoundMusic(resetTime = false) {
  roundMusic.pause();
  if (resetTime) {
    roundMusic.currentTime = 0;
  }
}

function isRoundMusicStageVisible() {
  if (document.body.classList.contains("home-page")) {
    return false;
  }
  if (!ROUND_MUSIC_STAGES.has(state.current)) {
    return false;
  }

  const stage = stageByNum(state.current);
  if (!stage) {
    return false;
  }

  const stageSection = byId(stage.sectionId);
  return Boolean(stageSection && !stageSection.classList.contains("hidden"));
}

function tryPlayRoundMusic() {
  if (!isRoundMusicStageVisible()) {
    return;
  }
  const playPromise = roundMusic.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function syncRoundMusic() {
  if (!isRoundMusicStageVisible()) {
    stopRoundMusic(false);
    return;
  }
  tryPlayRoundMusic();
}

function stopDashMusic(resetTime = false) {
  const dashController = window.__proDashSolo;
  if (!dashController || typeof dashController.stopMusic !== "function") {
    return;
  }
  dashController.stopMusic(Boolean(resetTime));
}

function tryPlayDashMusic() {
  const dashController = window.__proDashSolo;
  if (!dashController || !dashController.running || typeof dashController.playMusic !== "function") {
    return;
  }
  dashController.playMusic();
}

function syncStageAudio() {
  syncRoundMusic();
  if (state.current === 4 && !document.body.classList.contains("home-page")) {
    tryPlayDashMusic();
    return;
  }
  stopDashMusic(false);
}

function fitHomeScene() {
  if (!homeScene) {
    return;
  }

  if (!document.body.classList.contains("home-page")) {
    homeScene.style.transform = "";
    homeScene.style.transformOrigin = "";
    return;
  }

  homeScene.style.transform = "scale(1)";
  homeScene.style.transformOrigin = "top center";

  const viewportW = window.innerWidth - 10;
  const viewportH = window.innerHeight - 10;
  const sceneW = homeScene.scrollWidth;
  const sceneH = homeScene.scrollHeight;

  if (!sceneW || !sceneH) {
    return;
  }

  const scale = Math.min(viewportW / sceneW, viewportH / sceneH, 1);
  homeScene.style.transform = `scale(${scale})`;
  positionHomeRulesGuide();
}

function setHomeMascotExplainMode(enabled) {
  if (!homeMascotImage) {
    return;
  }
  homeMascotImage.setAttribute("src", enabled ? HOME_MASCOT_EXPLAIN_SRC : HOME_MASCOT_DEFAULT_SRC);
}

function buildHomeRulesGuide() {
  if (homeRulesGuide.root || !document.body.classList.contains("home-page")) {
    return;
  }

  const root = document.createElement("div");
  root.className = "home-rules-guide is-hidden";

  const bubble = document.createElement("section");
  bubble.className = "home-rules-bubble";
  bubble.setAttribute("role", "dialog");
  bubble.setAttribute("aria-live", "polite");

  const nameEl = document.createElement("div");
  nameEl.className = "home-rules-name";
  bubble.appendChild(nameEl);

  const titleEl = document.createElement("h3");
  titleEl.className = "home-rules-title";
  bubble.appendChild(titleEl);

  const textEl = document.createElement("p");
  textEl.className = "home-rules-text";
  bubble.appendChild(textEl);

  const footer = document.createElement("div");
  footer.className = "home-rules-footer";

  const progressEl = document.createElement("span");
  progressEl.className = "home-rules-progress";
  footer.appendChild(progressEl);

  const controls = document.createElement("div");
  controls.className = "home-rules-controls";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "home-rules-nav";
  prevBtn.textContent = "←";
  controls.appendChild(prevBtn);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "home-rules-next";
  nextBtn.textContent = "Далее →";
  controls.appendChild(nextBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "home-rules-close";
  closeBtn.textContent = "Закрыть";
  controls.appendChild(closeBtn);

  footer.appendChild(controls);
  bubble.appendChild(footer);
  root.appendChild(bubble);

  prevBtn.addEventListener("click", prevHomeRulesStep);
  nextBtn.addEventListener("click", nextHomeRulesStep);
  closeBtn.addEventListener("click", closeHomeRulesGuide);

  document.body.appendChild(root);

  homeRulesGuide.root = root;
  homeRulesGuide.bubble = bubble;
  homeRulesGuide.nameEl = nameEl;
  homeRulesGuide.titleEl = titleEl;
  homeRulesGuide.textEl = textEl;
  homeRulesGuide.progressEl = progressEl;
  homeRulesGuide.prevBtn = prevBtn;
  homeRulesGuide.nextBtn = nextBtn;
  homeRulesGuide.closeBtn = closeBtn;
}

function positionHomeRulesGuide() {
  if (!homeRulesGuide.open || !homeRulesGuide.bubble) {
    return;
  }

  const bubbleRect = homeRulesGuide.bubble.getBoundingClientRect();
  const mascotRect = homeMascotImage ? homeMascotImage.getBoundingClientRect() : null;

  let bubbleLeft = 24;
  let bubbleTop = 24;
  if (mascotRect) {
    bubbleLeft = mascotRect.left + mascotRect.width * 0.47;
    bubbleTop = mascotRect.top - bubbleRect.height * 0.88;
  }

  bubbleLeft = Math.max(12, Math.min(window.innerWidth - bubbleRect.width - 12, bubbleLeft));
  bubbleTop = Math.max(12, Math.min(window.innerHeight - bubbleRect.height - 12, bubbleTop));

  homeRulesGuide.bubble.style.left = `${Math.round(bubbleLeft)}px`;
  homeRulesGuide.bubble.style.top = `${Math.round(bubbleTop)}px`;
}

function renderHomeRulesStep() {
  const step = HOME_RULE_STEPS[homeRulesGuide.index];
  if (!step) {
    return;
  }

  homeRulesGuide.nameEl.textContent = MASCOT_NAME;
  homeRulesGuide.titleEl.textContent = step.title;
  homeRulesGuide.textEl.textContent = step.text;
  homeRulesGuide.progressEl.textContent = `${homeRulesGuide.index + 1}/${HOME_RULE_STEPS.length}`;
  homeRulesGuide.prevBtn.disabled = homeRulesGuide.index === 0;
  homeRulesGuide.nextBtn.textContent =
    homeRulesGuide.index >= HOME_RULE_STEPS.length - 1 ? "Готово" : "Далее →";

  requestAnimationFrame(positionHomeRulesGuide);
}

function openHomeRulesGuide() {
  buildHomeRulesGuide();
  if (!homeRulesGuide.root) {
    return;
  }

  setHomeMascotExplainMode(true);
  homeRulesGuide.open = true;
  homeRulesGuide.index = 0;
  homeRulesGuide.root.classList.remove("is-hidden");
  renderHomeRulesStep();
}

function closeHomeRulesGuide() {
  setHomeMascotExplainMode(false);
  homeRulesGuide.open = false;
  if (homeRulesGuide.root) {
    homeRulesGuide.root.classList.add("is-hidden");
  }
}

function nextHomeRulesStep() {
  if (!homeRulesGuide.open) {
    return;
  }

  if (homeRulesGuide.index >= HOME_RULE_STEPS.length - 1) {
    closeHomeRulesGuide();
    return;
  }

  homeRulesGuide.index += 1;
  renderHomeRulesStep();
}

function prevHomeRulesStep() {
  if (!homeRulesGuide.open || homeRulesGuide.index <= 0) {
    return;
  }

  homeRulesGuide.index -= 1;
  renderHomeRulesStep();
}

function updateHomeLastResult() {
  const valueNode = byId("homeLastResultValue");
  if (!valueNode) {
    return;
  }

  const lastScore = Number(localStorage.getItem(HOME_LAST_RESULT_KEY) || "0");
  valueNode.textContent = Math.max(0, Math.floor(lastScore)).toLocaleString("ru-RU");
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getRunElapsedMs() {
  if (state.run.active && state.run.startedAt > 0) {
    return Date.now() - state.run.startedAt;
  }
  return state.run.elapsedMs;
}

function updateRunTimerLabel() {
  const timerNode = byId("runTimerLabel");
  if (!timerNode) {
    return;
  }

  timerNode.textContent = `Таймер: ${formatDuration(getRunElapsedMs())}`;
}

function setRunTimerVisible(visible) {
  const timerNode = byId("runTimerLabel");
  if (!timerNode) {
    return;
  }
  timerNode.classList.toggle("hidden", !visible);
}

function stopRunTimer() {
  if (state.run.timerId) {
    clearInterval(state.run.timerId);
    state.run.timerId = 0;
  }

  if (state.run.active && state.run.startedAt > 0) {
    state.run.elapsedMs = Date.now() - state.run.startedAt;
  }

  state.run.active = false;
  updateRunTimerLabel();
}

function startRunTimer() {
  stopRunTimer();
  state.run.elapsedMs = 0;
  state.run.startedAt = Date.now();
  state.run.active = true;
  updateRunTimerLabel();
  state.run.timerId = window.setInterval(updateRunTimerLabel, RUN_TIMER_INTERVAL_MS);
}

function toRunScore(elapsedMs) {
  const elapsedSeconds = Math.round(elapsedMs / 1000);
  if (elapsedSeconds <= RUN_IDEAL_TIME_SECONDS) {
    return RUN_MAX_SCORE;
  }

  const ratio =
    (RUN_ZERO_TIME_SECONDS - elapsedSeconds) /
    (RUN_ZERO_TIME_SECONDS - RUN_IDEAL_TIME_SECONDS);

  return Math.max(0, Math.min(RUN_MAX_SCORE, Math.round(ratio * RUN_MAX_SCORE)));
}

function stageByNum(num) {
  return STAGES.find((stage) => stage.num === num) || null;
}

function renderSteps() {
  const steps = byId("steps");
  if (!steps) {
    return;
  }

  steps.innerHTML = "";

  for (let i = 1; i <= STAGES.length; i += 1) {
    const node = document.createElement("div");
    node.className = "step";

    if (state.completed.has(i)) {
      node.classList.add("done");
      node.textContent = "✓";
    } else {
      node.textContent = String(i);
    }

    if (state.current === i && !state.completed.has(i)) {
      node.classList.add("active");
    }

    steps.appendChild(node);
  }
}

function updateHud() {
  const scoreLabel = byId("scoreLabel");
  const achievementLabel = byId("achievementLabel");
  if (!scoreLabel || !achievementLabel) {
    return;
  }

  const currentStage = state.current > 0 ? state.current : 1;
  scoreLabel.textContent = `Этап ${currentStage} из ${STAGES.length}`;
  achievementLabel.textContent = `Пройдено: ${state.completed.size}/${STAGES.length}`;
}

function setStageNextButton(num, enabled) {
  const stage = stageByNum(num);
  if (!stage) {
    return;
  }

  const node = byId(stage.nextButtonId);
  if (!node) {
    return;
  }

  node.disabled = !enabled;
}

function completeStage(num) {
  if (state.completed.has(num)) {
    return;
  }

  state.completed.add(num);
  updateHud();
  renderSteps();
  setStageNextButton(num, true);
}

function showStation(num) {
  state.current = num;

  STAGES.forEach((stage) => {
    const section = byId(stage.sectionId);
    if (section) {
      section.classList.toggle("hidden", stage.num !== num);
    }
  });

  byId("result")?.classList.add("hidden");
  clearResultConfetti();
  updateHud();
  renderSteps();
  syncStageAudio();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isStageDoneByStatus(stage, statusText) {
  const text = (statusText || "").toLowerCase();
  return stage.doneKeywords.some((keyword) => text.includes(keyword));
}

function checkCurrentStageCompletion() {
  const stage = stageByNum(state.current);
  if (!stage || state.completed.has(stage.num)) {
    return;
  }

  const statusNode = byId(stage.statusId);
  if (!statusNode) {
    return;
  }

  if (isStageDoneByStatus(stage, statusNode.textContent || "")) {
    completeStage(stage.num);
  }
}

function startStagePolling() {
  if (state.stagePollId) {
    clearInterval(state.stagePollId);
  }
  state.stagePollId = window.setInterval(checkCurrentStageCompletion, STAGE_POLL_INTERVAL_MS);
}

function stopStagePolling() {
  if (!state.stagePollId) {
    return;
  }
  clearInterval(state.stagePollId);
  state.stagePollId = 0;
}

function resetMissionState() {
  stopRunTimer();
  stopStagePolling();
  stopRoundMusic(true);
  stopDashMusic(true);
  clearResultConfetti();

  state.current = 0;
  state.completed.clear();
  state.run.enabled = false;
  state.run.startedAt = 0;
  state.run.elapsedMs = 0;
  state.lastResult = null;

  [1, 2, 3, 4, 5].forEach((num) => {
    setStageNextButton(num, false);
  });

  setRunTimerVisible(false);
  updateRunTimerLabel();
  updateHud();
  renderSteps();
}

function showResult() {
  stopRunTimer();
  stopStagePolling();
  stopRoundMusic(false);
  stopDashMusic(false);

  STAGES.forEach((stage) => {
    const section = byId(stage.sectionId);
    if (section) {
      section.classList.add("hidden");
    }
  });

  const resultSection = byId("result");
  if (resultSection) {
    resultSection.classList.remove("hidden");
    resultSection.classList.remove("result-fresh");
    void resultSection.offsetWidth;
    resultSection.classList.add("result-fresh");
  }

  const elapsedMs = getRunElapsedMs();
  const finalScore = toRunScore(elapsedMs);
  const percent = Math.round((finalScore / RUN_MAX_SCORE) * 100);

  let levelText = "Участник";
  let leadText = "Хроника собрана. Отличная командная работа!";
  if (percent >= 85) {
    levelText = "Лидер Единства";
    leadText = "Супер! Ты молниеносно собрал все 5 фрагментов и зажёг звезду Единства.";
  } else if (percent >= 65) {
    levelText = "Координатор";
    leadText = "Отличный темп! Хроника спасена, а истории родной страны снова звучат ярко.";
  }

  const best = Number(localStorage.getItem(BEST_RUN_SCORE_KEY) || "0");
  const newBest = Math.max(best, finalScore);
  const isNewBest = finalScore > best;
  const toBest = Math.max(0, newBest - finalScore);

  byId("resultScore").textContent = `${finalScore} / ${RUN_MAX_SCORE} (${percent}%)`;
  byId("resultRunTime").textContent = formatDuration(elapsedMs);
  byId("resultAchievement").textContent = `${state.completed.size}/${STAGES.length}`;
  byId("resultLevel").textContent = levelText;
  byId("resultLead").textContent = leadText;
  byId("resultPace").textContent = getRunPaceLabel(elapsedMs);
  byId("resultToBest").textContent = isNewBest ? "Новый рекорд!" : `${toBest} очков`;
  byId("resultCongrats").textContent = isNewBest
    ? "Ты установил новый личный рекорд. Отличная работа!"
    : "Крутой финиш. Еще один забег может поднять тебя в топ.";
  byId("resultHint").textContent =
    "Подсчет очков: 1500 за 03:00 и быстрее. После 03:00 очки снижаются линейно, к 15:00 становятся 0.";
  byId("resultMailLead").textContent =
    "Хочешь попасть на доску почета? Отправь письмо с результатом на egortt@yandex.by.";
  setResultSyncStatus("Нажми кнопку выше, чтобы сформировать письмо с твоим результатом.");
  setPlayerNameInputValue(getStoredPlayerName());

  localStorage.setItem(HOME_LAST_RESULT_KEY, String(finalScore));
  updateHomeLastResult();

  localStorage.setItem(BEST_RUN_SCORE_KEY, String(newBest));
  byId("bestScore").textContent = `${newBest} / ${RUN_MAX_SCORE}`;

  state.lastResult = {
    finalScore,
    elapsedMs,
    percent,
    levelText,
    completedStages: state.completed.size,
    finishedAt: new Date().toISOString()
  };

  launchResultConfetti();
}

function launchMission() {
  closeHomeRulesGuide();
  document.body.classList.remove("home-page");
  syncHomeMusic();
  syncStageAudio();
  fitHomeScene();
  resetMissionState();

  state.run.enabled = true;
  setRunTimerVisible(true);
  startRunTimer();
  startStagePolling();

  byId("intro")?.classList.add("hidden");
  byId("gameHud")?.classList.remove("hidden");
  byId("result")?.classList.add("hidden");
  showStation(1);
}

function returnToHome() {
  stopRoundMusic(true);
  stopDashMusic(true);
  window.location.href = "./index.html";
}

const startGameButton = byId("startGame");
if (startGameButton) {
  startGameButton.addEventListener("click", launchMission);
}

const homeStartGameButton = byId("homeStartGame");
if (homeStartGameButton) {
  homeStartGameButton.addEventListener("click", launchMission);
}

if (homeRulesBtn) {
  homeRulesBtn.addEventListener("click", () => {
    if (homeRulesGuide.open) {
      closeHomeRulesGuide();
      return;
    }
    openHomeRulesGuide();
  });
}

const beatModeTrigger = byId("beatModeTrigger");
if (beatModeTrigger) {
  beatModeTrigger.addEventListener("click", () => {
    window.location.href = "./cipher.html";
  });
}

const heritageModeTrigger = byId("heritageModeTrigger");
if (heritageModeTrigger) {
  heritageModeTrigger.addEventListener("click", () => {
    window.location.href = "./heritage.html";
  });
}

const guardianModeTrigger = byId("guardianModeTrigger");
if (guardianModeTrigger) {
  guardianModeTrigger.addEventListener("click", () => {
    window.location.href = "./guardian.html";
  });
}

const rhythmStartTrigger = byId("rhythmStartTrigger");
if (rhythmStartTrigger) {
  rhythmStartTrigger.addEventListener("click", () => {
    window.location.href = "./rush.html";
  });
}

const lineTimeTrigger = byId("lineTimeTrigger");
if (lineTimeTrigger) {
  lineTimeTrigger.addEventListener("click", () => {
    window.location.href = "./timeline.html";
  });
}

const backHomeButton = byId("backHome");
if (backHomeButton) {
  backHomeButton.addEventListener("click", returnToHome);
}

const next1 = byId("next1");
if (next1) {
  next1.addEventListener("click", () => showStation(2));
}

const next2 = byId("next2");
if (next2) {
  next2.addEventListener("click", () => showStation(3));
}

const next3 = byId("next3");
if (next3) {
  next3.addEventListener("click", () => showStation(4));
}

const next4 = byId("next4");
if (next4) {
  next4.addEventListener("click", () => showStation(5));
}

const finishGame = byId("finishGame");
if (finishGame) {
  finishGame.addEventListener("click", showResult);
}

const restart = byId("restart");
if (restart) {
  restart.addEventListener("click", launchMission);
}

const resultBackHome = byId("resultBackHome");
if (resultBackHome) {
  resultBackHome.addEventListener("click", returnToHome);
}

const sendByEmail = byId("sendByEmail");
if (sendByEmail) {
  sendByEmail.addEventListener("click", sendResultByEmail);
}

const savePlayerNameButton = byId("savePlayerName");
if (savePlayerNameButton) {
  savePlayerNameButton.addEventListener("click", () => {
    savePlayerNameFromInput(true);
  });
}

const playerNameInput = byId("playerNameInput");
if (playerNameInput) {
  playerNameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    savePlayerNameFromInput(true);
  });

  playerNameInput.addEventListener("blur", () => {
    savePlayerNameFromInput(false);
  });
}

if (homeMusicToggle) {
  homeMusicToggle.addEventListener("click", () => {
    isHomeMusicEnabled = !isHomeMusicEnabled;
    localStorage.setItem(HOME_MUSIC_KEY, isHomeMusicEnabled ? "1" : "0");
    syncHomeMusic();
  });
}

const unlockHomeMusic = () => {
  syncHomeMusic();
  syncStageAudio();
};

document.addEventListener("pointerdown", unlockHomeMusic);
document.addEventListener("keydown", unlockHomeMusic);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && homeRulesGuide.open) {
    closeHomeRulesGuide();
  }
});
document.addEventListener("touchstart", unlockHomeMusic, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopHomeMusic(false);
    stopRoundMusic(false);
    stopDashMusic(false);
    return;
  }
  syncHomeMusic();
  syncStageAudio();
});
window.addEventListener("pageshow", () => {
  syncHomeMusic();
  syncStageAudio();
});
window.addEventListener("resize", () => {
  fitHomeScene();
  positionHomeRulesGuide();
});
window.addEventListener("scroll", positionHomeRulesGuide, { passive: true });
window.addEventListener("load", fitHomeScene);

updateHomeMusicButton();
syncHomeMusic();
updateHomeLastResult();
loadHomeHonorBoard();
setPlayerNameInputValue(getStoredPlayerName());
resetMissionState();
fitHomeScene();

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitHomeScene).catch(() => {});
}


