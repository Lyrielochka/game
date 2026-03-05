import { DASH_GOAL } from "./modules/data.js";
import { byId } from "./modules/utils.js";
import { showRoundFragmentReward } from "./modules/fragment-reward.js";
import { RhythmRushGame } from "./modules/rhythm-rush.js";

const BEST_SCORE_KEY = "pro_dash_solo_best_score";

let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY) || "0");
let lastScore = 0;
const levelSelect = byId("soloDashLevel");

function getLevelMode() {
  if (!levelSelect) {
    return "classic";
  }
  if (levelSelect.value === "upper") {
    return "upper";
  }
  if (levelSelect.value === "rift") {
    return "rift";
  }
  return "classic";
}

function getLevelLabel() {
  const mode = getLevelMode();
  if (mode === "upper") {
    return "Уровень 2: вверх";
  }
  if (mode === "rift") {
    return "Уровень 3: разлом";
  }
  return "Уровень 1: классика";
}

function updateSoloStats(runs) {
  byId("soloRuns").textContent = String(runs);
  byId("soloLastScore").textContent = String(lastScore);
  byId("soloBestScore").textContent = String(bestScore);
}

const soloRush = new RhythmRushGame({
  canvasId: "soloDashCanvas",
  infoId: "soloDashInfo",
  bestId: "soloDashBest",
  statusId: "soloDashStatus",
  boostId: "soloDashBoost",
  feedbackId: "soloFeedback",
  musicSrc: "./музыка/музыка для деша.mp3",
  musicVolume: 0.45,
  level1BgSrc: "./прорыв/фон 1 уровень.png",
  playerSpriteSrc: "./прорыв/optimized/книга_opt.png",
  obstacleBlockSrc: "./прорыв/optimized/квадрат_opt.png",
  obstacleSpikeSrc: "./прорыв/optimized/треугольник_opt.png",
  obstacleSpriteScale: 1.35,
  playerSpriteScale: 2.8,
  goal: DASH_GOAL,
  suppressDefaultFinishDialog: true,
  getLevelMode,
  onRunStart: (runs) => {
    updateSoloStats(runs);
    soloRush.setFeedback(`${getLevelLabel()}. Собирай сферы импульса и разгоняйся в овердрайв.`, false);
  },
  onFinish: ({ runs, pickups, overdrives, levelMode }) => {
    const levelBonus = levelMode === "rift" ? 28 : levelMode === "upper" ? 14 : 0;
    const points = Math.max(80, 120 - (runs - 1) * 12 + (pickups || 0) * 3 + (overdrives || 0) * 18 + levelBonus);
    lastScore = points;
    bestScore = Math.max(bestScore, points);
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));

    updateSoloStats(runs);
    soloRush.setFeedback(`Финиш! +${points} очков • сфер: ${pickups || 0} • овердрайв: ${overdrives || 0}.`, false);
    showRoundFragmentReward(4);
  }
});

window.__proDashSolo = soloRush;

byId("startDashSolo").addEventListener("click", () => {
  soloRush.start();
});

byId("retryDashSolo").addEventListener("click", () => {
  soloRush.retry();
  updateSoloStats(soloRush.runs);
});

if (levelSelect) {
  levelSelect.addEventListener("change", () => {
    if (soloRush.running) {
      soloRush.setFeedback(`Выбран ${getLevelLabel()}. Применится после рестарта.`, false);
      return;
    }
    soloRush.retry(`Выбран ${getLevelLabel()}. Нажми «Старт забега».`);
  });
}

updateSoloStats(0);
soloRush.init();
