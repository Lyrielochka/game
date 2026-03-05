import { byId } from "./modules/utils.js";

import { showRoundFragmentReward } from "./modules/fragment-reward.js";
const TOTAL_TIME = 180;
const STORAGE_KEY_PREFIX = "pro_heritage_records_";

const THEMES = {
  belarus_history: {
    name: "История Беларуси",
    pairs: [
      { id: "1517", a: "1517", b: "Франциск Скорина издает первую книгу в Праге" },
      { id: "1918", a: "1918", b: "Провозглашение Белорусской Народной Республики" },
      { id: "1919", a: "1919", b: "Образование БССР" },
      { id: "1944", a: "1944", b: "Освобождение Минска (операция «Багратион»)" },
      { id: "1945", a: "1945", b: "БССР среди государств-учредителей ООН" },
      { id: "1991", a: "1991", b: "Независимость Республики Беларусь" },
      { id: "1994", a: "1994", b: "Принята Конституция Республики Беларусь" },
      { id: "1995", a: "1995", b: "Закреплены современные государственные символы" }
    ]
  },
  state_symbols: {
    name: "Государственность и символы",
    pairs: [
      { id: "constitution", a: "Конституция", b: "Основной закон государства" },
      { id: "flag", a: "Государственный флаг", b: "Официальный символ страны" },
      { id: "emblem", a: "Герб", b: "Символ суверенитета и исторической преемственности" },
      { id: "anthem", a: "Гимн", b: "Музыкальный символ государства" },
      { id: "capital", a: "Минск", b: "Столица Республики Беларусь" },
      { id: "sovereignty", a: "Суверенитет", b: "Право государства на самостоятельную политику" },
      { id: "un", a: "ООН", b: "Международная организация, где Беларусь с 1945 года" },
      { id: "independence_day", a: "3 июля", b: "День Независимости Республики Беларусь" }
    ]
  },
  culture_science: {
    name: "Культура и наука",
    pairs: [
      { id: "skaryna", a: "Франциск Скорина", b: "Первопечатник и просветитель" },
      { id: "kupala", a: "Янка Купала", b: "Классик белорусской литературы" },
      { id: "kolas", a: "Якуб Колас", b: "Народный поэт Беларуси" },
      { id: "radziwill", a: "Несвиж", b: "Дворцово-парковый комплекс Радзивиллов" },
      { id: "mir", a: "Мирский замок", b: "Памятник Всемирного наследия ЮНЕСКО" },
      { id: "nasb", a: "Национальная академия наук", b: "Ключевой научный центр страны" },
      { id: "slutsk", a: "Слуцкие пояса", b: "Уникальный памятник декоративного искусства" },
      { id: "khatyn", a: "Хатынь", b: "Мемориальный комплекс памяти жертв войны" }
    ]
  }
};

const boardEl = byId("heritageBoard");
const timerEl = byId("heritageTimer");
const movesEl = byId("heritageMoves");
const matchesEl = byId("heritageMatches");
const statusEl = byId("heritageStatus");
const feedbackEl = byId("heritageFeedback");
const bestTimeEl = byId("heritageBestTime");
const bestMovesEl = byId("heritageBestMoves");
const winsEl = byId("heritageWins");
const themeEl = byId("heritageTheme");
const startBtn = byId("heritageStart");
const restartBtn = byId("heritageRestart");

if (!boardEl || !timerEl || !movesEl || !matchesEl || !statusEl || !feedbackEl || !themeEl || !startBtn || !restartBtn) {
  throw new Error("Heritage mode: required DOM nodes not found");
}

const state = {
  themeId: themeEl.value,
  cards: [],
  firstOpen: null,
  secondOpen: null,
  lock: false,
  moves: 0,
  matched: 0,
  timeLeft: TOTAL_TIME,
  timerId: 0,
  running: false,
  wins: 0
};

function setFeedback(text, bad = false) {
  feedbackEl.textContent = text;
  feedbackEl.classList.toggle("bad", Boolean(bad));
}

function setStatus(text) {
  statusEl.textContent = `Статус: ${text}`;
}

function getTheme() {
  return THEMES[state.themeId];
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getRecordKey() {
  return `${STORAGE_KEY_PREFIX}${state.themeId}`;
}

function loadRecords() {
  const raw = localStorage.getItem(getRecordKey());
  if (!raw) {
    return { bestTime: null, bestMoves: null, wins: 0 };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      bestTime: Number.isFinite(parsed.bestTime) ? parsed.bestTime : null,
      bestMoves: Number.isFinite(parsed.bestMoves) ? parsed.bestMoves : null,
      wins: Number.isFinite(parsed.wins) ? parsed.wins : 0
    };
  } catch {
    return { bestTime: null, bestMoves: null, wins: 0 };
  }
}

function saveRecords(record) {
  localStorage.setItem(getRecordKey(), JSON.stringify(record));
}

function updateRecordUI() {
  const rec = loadRecords();
  bestTimeEl.textContent = rec.bestTime == null ? "-" : `${rec.bestTime} сек.`;
  bestMovesEl.textContent = rec.bestMoves == null ? "-" : String(rec.bestMoves);
  winsEl.textContent = String(rec.wins || 0);
}

function updateHud() {
  timerEl.textContent = `Время: ${state.timeLeft}`;
  movesEl.textContent = `Ходы: ${state.moves}`;
  matchesEl.textContent = `Пары: ${state.matched} / ${getTheme().pairs.length}`;
}

function clearTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = 0;
  }
}

function stopGame(status = "готов") {
  state.running = false;
  clearTimer();
  setStatus(status);
}

function cardHtml(card) {
  return `
    <button class="heritage-card" data-id="${card.uid}" type="button" aria-label="Карточка">
      <span class="heritage-card-inner">
        <span class="heritage-card-front" aria-hidden="true"></span>
        <span class="heritage-card-back">${card.text}</span>
      </span>
    </button>
  `;
}

function renderBoard() {
  boardEl.innerHTML = state.cards.map(cardHtml).join("");

  boardEl.querySelectorAll(".heritage-card").forEach((node) => {
    node.addEventListener("click", () => handleCardClick(node));
  });
}

function openCard(node) {
  node.classList.add("open");
}

function closeCard(node) {
  node.classList.remove("open");
}

function matchCard(node) {
  node.classList.add("matched");
  node.disabled = true;
}

function getCard(uid) {
  return state.cards.find((x) => x.uid === uid);
}

function handleCardClick(node) {
  if (!state.running || state.lock || node.classList.contains("open") || node.classList.contains("matched")) {
    return;
  }

  const uid = node.dataset.id;
  const card = getCard(uid);
  if (!card) {
    return;
  }

  openCard(node);

  if (!state.firstOpen) {
    state.firstOpen = { uid, node, card };
    return;
  }

  state.secondOpen = { uid, node, card };
  state.moves += 1;
  state.lock = true;
  updateHud();

  const isPair = state.firstOpen.card.pairId === state.secondOpen.card.pairId && state.firstOpen.uid !== state.secondOpen.uid;

  if (isPair) {
    setTimeout(() => {
      matchCard(state.firstOpen.node);
      matchCard(state.secondOpen.node);

      state.matched += 1;
      state.firstOpen = null;
      state.secondOpen = null;
      state.lock = false;
      updateHud();

      if (state.matched >= getTheme().pairs.length) {
        finishWin();
      }
    }, 220);
    return;
  }

  setTimeout(() => {
    closeCard(state.firstOpen.node);
    closeCard(state.secondOpen.node);
    state.firstOpen = null;
    state.secondOpen = null;
    state.lock = false;
  }, 720);
}

function finishWin() {
  stopGame("победа");

  const rec = loadRecords();
  const newRec = {
    bestTime: rec.bestTime == null ? state.timeLeft : Math.max(rec.bestTime, state.timeLeft),
    bestMoves: rec.bestMoves == null ? state.moves : Math.min(rec.bestMoves, state.moves),
    wins: (rec.wins || 0) + 1
  };

  saveRecords(newRec);
  updateRecordUI();
  setFeedback(`Победа! Тема «${getTheme().name}» пройдена за ${state.moves} ходов. Осталось ${state.timeLeft} сек.`, false);
  showRoundFragmentReward(2);
}

function finishLose() {
  stopGame("время вышло");
  setFeedback("Время вышло. Нажми «Рестарт темы» и попробуй снова.", true);
  showRoundFragmentReward(2);
}

function tick() {
  if (!state.running) {
    return;
  }

  state.timeLeft -= 1;
  updateHud();

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    updateHud();
    finishLose();
  }
}

function prepareDeck() {
  const pairs = getTheme().pairs;
  let uid = 0;

  const cards = pairs.flatMap((pair) => [
    { uid: `c${uid += 1}`, pairId: pair.id, text: pair.a },
    { uid: `c${uid += 1}`, pairId: pair.id, text: pair.b }
  ]);

  state.cards = shuffle(cards);
}

function startGame(resetFeedback = true) {
  stopGame("подготовка");

  state.firstOpen = null;
  state.secondOpen = null;
  state.lock = false;
  state.moves = 0;
  state.matched = 0;
  state.timeLeft = TOTAL_TIME;

  prepareDeck();
  renderBoard();
  updateHud();
  updateRecordUI();

  state.running = true;
  setStatus("в процессе");
  state.timerId = setInterval(tick, 1000);

  if (resetFeedback) {
    setFeedback(`Тема: ${getTheme().name}. Найди пары до окончания таймера.`, false);
  }
}

function switchTheme(themeId) {
  if (!THEMES[themeId]) {
    return;
  }
  state.themeId = themeId;
  startGame(true);
}

themeEl.addEventListener("change", (e) => {
  switchTheme(e.target.value);
});

startBtn.addEventListener("click", () => {
  startGame(true);
});

restartBtn.addEventListener("click", () => {
  startGame(false);
  setFeedback(`Тема «${getTheme().name}» перезапущена.`, false);
});

window.addEventListener("beforeunload", () => {
  clearTimer();
});

updateRecordUI();
updateHud();
setStatus("готов");
setFeedback("Выбери тему и нажми «Новая игра».", false);
prepareDeck();
renderBoard();
