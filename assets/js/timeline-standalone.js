import { byId } from "./modules/utils.js";

import { showRoundFragmentReward } from "./modules/fragment-reward.js";
const BEST_KEY = "pro_timeline_motion_best";
const ROUND_DURATION_MS = 45000;

const SAMPLE_W = 220;
const SAMPLE_H = 160;

// Color profile for a blue/cyan pen body or cap.
const PEN_MIN_SAT = 40;
const PEN_MIN_VAL = 32;
const PEN_MIN_PIXELS = 26;
const PEN_MAX_PIXELS = 6500;

const canvas = byId("timelineCanvas");
const video = byId("timelineVideo");
const scoreEl = byId("timelineScore");
const timeEl = byId("timelineTime");
const stateEl = byId("timelineState");
const roundEl = byId("timelineRound");
const bestEl = byId("timelineBest");
const missedEl = byId("timelineMissed");
const feedbackEl = byId("timelineFeedback");
const startBtn = byId("timelineStart");
const restartBtn = byId("timelineRestart");

if (!canvas || !video || !startBtn || !restartBtn) {
  throw new Error("Timeline mode: required DOM nodes not found");
}

const ctx = canvas.getContext("2d");
const sampleCanvas = document.createElement("canvas");
sampleCanvas.width = SAMPLE_W;
sampleCanvas.height = SAMPLE_H;
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

const YEARS = ["1945", "1961", "1991", "2000", "2010", "2024", "2026"];
const COLORS = ["#ff8f6b", "#ffcb78", "#79d9ff", "#b2ff8f", "#d4a6ff", "#ffd66d"];

const state = {
  running: false,
  score: 0,
  popped: 0,
  missed: 0,
  timeLeftMs: ROUND_DURATION_MS,
  best: Number(localStorage.getItem(BEST_KEY) || "0"),
  startTs: 0,
  lastTs: 0,
  lastSpawnTs: 0,
  spawnEvery: 740,
  balloons: [],
  bursts: [],
  rafId: 0,
  stream: null,
  pointer: {
    active: false,
    x: canvas.width / 2,
    y: canvas.height / 2,
    strength: 0,
    lastSeenTs: 0
  }
};

function setFeedback(text, bad = false) {
  feedbackEl.textContent = text;
  feedbackEl.classList.toggle("bad", Boolean(bad));
}

function setStatus(text) {
  stateEl.textContent = `Статус: ${text}`;
}

function updateHud() {
  scoreEl.textContent = `Шары: ${state.score}`;
  timeEl.textContent = `Время: ${Math.max(0, Math.ceil(state.timeLeftMs / 1000))}`;
  roundEl.textContent = String(state.popped);
  bestEl.textContent = String(state.best);
  missedEl.textContent = String(state.missed);
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#153c59");
  bg.addColorStop(1, "#0a2233");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lineShift = Math.floor((performance.now() * 0.08) % 54);
  for (let x = -54 + lineShift; x < canvas.width + 54; x += 54) {
    ctx.fillStyle = "rgba(218, 241, 255, 0.08)";
    ctx.fillRect(x, 36, 28, 3);
    ctx.fillRect(x + 16, 80, 24, 3);
  }
}

function drawIdleScene() {
  drawBackground();

  ctx.fillStyle = "rgba(206, 236, 255, 0.92)";
  ctx.font = '700 28px "Tektur", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("Нажми «Старт раунда»", canvas.width / 2, canvas.height / 2 - 8);

  ctx.fillStyle = "rgba(164, 202, 228, 0.9)";
  ctx.font = '500 18px "Exo 2", sans-serif';
  ctx.fillText("Наводи синюю/бирюзовую ручку на шарики", canvas.width / 2, canvas.height / 2 + 26);
}

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  return { h, s, v };
}

function isPenColor(h, s, v) {
  if (s < PEN_MIN_SAT || v < PEN_MIN_VAL) {
    return false;
  }

  // Blue/cyan range.
  return h >= 165 && h <= 255;
}

async function ensureCamera() {
  if (state.stream) {
    return true;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setFeedback("Браузер не поддерживает доступ к веб-камере.", true);
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      }
    });

    state.stream = stream;
    video.srcObject = stream;

    if (video.readyState < 2) {
      await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
    }

    await video.play().catch(() => {});
    setFeedback("Камера включена. Наводи синюю/бирюзовую ручку на шарики.", false);
    return true;
  } catch (error) {
    setFeedback("Не удалось получить доступ к камере. Проверь разрешения браузера.", true);
    return false;
  }
}

function resetRoundData() {
  state.score = 0;
  state.popped = 0;
  state.missed = 0;
  state.timeLeftMs = ROUND_DURATION_MS;
  state.balloons = [];
  state.bursts = [];
  state.pointer.active = false;
  state.pointer.strength = 0;
}

function spawnBalloon(now) {
  const r = 26 + Math.random() * 26;
  const x = r + Math.random() * (canvas.width - r * 2);
  const speed = 0.95 + Math.random() * 1.1;
  const drift = 0.22 + Math.random() * 0.45;

  state.balloons.push({
    x,
    y: canvas.height + r + 10,
    r,
    speed,
    drift,
    phase: Math.random() * 1000,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    year: YEARS[Math.floor(Math.random() * YEARS.length)]
  });

  state.lastSpawnTs = now;
  state.spawnEvery = 620 + Math.random() * 330;
}

function updatePointerFromPen(now) {
  if (!state.stream || video.readyState < 2) {
    state.pointer.active = false;
    return;
  }

  sampleCtx.save();
  sampleCtx.scale(-1, 1);
  sampleCtx.drawImage(video, -SAMPLE_W, 0, SAMPLE_W, SAMPLE_H);
  sampleCtx.restore();

  const frame = sampleCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumW = 0;

  for (let y = 0; y < SAMPLE_H; y += 1) {
    for (let x = 0; x < SAMPLE_W; x += 1) {
      const i = (y * SAMPLE_W + x) * 4;
      const r = frame[i];
      const g = frame[i + 1];
      const b = frame[i + 2];
      const { h, s, v } = rgbToHsv(r, g, b);

      if (!isPenColor(h, s, v)) {
        continue;
      }

      // Weight high-saturation/high-value pixels stronger.
      const w = 1 + s * 0.08 + v * 0.04;
      count += 1;
      sumX += x * w;
      sumY += y * w;
      sumW += w;
    }
  }

  if (count < PEN_MIN_PIXELS || count > PEN_MAX_PIXELS || sumW <= 0) {
    if (now - state.pointer.lastSeenTs > 350) {
      state.pointer.active = false;
      state.pointer.strength = 0;
    }
    return;
  }

  const avgX = sumX / sumW;
  const avgY = sumY / sumW;
  const targetX = (avgX / SAMPLE_W) * canvas.width;
  const targetY = (avgY / SAMPLE_H) * canvas.height;

  state.pointer.active = true;
  state.pointer.lastSeenTs = now;
  state.pointer.strength = Math.min(1, count / 800);
  state.pointer.x = state.pointer.x * 0.7 + targetX * 0.3;
  state.pointer.y = state.pointer.y * 0.7 + targetY * 0.3;
}

function popBalloon(balloon, index) {
  state.score += 1;
  state.popped += 1;
  state.balloons.splice(index, 1);
  state.bursts.push({ x: balloon.x, y: balloon.y, r: balloon.r * 0.65, life: 1, color: balloon.color });
}

function updateBalloons(delta, now) {
  const hitRadius = 18 + state.pointer.strength * 8;

  for (let i = state.balloons.length - 1; i >= 0; i -= 1) {
    const balloon = state.balloons[i];
    balloon.y -= balloon.speed * delta;
    balloon.x += Math.sin((now + balloon.phase) / 520) * balloon.drift * delta;

    if (state.pointer.active) {
      const dx = state.pointer.x - balloon.x;
      const dy = state.pointer.y - balloon.y;
      if (dx * dx + dy * dy <= (balloon.r + hitRadius) * (balloon.r + hitRadius)) {
        popBalloon(balloon, i);
        continue;
      }
    }

    if (balloon.y + balloon.r < -12) {
      state.balloons.splice(i, 1);
      state.missed += 1;
    }
  }
}

function updateBursts(delta) {
  for (let i = state.bursts.length - 1; i >= 0; i -= 1) {
    const burst = state.bursts[i];
    burst.life -= 0.04 * delta;
    burst.r += 0.9 * delta;
    if (burst.life <= 0) {
      state.bursts.splice(i, 1);
    }
  }
}

function drawBalloon(balloon) {
  const gradient = ctx.createRadialGradient(
    balloon.x - balloon.r * 0.28,
    balloon.y - balloon.r * 0.34,
    balloon.r * 0.15,
    balloon.x,
    balloon.y,
    balloon.r
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.75)");
  gradient.addColorStop(1, balloon.color);

  ctx.beginPath();
  ctx.arc(balloon.x, balloon.y, balloon.r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(27, 25, 21, 0.76)";
  ctx.font = '700 15px "Tektur", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(balloon.year, balloon.x, balloon.y + 5);
}

function drawBurst(burst) {
  const alpha = Math.max(0, burst.life);
  ctx.beginPath();
  ctx.arc(burst.x, burst.y, burst.r, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 229, 196, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawPointer() {
  if (!state.pointer.active) {
    ctx.fillStyle = "rgba(196, 221, 241, 0.86)";
    ctx.font = '600 18px "Exo 2", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("Покажи синюю/бирюзовую ручку в окне камеры", canvas.width / 2, canvas.height - 24);
    return;
  }

  const markerR = 15 + state.pointer.strength * 8;

  ctx.beginPath();
  ctx.arc(state.pointer.x, state.pointer.y, markerR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(131, 255, 212, 0.95)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(state.pointer.x, state.pointer.y, markerR * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(205, 255, 238, 0.92)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawScene() {
  drawBackground();

  for (let i = 0; i < state.balloons.length; i += 1) {
    drawBalloon(state.balloons[i]);
  }

  for (let i = 0; i < state.bursts.length; i += 1) {
    drawBurst(state.bursts[i]);
  }

  drawPointer();
}

function finishRound() {
  state.running = false;
  cancelAnimationFrame(state.rafId);

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(state.best));
  }

  setStatus("раунд завершен");
  setFeedback(`Раунд завершен: ${state.score} шаров. Пропущено: ${state.missed}.`, false);
  updateHud();
  showRoundFragmentReward(5);
}

function gameLoop(now) {
  if (!state.running) {
    return;
  }

  const delta = Math.min(2.5, Math.max(0.6, (now - state.lastTs) / 16.67));
  state.lastTs = now;

  const elapsed = now - state.startTs;
  const leftMs = ROUND_DURATION_MS - elapsed;
  state.timeLeftMs = Math.max(0, leftMs);

  updatePointerFromPen(now);

  if (now - state.lastSpawnTs >= state.spawnEvery) {
    spawnBalloon(now);
  }

  updateBalloons(delta, now);
  updateBursts(delta);
  drawScene();
  updateHud();

  if (leftMs <= 0) {
    finishRound();
    return;
  }

  state.rafId = requestAnimationFrame(gameLoop);
}

async function startRound() {
  const ready = await ensureCamera();
  if (!ready) {
    return;
  }

  resetRoundData();
  state.running = true;
  state.startTs = performance.now();
  state.lastTs = state.startTs;
  state.lastSpawnTs = state.startTs;
  state.spawnEvery = 610 + Math.random() * 250;

  setStatus("в процессе");
  setFeedback("Наводи синюю/бирюзовую ручку на шарики и лопай их.", false);
  updateHud();

  cancelAnimationFrame(state.rafId);
  state.rafId = requestAnimationFrame(gameLoop);
}

function stopRound(status = "готов") {
  state.running = false;
  cancelAnimationFrame(state.rafId);
  setStatus(status);
  updateHud();
}

function cleanupCamera() {
  if (!state.stream) {
    return;
  }

  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
}

startBtn.addEventListener("click", () => {
  startRound();
});

restartBtn.addEventListener("click", () => {
  stopRound("перезапуск");
  startRound();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.running) {
    stopRound("пауза");
    setFeedback("Раунд на паузе: вернись во вкладку и нажми «Старт раунда».", false);
  }
});

window.addEventListener("beforeunload", () => {
  stopRound("остановлен");
  cleanupCamera();
});

setStatus("готов");
setFeedback("Нажми «Старт раунда», разреши камеру и используй синюю или бирюзовую ручку.", false);
updateHud();
drawIdleScene();
