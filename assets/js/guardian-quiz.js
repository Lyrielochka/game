import { byId } from "./modules/utils.js";
import { showRoundFragmentReward } from "./modules/fragment-reward.js";

const STORAGE_KEY_PREFIX = "pro_guardian_quiz_";

const DIFFICULTIES = {
  easy: {
    name: "Легко",
    questionCount: 8,
    timeLimit: 95,
    baseScore: 90,
    comboBonus: 12
  },
  normal: {
    name: "Нормально",
    questionCount: 10,
    timeLimit: 85,
    baseScore: 120,
    comboBonus: 18
  },
  hard: {
    name: "Сложно",
    questionCount: 12,
    timeLimit: 75,
    baseScore: 160,
    comboBonus: 24
  }
};

const QUESTION_BANK = {
  easy: [
    {
      q: "Столица Республики Беларусь:",
      options: ["Гродно", "Минск", "Витебск", "Брест"],
      answer: "Минск"
    },
    {
      q: "Какой праздник отмечается в Беларуси 3 июля?",
      options: ["День Конституции", "День Победы", "День Независимости", "День города Минска"],
      answer: "День Независимости"
    },
    {
      q: "В каком году Беларусь стала независимым государством?",
      options: ["1986", "1991", "1995", "2001"],
      answer: "1991"
    },
    {
      q: "Франциск Скорина известен как:",
      options: ["Полководец", "Первопечатник", "Космонавт", "Композитор"],
      answer: "Первопечатник"
    },
    {
      q: "В каком городе находится Брестская крепость?",
      options: ["Брест", "Могилев", "Полоцк", "Гомель"],
      answer: "Брест"
    },
    {
      q: "Основной закон государства называется:",
      options: ["Указ", "Кодекс", "Конституция", "Хартия"],
      answer: "Конституция"
    },
    {
      q: "Официальный музыкальный символ страны:",
      options: ["Марш", "Гимн", "Ода", "Фанфара"],
      answer: "Гимн"
    },
    {
      q: "Беларусь является государством-учредителем:",
      options: ["ООН", "НАТО", "ЕС", "ОПЕК"],
      answer: "ООН"
    },
    {
      q: "Мирский замок включен в список:",
      options: ["ЮНЕСКО", "Нобелевского фонда", "ФИФА", "МОК"],
      answer: "ЮНЕСКО"
    },
    {
      q: "Мемориал «Хатынь» посвящен памяти:",
      options: ["Первопечатников", "Жертв войны", "Полярников", "Спортсменов"],
      answer: "Жертв войны"
    },
    {
      q: "Какие языки имеют статус государственных в Беларуси?",
      options: ["Белорусский и русский", "Только белорусский", "Русский и польский", "Белорусский и английский"],
      answer: "Белорусский и русский"
    },
    {
      q: "Как называется древний лесной массив в Беларуси?",
      options: ["Полесье", "Беловежская пуща", "Силичи", "Березинский бор"],
      answer: "Беловежская пуща"
    }
  ],
  normal: [
    {
      q: "В каком году Франциск Скорина издал первую книгу в Праге?",
      options: ["1492", "1517", "1588", "1612"],
      answer: "1517"
    },
    {
      q: "Освобождение Минска в ходе операции «Багратион» произошло в:",
      options: ["1941", "1943", "1944", "1945"],
      answer: "1944"
    },
    {
      q: "Действующая Конституция Республики Беларусь принята в:",
      options: ["1991", "1993", "1994", "1999"],
      answer: "1994"
    },
    {
      q: "Современные государственные символы закреплены по итогам референдума:",
      options: ["1991", "1995", "2000", "2005"],
      answer: "1995"
    },
    {
      q: "День Конституции в Беларуси отмечается:",
      options: ["15 марта", "9 мая", "3 июля", "7 ноября"],
      answer: "15 марта"
    },
    {
      q: "Софийский собор в Беларуси находится в городе:",
      options: ["Полоцк", "Гродно", "Брест", "Лида"],
      answer: "Полоцк"
    },
    {
      q: "Дворцово-парковый комплекс Радзивиллов расположен в:",
      options: ["Мире", "Нарочи", "Несвиже", "Турове"],
      answer: "Несвиже"
    },
    {
      q: "Классик белорусской литературы, автор «А хто там iдзе?»",
      options: ["Янка Купала", "Якуб Колас", "Максим Богданович", "Петрусь Бровка"],
      answer: "Янка Купала"
    },
    {
      q: "Какая река протекает через Минск?",
      options: ["Неман", "Западная Двина", "Свислочь", "Припять"],
      answer: "Свислочь"
    },
    {
      q: "Национальная библиотека Беларуси находится в:",
      options: ["Могилеве", "Гродно", "Минске", "Витебске"],
      answer: "Минске"
    },
    {
      q: "Белорусская Народная Республика была провозглашена в:",
      options: ["1917", "1918", "1919", "1920"],
      answer: "1918"
    },
    {
      q: "Образование БССР относится к году:",
      options: ["1918", "1919", "1924", "1939"],
      answer: "1919"
    }
  ],
  hard: [
    {
      q: "Первое летописное упоминание Минска относится к году:",
      options: ["980", "1067", "1158", "1242"],
      answer: "1067"
    },
    {
      q: "Последняя редакция Статута ВКЛ была принята в:",
      options: ["1529", "1566", "1588", "1648"],
      answer: "1588"
    },
    {
      q: "Евфросиния Полоцкая в истории Беларуси известна как:",
      options: ["Просветительница и святая", "Полководец", "Архитектор", "Первая космонавтка"],
      answer: "Просветительница и святая"
    },
    {
      q: "Беларусь (БССР) стала государством-учредителем ООН в:",
      options: ["1944", "1945", "1948", "1951"],
      answer: "1945"
    },
    {
      q: "Международный фестиваль «Славянский базар» проходит в:",
      options: ["Бресте", "Витебске", "Минске", "Гомеле"],
      answer: "Витебске"
    },
    {
      q: "Беловежские соглашения 1991 года были подписаны в резиденции:",
      options: ["Заславль", "Мир", "Вискули", "Несвиж"],
      answer: "Вискули"
    },
    {
      q: "Главной опорой государственности на белорусских землях в средневековье было:",
      options: ["Римская империя", "Великое княжество Литовское", "Османская империя", "Византия"],
      answer: "Великое княжество Литовское"
    },
    {
      q: "К какому событию относится дата 25 марта 1918 года?",
      options: ["Принятие Конституции", "Освобождение Минска", "Провозглашение БНР", "Образование БССР"],
      answer: "Провозглашение БНР"
    },
    {
      q: "Какие цвета являются основными на государственном флаге Беларуси?",
      options: ["Синий и желтый", "Красный и зеленый", "Белый и синий", "Красный и черный"],
      answer: "Красный и зеленый"
    },
    {
      q: "Западная Двина протекает через белорусский город:",
      options: ["Пинск", "Лида", "Витебск", "Бобруйск"],
      answer: "Витебск"
    },
    {
      q: "Операция «Багратион» проводилась в период Великой Отечественной войны в:",
      options: ["1942", "1943", "1944", "1945"],
      answer: "1944"
    },
    {
      q: "После принятия Конституции 1994 года в Беларуси была введена должность:",
      options: ["Канцлера", "Президента", "Императора", "Губернатора страны"],
      answer: "Президента"
    },
    {
      q: "Какой комплекс связан с родом Радзивиллов и включен в список ЮНЕСКО?",
      options: ["Полоцкий замок", "Несвижский дворцово-парковый комплекс", "Лидский замок", "Коссовский дворец"],
      answer: "Несвижский дворцово-парковый комплекс"
    },
    {
      q: "День народного единства в Беларуси отмечается:",
      options: ["17 сентября", "1 января", "9 мая", "25 декабря"],
      answer: "17 сентября"
    }
  ]
};

const startBtn = byId("guardianStart");
const restartBtn = byId("guardianRestart");
const difficultyEl = byId("guardianDifficulty");
const seriesEl = byId("guardianSeries");
const timerEl = byId("guardianTimer");
const comboEl = byId("guardianCombo");
const statusEl = byId("guardianStatus");
const titleEl = byId("guardianQuestionTitle");
const questionEl = byId("guardianQuestion");
const optionsEl = byId("guardianOptions");
const scoreEl = byId("guardianScore");
const correctEl = byId("guardianCorrect");
const bestScoreEl = byId("guardianBestScore");
const bestComboEl = byId("guardianBestCombo");
const winsEl = byId("guardianWins");
const progressFillEl = byId("guardianProgressFill");
const feedbackEl = byId("guardianFeedback");

if (
  !startBtn ||
  !restartBtn ||
  !difficultyEl ||
  !seriesEl ||
  !timerEl ||
  !comboEl ||
  !statusEl ||
  !titleEl ||
  !questionEl ||
  !optionsEl ||
  !scoreEl ||
  !correctEl ||
  !bestScoreEl ||
  !bestComboEl ||
  !winsEl ||
  !progressFillEl ||
  !feedbackEl
) {
  throw new Error("Guardian mode: required DOM nodes not found");
}

const state = {
  difficultyId: difficultyEl.value || "normal",
  running: false,
  timerId: 0,
  nextQuestionTimeoutId: 0,
  questions: [],
  index: 0,
  answered: 0,
  score: 0,
  correct: 0,
  combo: 0,
  maxCombo: 0,
  timeLeft: 0,
  locked: false
};

function setFeedback(text, bad = false) {
  feedbackEl.textContent = text;
  feedbackEl.classList.toggle("bad", Boolean(bad));
}

function setStatus(text) {
  statusEl.textContent = `Статус: ${text}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getDifficulty() {
  return DIFFICULTIES[state.difficultyId] || DIFFICULTIES.normal;
}

function getRecordKey() {
  return `${STORAGE_KEY_PREFIX}${state.difficultyId}`;
}

function loadRecord() {
  const raw = localStorage.getItem(getRecordKey());
  if (!raw) {
    return { bestScore: 0, bestCombo: 0, wins: 0, plays: 0 };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      bestScore: Number.isFinite(parsed.bestScore) ? parsed.bestScore : 0,
      bestCombo: Number.isFinite(parsed.bestCombo) ? parsed.bestCombo : 0,
      wins: Number.isFinite(parsed.wins) ? parsed.wins : 0,
      plays: Number.isFinite(parsed.plays) ? parsed.plays : 0
    };
  } catch {
    return { bestScore: 0, bestCombo: 0, wins: 0, plays: 0 };
  }
}

function saveRecord(record) {
  localStorage.setItem(getRecordKey(), JSON.stringify(record));
}

function updateRecordUI() {
  const record = loadRecord();
  bestScoreEl.textContent = String(record.bestScore);
  bestComboEl.textContent = String(record.bestCombo);
  winsEl.textContent = String(record.wins);
}

function updateScoreUI() {
  scoreEl.textContent = String(state.score);
  correctEl.textContent = String(state.correct);
}

function updateProgressUI() {
  const total = Math.max(1, state.questions.length);
  const ratio = Math.max(0, Math.min(1, state.answered / total));
  progressFillEl.style.width = `${(ratio * 100).toFixed(2)}%`;
}

function updateHud() {
  const total = state.questions.length;
  const current = total === 0 ? 0 : Math.min(state.index + 1, total);
  seriesEl.textContent = `Серия: ${current} / ${total}`;
  timerEl.textContent = `Время: ${state.timeLeft}`;
  comboEl.textContent = `Комбо: x${state.combo} (макс x${state.maxCombo})`;
}

function clearRoundTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = 0;
  }
}

function clearNextQuestionTimeout() {
  if (state.nextQuestionTimeoutId) {
    clearTimeout(state.nextQuestionTimeoutId);
    state.nextQuestionTimeoutId = 0;
  }
}

function buildRoundQuestions() {
  const pool = QUESTION_BANK[state.difficultyId] || QUESTION_BANK.normal;
  const count = Math.min(pool.length, getDifficulty().questionCount);
  state.questions = shuffle(pool).slice(0, count).map((item) => ({
    ...item,
    options: shuffle(item.options)
  }));
}

function disableAnswerButtons() {
  optionsEl.querySelectorAll(".guardian-option").forEach((btn) => {
    btn.disabled = true;
    btn.classList.add("locked");
  });
}

function finishRound(completedSeries) {
  if (!state.running) {
    return;
  }

  state.running = false;
  state.locked = true;
  clearRoundTimer();
  clearNextQuestionTimeout();

  const record = loadRecord();
  const newRecord = {
    bestScore: Math.max(record.bestScore, state.score),
    bestCombo: Math.max(record.bestCombo, state.maxCombo),
    wins: record.wins + (completedSeries ? 1 : 0),
    plays: record.plays + 1
  };

  saveRecord(newRecord);
  updateRecordUI();
  updateHud();
  updateScoreUI();
  updateProgressUI();

  if (completedSeries) {
    setStatus("раунд завершен");
    setFeedback(
      `Раунд завершен: ${state.correct}/${state.questions.length} верно, счет ${state.score}, макс. комбо x${state.maxCombo}.`,
      false
    );
    showRoundFragmentReward(3);
    return;
  }

  setStatus("время вышло");
  setFeedback(
    `Время вышло: ${state.correct}/${state.answered} верно, счет ${state.score}. Нажми «Рестарт» для новой серии.`,
    true
  );
  showRoundFragmentReward(3);
}

function renderQuestion() {
  if (!state.questions.length) {
    titleEl.textContent = "Нет вопросов";
    questionEl.textContent = "Вопросы для этой сложности не найдены.";
    optionsEl.innerHTML = "";
    return;
  }

  if (state.index >= state.questions.length) {
    finishRound(true);
    return;
  }

  const question = state.questions[state.index];
  titleEl.textContent = `Вопрос ${state.index + 1} из ${state.questions.length}`;
  questionEl.textContent = question.q;
  optionsEl.innerHTML = question.options
    .map((option) => `<button type="button" class="guardian-option" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`)
    .join("");

  optionsEl.querySelectorAll(".guardian-option").forEach((button) => {
    button.addEventListener("click", () => handleAnswer(button));
  });
}

function handleAnswer(button) {
  if (!state.running || state.locked) {
    return;
  }

  const question = state.questions[state.index];
  if (!question) {
    return;
  }

  state.locked = true;
  state.answered += 1;

  const selected = button.dataset.answer || "";
  const isCorrect = selected === question.answer;

  optionsEl.querySelectorAll(".guardian-option").forEach((node) => {
    const value = node.dataset.answer || "";
    if (value === question.answer) {
      node.classList.add("correct");
    }
    if (node === button && !isCorrect) {
      node.classList.add("wrong");
    }
  });
  disableAnswerButtons();

  if (isCorrect) {
    const diff = getDifficulty();
    state.correct += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const gained = diff.baseScore + (state.combo - 1) * diff.comboBonus;
    state.score += gained;
    setFeedback(`Верно! +${gained} очков. Серия x${state.combo}.`, false);
  } else {
    state.combo = 0;
    setFeedback(`Неверно. Правильный ответ: ${question.answer}`, true);
  }

  updateHud();
  updateScoreUI();
  updateProgressUI();

  state.nextQuestionTimeoutId = setTimeout(() => {
    state.nextQuestionTimeoutId = 0;
    if (!state.running) {
      return;
    }
    state.index += 1;
    state.locked = false;
    renderQuestion();
    updateHud();
  }, 680);
}

function tickTimer() {
  if (!state.running) {
    return;
  }

  state.timeLeft -= 1;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    updateHud();
    finishRound(false);
    return;
  }
  updateHud();
}

function resetRoundState() {
  state.running = false;
  state.locked = false;
  state.index = 0;
  state.answered = 0;
  state.score = 0;
  state.correct = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.timeLeft = getDifficulty().timeLimit;
}

function startRound() {
  clearRoundTimer();
  clearNextQuestionTimeout();
  resetRoundState();
  buildRoundQuestions();

  if (!state.questions.length) {
    setStatus("ошибка");
    setFeedback("Не удалось сформировать серию вопросов для выбранной сложности.", true);
    return;
  }

  state.running = true;
  setStatus("в процессе");
  state.timerId = setInterval(tickTimer, 1000);

  updateHud();
  updateScoreUI();
  updateProgressUI();
  renderQuestion();
  setFeedback(
    `Сложность «${getDifficulty().name}»: ${state.questions.length} вопросов, ${state.timeLeft} секунд.`,
    false
  );
}

difficultyEl.addEventListener("change", (event) => {
  state.difficultyId = event.target.value;
  updateRecordUI();

  if (state.running) {
    startRound();
    return;
  }

  resetRoundState();
  updateHud();
  updateScoreUI();
  updateProgressUI();
  setStatus("готов");
  setFeedback(`Выбрана сложность «${getDifficulty().name}». Нажми «Старт раунда».`, false);
});

startBtn.addEventListener("click", () => {
  startRound();
});

restartBtn.addEventListener("click", () => {
  startRound();
});

window.addEventListener("beforeunload", () => {
  clearRoundTimer();
  clearNextQuestionTimeout();
});

resetRoundState();
updateHud();
updateScoreUI();
updateProgressUI();
updateRecordUI();
setStatus("готов");
setFeedback("Выбери сложность и нажми «Старт раунда».", false);
