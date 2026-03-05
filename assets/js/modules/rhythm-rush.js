import { byId } from "./utils.js";

export class RhythmRushGame {
  constructor(options) {
    this.options = options;
    this.goal = options.goal;

    this.canvas = null;
    this.ctx = null;
    this.infoEl = null;
    this.bestEl = null;
    this.statusEl = null;
    this.boostEl = null;
    this.feedbackEl = null;
    this.music = null;
    this.level1BgImage = null;
    this.playerSpriteImage = null;
    this.obstacleBlockImage = null;
    this.obstacleSpikeImage = null;
    this.activeDialog = null;
    this.uiLocked = false;

    this.running = false;
    this.playerX = 120;
    this.playerY = 0;
    this.playerSize = 30;
    this.playerSpriteScale = typeof options.playerSpriteScale === "number" ? options.playerSpriteScale : 1;
    this.obstacleSpriteScale = typeof options.obstacleSpriteScale === "number" ? options.obstacleSpriteScale : 1.28;
    this.vy = 0;
    this.gravity = 0.54;
    this.jumpPower = -11.4;
    this.maxJumps = 2;
    this.jumpsUsed = 0;
    this.groundY = 184;
    this.ceilingY = 18;
    this.levelMode = "classic";
    this.distance = 0;
    this.baseSpeed = 4.1;
    this.maxSpeed = 6.5;
    this.speedRamp = 0.0019;
    this.speed = this.baseSpeed;
    this.obstacles = [];
    this.spawnIn = 170;
    this.pickupSpawnIn = 240;
    this.trailParticles = [];
    this.pickups = [];
    this.jumpFlash = 0;
    this.collisions = 0;
    this.pulseCharge = 0;
    this.overdriveTime = 0;
    this.overdriveMaxTime = 1;
    this.overdriveActivations = 0;
    this.pickupsCollected = 0;
    this.frameTick = 0;
    this.frameId = 0;
    this.best = Number(localStorage.getItem("pro_dash_best") || "0");
    this.runs = 0;

    this.boundLoop = this.loop.bind(this);
    this.boundHandleKey = this.handleKey.bind(this);
  }

  init() {
    this.canvas = byId(this.options.canvasId);
    this.infoEl = byId(this.options.infoId);
    this.bestEl = byId(this.options.bestId);
    this.statusEl = byId(this.options.statusId);
    this.boostEl = byId(this.options.boostId);
    this.feedbackEl = byId(this.options.feedbackId);

    if (!this.canvas) {
      throw new Error("RhythmRush: canvas не найден");
    }

    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.groundY = Math.floor(this.canvas.height * 0.767);
    this.ceilingY = Math.max(10, Math.floor(this.canvas.height * 0.075));
    this.setupAudio();
    this.setupImages();
    if (!document.body.classList.contains("home-page")) {
      this.ensureMusicAutoplay();
    }

    this.canvas.addEventListener("pointerdown", () => {
      if (this.uiLocked) {
        return;
      }
      if (!this.running) {
        this.start();
      } else {
        this.jump();
      }
    });

    document.addEventListener("keydown", this.boundHandleKey);

    this.resetRound();
  }

  setupAudio() {
    if (!this.options.musicSrc) {
      return;
    }

    this.music = new Audio(this.options.musicSrc);
    this.music.preload = "auto";
    this.music.loop = true;
    this.music.volume = typeof this.options.musicVolume === "number" ? this.options.musicVolume : 0.5;
  }

  setupImages() {
    this.level1BgImage = this.createImage(this.options.level1BgSrc);
    this.playerSpriteImage = this.createImage(this.options.playerSpriteSrc);
    this.obstacleBlockImage = this.createImage(this.options.obstacleBlockSrc);
    this.obstacleSpikeImage = this.createImage(this.options.obstacleSpikeSrc);
  }

  createImage(src) {
    if (!src) {
      return null;
    }

    const image = new Image();
    image.decoding = "async";
    image.src = src;
    return image;
  }

  isImageReady(image) {
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }

  closeDialog() {
    if (this.activeDialog) {
      this.activeDialog.remove();
      this.activeDialog = null;
    }
    this.uiLocked = false;
  }

  showDialog({
    title,
    text,
    confirmText = "OK",
    cancelText = "",
    kind = "normal",
    onConfirm = null,
    onCancel = null
  }) {
    this.closeDialog();
    this.uiLocked = true;

    const overlay = document.createElement("div");
    overlay.className = "rush-overlay";

    const card = document.createElement("div");
    card.className = `rush-dialog ${kind === "finish" ? "is-finish" : ""}`;

    const heading = document.createElement("h3");
    heading.textContent = title;
    card.appendChild(heading);

    const body = document.createElement("p");
    body.textContent = text;
    card.appendChild(body);

    const actions = document.createElement("div");
    actions.className = "rush-dialog-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn primary";
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener("click", () => {
      this.closeDialog();
      if (typeof onConfirm === "function") {
        onConfirm();
      }
    });
    actions.appendChild(confirmBtn);

    if (cancelText) {
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn ghost";
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener("click", () => {
        this.closeDialog();
        if (typeof onCancel === "function") {
          onCancel();
        }
      });
      actions.appendChild(cancelBtn);
    }

    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.activeDialog = overlay;

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && cancelText) {
        this.closeDialog();
        if (typeof onCancel === "function") {
          onCancel();
        }
      }
    });

    confirmBtn.focus();
  }

  playFinishAnimation() {
    const fx = document.createElement("div");
    fx.className = "rush-fx-burst";
    document.body.appendChild(fx);

    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const particleCount = 54;

    for (let i = 0; i < particleCount; i += 1) {
      const particle = document.createElement("span");
      particle.className = "rush-fx-particle";
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.35);
      const distance = 110 + Math.random() * 170;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const hue = 28 + Math.floor(Math.random() * 130);

      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.setProperty("--dx", `${dx}px`);
      particle.style.setProperty("--dy", `${dy}px`);
      particle.style.setProperty("--hue", String(hue));
      particle.style.animationDelay = `${Math.random() * 0.16}s`;
      fx.appendChild(particle);
    }

    setTimeout(() => {
      fx.remove();
    }, 1800);
  }

  drawScaledSpriteInsideBounds(ctx, image, x, y, w, h, flipY = false) {
    if (!this.isImageReady(image)) {
      return false;
    }

    const scale = this.obstacleSpriteScale;
    const drawW = w * scale;
    const drawH = h * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x + w / 2, y + h / 2);
    if (flipY) {
      ctx.scale(1, -1);
    }
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    return true;
  }

  drawObstacleSprite(ctx, obstacle) {
    if (obstacle.kind === "spike-up" || obstacle.kind === "spike-down") {
      return this.drawScaledSpriteInsideBounds(
        ctx,
        this.obstacleSpikeImage,
        obstacle.x,
        obstacle.y,
        obstacle.w,
        obstacle.h,
        obstacle.kind === "spike-down"
      );
    }

    return this.drawScaledSpriteInsideBounds(
      ctx,
      this.obstacleBlockImage,
      obstacle.x,
      obstacle.y,
      obstacle.w,
      obstacle.h
    );
  }

  playMusic() {
    if (!this.music) {
      return Promise.resolve(false);
    }

    if (!this.music.paused) {
      return Promise.resolve(true);
    }

    const playPromise = this.music.play();
    if (playPromise && typeof playPromise.then === "function") {
      return playPromise.then(() => true).catch(() => false);
    }

    return Promise.resolve(!this.music.paused);
  }

  ensureMusicAutoplay() {
    if (!this.music) {
      return;
    }

    this.playMusic().then((started) => {
      if (started) {
        return;
      }

      const unlock = () => {
        this.playMusic();
      };

      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    });
  }

  stopMusic(resetTime = false) {
    if (!this.music) {
      return;
    }

    this.music.pause();
    if (resetTime) {
      this.music.currentTime = 0;
    }
  }

  resolveLevelMode() {
    if (typeof this.options.getLevelMode === "function") {
      const mode = this.options.getLevelMode();
      if (mode === "upper" || mode === "rift") {
        return mode;
      }
      return "classic";
    }

    return this.options.levelMode === "upper" || this.options.levelMode === "rift"
      ? this.options.levelMode
      : "classic";
  }

  levelLabel() {
    if (this.levelMode === "upper") {
      return "Уровень 2: вверх";
    }
    if (this.levelMode === "rift") {
      return "Уровень 3: разлом";
    }
    return "Уровень 1: классика";
  }

  configureLevel() {
    this.levelMode = this.resolveLevelMode();
    if (this.levelMode === "upper") {
      this.baseSpeed = 3.95;
      this.maxSpeed = 6.3;
      this.speedRamp = 0.0018;
      this.jumpPower = -12;
      return;
    }

    if (this.levelMode === "rift") {
      this.baseSpeed = 4.35;
      this.maxSpeed = 7.2;
      this.speedRamp = 0.0022;
      this.jumpPower = -11.9;
      return;
    }

    this.baseSpeed = 4.1;
    this.maxSpeed = 6.5;
    this.speedRamp = 0.0019;
    this.jumpPower = -11.4;
  }

  randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  createObstacle(x, w, h, kind = "block", extra = {}) {
    let obstacle;

    if (kind === "spike" || kind === "spike-up") {
      obstacle = {
        kind: "spike-up",
        x,
        y: this.groundY - h,
        w,
        h,
        hitInsetX: Math.max(3, Math.floor(w * 0.22)),
        hitInsetTop: Math.max(8, Math.floor(h * 0.45)),
        hitInsetBottom: 2
      };
    } else if (kind === "spike-down") {
      obstacle = {
        kind,
        x,
        y: this.ceilingY,
        w,
        h,
        hitInsetX: Math.max(3, Math.floor(w * 0.22)),
        hitInsetTop: 2,
        hitInsetBottom: Math.max(8, Math.floor(h * 0.45))
      };
    } else if (kind === "ceiling-block") {
      obstacle = {
        kind,
        x,
        y: this.ceilingY,
        w,
        h,
        hitInsetX: 2,
        hitInsetTop: 2,
        hitInsetBottom: 2
      };
    } else {
      obstacle = {
        kind,
        x,
        y: this.groundY - h,
        w,
        h,
        hitInsetX: 2,
        hitInsetTop: 2,
        hitInsetBottom: 2
      };
    }

    if (typeof extra.y === "number") {
      obstacle.y = extra.y;
    }
    if (typeof extra.hitInsetX === "number") {
      obstacle.hitInsetX = extra.hitInsetX;
    }
    if (typeof extra.hitInsetTop === "number") {
      obstacle.hitInsetTop = extra.hitInsetTop;
    }
    if (typeof extra.hitInsetBottom === "number") {
      obstacle.hitInsetBottom = extra.hitInsetBottom;
    }

    obstacle.baseY = obstacle.y;
    if (typeof extra.driftAmp === "number" && extra.driftAmp > 0) {
      obstacle.driftAmp = extra.driftAmp;
      obstacle.driftSpeed = typeof extra.driftSpeed === "number" ? extra.driftSpeed : 0.044;
      obstacle.driftPhase = typeof extra.driftPhase === "number" ? extra.driftPhase : 0;
    }

    return obstacle;
  }

  spawnPattern() {
    if (this.levelMode === "rift") {
      this.spawnPatternRift();
      return;
    }
    if (this.levelMode === "upper") {
      this.spawnPatternUpper();
      return;
    }
    this.spawnPatternClassic();
  }

  spawnPatternClassic() {
    const roll = Math.random();
    const baseX = this.canvas.width + 20;

    if (roll < 0.35) {
      const w = this.randomRange(24, 40);
      const h = this.randomRange(24, 40);
      this.obstacles.push(this.createObstacle(baseX, w, h, "block"));
      this.spawnIn = this.randomRange(220, 330);
      return;
    }

    if (roll < 0.62) {
      const firstW = this.randomRange(20, 28);
      const secondW = this.randomRange(22, 30);
      const firstH = this.randomRange(20, 30);
      const secondH = this.randomRange(24, 36);
      const gap = this.randomRange(56, 78);

      this.obstacles.push(this.createObstacle(baseX, firstW, firstH, "block"));
      this.obstacles.push(this.createObstacle(baseX + firstW + gap, secondW, secondH, "block"));
      this.spawnIn = this.randomRange(260, 380);
      return;
    }

    if (roll < 0.84) {
      const count = 2 + Math.floor(Math.random() * 2);
      const spikeW = this.randomRange(18, 24);
      const spikeGap = this.randomRange(12, 18);

      for (let i = 0; i < count; i += 1) {
        const h = this.randomRange(20, 30);
        const x = baseX + i * (spikeW + spikeGap);
        this.obstacles.push(this.createObstacle(x, spikeW, h, "spike-up"));
      }

      this.spawnIn = this.randomRange(280, 410);
      return;
    }

    const stepW = this.randomRange(18, 24);
    const stepGap = this.randomRange(12, 16);
    const heights = [18, 26, 34];

    for (let i = 0; i < heights.length; i += 1) {
      const x = baseX + i * (stepW + stepGap);
      this.obstacles.push(this.createObstacle(x, stepW, heights[i], "block"));
    }

    this.spawnIn = this.randomRange(300, 430);
  }

  spawnPatternUpper() {
    const roll = Math.random();
    const baseX = this.canvas.width + 24;

    if (roll < 0.28) {
      const w = this.randomRange(26, 40);
      const h = this.randomRange(46, 78);
      this.obstacles.push(this.createObstacle(baseX, w, h, "block"));
      this.spawnIn = this.randomRange(250, 360);
      return;
    }

    if (roll < 0.55) {
      const w = this.randomRange(24, 34);
      const h = this.randomRange(40, 72);
      this.obstacles.push(this.createObstacle(baseX, w, h, "ceiling-block"));
      if (Math.random() > 0.45) {
        const secondGap = this.randomRange(56, 86);
        this.obstacles.push(this.createObstacle(baseX + w + secondGap, this.randomRange(20, 30), this.randomRange(34, 60), "ceiling-block"));
      }
      this.spawnIn = this.randomRange(270, 390);
      return;
    }

    if (roll < 0.82) {
      const bottomW = this.randomRange(24, 34);
      const topW = this.randomRange(24, 34);
      const bottomH = this.randomRange(30, 48);
      const topH = this.randomRange(28, 46);
      this.obstacles.push(this.createObstacle(baseX, bottomW, bottomH, "block"));
      this.obstacles.push(this.createObstacle(baseX + this.randomRange(20, 40), topW, topH, "ceiling-block"));
      this.spawnIn = this.randomRange(290, 430);
      return;
    }

    const spikeW = this.randomRange(18, 24);
    const spikeGap = this.randomRange(22, 30);
    const count = 3;
    for (let i = 0; i < count; i += 1) {
      const x = baseX + i * (spikeW + spikeGap);
      const h = this.randomRange(24, 34);
      const kind = i % 2 === 0 ? "spike-up" : "spike-down";
      this.obstacles.push(this.createObstacle(x, spikeW, h, kind));
    }
    this.spawnIn = this.randomRange(320, 460);
  }

  spawnPatternRift() {
    const roll = Math.random();
    const baseX = this.canvas.width + 24;

    if (roll < 0.24) {
      const bottomW = this.randomRange(24, 34);
      const bottomH = this.randomRange(28, 44);
      const topW = this.randomRange(24, 34);
      const topH = this.randomRange(28, 50);
      const topX = baseX + this.randomRange(42, 74);
      this.obstacles.push(this.createObstacle(baseX, bottomW, bottomH, "block"));
      this.obstacles.push(
        this.createObstacle(topX, topW, topH, "ceiling-block", {
          driftAmp: this.randomRange(8, 16),
          driftSpeed: this.randomRange(0.04, 0.055),
          driftPhase: Math.random() * Math.PI * 2
        })
      );
      this.spawnIn = this.randomRange(250, 350);
      return;
    }

    if (roll < 0.52) {
      const spikeW = this.randomRange(18, 24);
      const spikeGap = this.randomRange(24, 34);
      const count = 4;
      for (let i = 0; i < count; i += 1) {
        const x = baseX + i * (spikeW + spikeGap);
        const h = this.randomRange(22, 34);
        const kind = i % 2 === 0 ? "spike-up" : "spike-down";
        this.obstacles.push(this.createObstacle(x, spikeW, h, kind));
      }
      this.spawnIn = this.randomRange(300, 430);
      return;
    }

    if (roll < 0.78) {
      const w = this.randomRange(22, 30);
      const h = this.randomRange(28, 40);
      const minY = this.ceilingY + 30;
      const maxY = this.groundY - h - 24;
      const y = this.randomRange(minY, maxY);
      this.obstacles.push(
        this.createObstacle(baseX, w, h, "block", {
          y,
          driftAmp: this.randomRange(18, 32),
          driftSpeed: this.randomRange(0.032, 0.05),
          driftPhase: Math.random() * Math.PI * 2,
          hitInsetTop: 3,
          hitInsetBottom: 3
        })
      );
      if (Math.random() > 0.45) {
        this.obstacles.push(
          this.createObstacle(
            baseX + this.randomRange(86, 126),
            this.randomRange(20, 28),
            this.randomRange(22, 32),
            "spike-up"
          )
        );
      }
      this.spawnIn = this.randomRange(250, 360);
      return;
    }

    this.obstacles.push(this.createObstacle(baseX, this.randomRange(22, 30), this.randomRange(20, 30), "spike-up"));
    this.obstacles.push(
      this.createObstacle(
        baseX + this.randomRange(68, 92),
        this.randomRange(24, 34),
        this.randomRange(34, 50),
        "ceiling-block"
      )
    );
    this.obstacles.push(
      this.createObstacle(
        baseX + this.randomRange(126, 164),
        this.randomRange(22, 30),
        this.randomRange(20, 30),
        "spike-down"
      )
    );
    this.spawnIn = this.randomRange(320, 460);
  }

  schedulePickupSpawn() {
    if (this.levelMode === "rift") {
      this.pickupSpawnIn = this.randomRange(120, 210);
      return;
    }
    if (this.levelMode === "upper") {
      this.pickupSpawnIn = this.randomRange(150, 240);
      return;
    }
    this.pickupSpawnIn = this.randomRange(170, 260);
  }

  spawnPickup() {
    const x = this.canvas.width + this.randomRange(30, 60);
    const r = this.levelMode === "rift" ? 9 : 8;
    const minY = this.ceilingY + 26;
    const maxY = this.groundY - 30;
    let y = this.randomRange(minY, maxY);
    if (this.levelMode === "upper") {
      y = this.randomRange(minY + 12, maxY - 18);
    }

    this.pickups.push({
      x,
      y,
      baseY: y,
      r,
      floatAmp: this.randomRange(3, 9),
      floatSpeed: this.randomRange(0.08, 0.12),
      phase: Math.random() * Math.PI * 2
    });
    this.schedulePickupSpawn();
  }

  updatePickups() {
    this.pickupSpawnIn -= this.speed;
    if (this.pickupSpawnIn <= 0 && (this.pulseCharge < 100 || this.levelMode === "rift")) {
      this.spawnPickup();
    }

    const px = this.playerX + this.playerSize / 2;
    const py = this.playerY + this.playerSize / 2;
    const pickupRadius = this.playerSize * 0.38;

    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      pickup.x -= this.speed * 1.03;
      pickup.y = pickup.baseY + Math.sin(this.frameTick * pickup.floatSpeed + pickup.phase) * pickup.floatAmp;

      const dx = px - pickup.x;
      const dy = py - pickup.y;
      const sum = pickup.r + pickupRadius;
      if (dx * dx + dy * dy <= sum * sum) {
        this.pickups.splice(i, 1);
        this.collectPickup();
        continue;
      }

      if (pickup.x + pickup.r < -40) {
        this.pickups.splice(i, 1);
      }
    }
  }

  collectPickup() {
    this.pickupsCollected += 1;
    this.pulseCharge = Math.min(100, this.pulseCharge + (this.levelMode === "rift" ? 28 : 24));
    for (let i = 0; i < 6; i += 1) {
      this.spawnTrailParticle(1.7);
    }

    if (!this.isOverdriveActive() && this.pulseCharge >= 100) {
      this.activateOverdrive();
    }
  }

  isOverdriveActive() {
    return this.overdriveTime > 0;
  }

  activateOverdrive() {
    this.overdriveMaxTime = this.levelMode === "rift" ? 270 : 230;
    this.overdriveTime = this.overdriveMaxTime;
    this.overdriveActivations += 1;
    this.pulseCharge = 100;
    this.setFeedback("Овердрайв включен: щит активен и скорость повышена.", false);

    if (this.options.onOverdrive) {
      this.options.onOverdrive({
        runs: this.runs,
        pickups: this.pickupsCollected,
        overdrives: this.overdriveActivations
      });
    }
  }

  updateOverdrive() {
    if (!this.isOverdriveActive()) {
      return;
    }
    this.overdriveTime -= 1;
    const ratio = Math.max(0, this.overdriveTime / Math.max(1, this.overdriveMaxTime));
    this.pulseCharge = Math.round(ratio * 100);
    if (Math.random() < 0.45) {
      this.spawnTrailParticle(1.8);
    }
  }

  handleKey(event) {
    if (this.uiLocked) {
      return;
    }
    if (event.code !== "Space" && event.code !== "ArrowUp") {
      return;
    }
    if (this.options.canRun && !this.options.canRun()) {
      return;
    }

    event.preventDefault();

    if (!this.running) {
      this.start();
      return;
    }

    this.jump();
  }

  setFeedback(text, isBad = false) {
    if (!this.feedbackEl) {
      return;
    }
    this.feedbackEl.textContent = text;
    this.feedbackEl.classList.toggle("bad", Boolean(isBad));
  }

  clearFeedback() {
    this.setFeedback("", false);
  }

  updateHud(status) {
    const levelLabel = this.levelLabel();
    const speedText = this.speed.toFixed(1);
    if (this.infoEl) {
      this.infoEl.textContent = `Дистанция: ${Math.floor(this.distance)} / ${this.goal} • ${levelLabel} • Скорость: ${speedText}`;
    }
    if (this.bestEl) {
      this.bestEl.textContent = `Лучшее: ${Math.floor(this.best)}`;
    }
    if (this.boostEl) {
      if (this.isOverdriveActive()) {
        this.boostEl.textContent = `Импульс: ОВЕРДРАЙВ ${this.pulseCharge}%`;
        this.boostEl.classList.add("is-live");
      } else {
        this.boostEl.textContent = `Импульс: ${this.pulseCharge}% • Сфер: ${this.pickupsCollected}`;
        this.boostEl.classList.remove("is-live");
      }
    }
    if (status && this.statusEl) {
      this.statusEl.textContent = `Статус: ${status}`;
    }
  }

  drawScene() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const upperMode = this.levelMode === "upper";
    const riftMode = this.levelMode === "rift";
    const useLevel1Bg = !upperMode && !riftMode && this.isImageReady(this.level1BgImage);
    if (useLevel1Bg) {
      ctx.drawImage(this.level1BgImage, 0, 0, w, h);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, this.groundY);
      if (riftMode) {
        sky.addColorStop(0, "#200f33");
        sky.addColorStop(0.55, "#102547");
        sky.addColorStop(1, "#0a1932");
      } else if (upperMode) {
        sky.addColorStop(0, "#2a1b3e");
        sky.addColorStop(1, "#111e39");
      } else {
        sky.addColorStop(0, "#132f48");
        sky.addColorStop(1, "#0c2235");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, this.groundY);
    }

    const wave = this.distance * 0.01;
    ctx.strokeStyle = riftMode
      ? "rgba(255, 155, 231, 0.2)"
      : upperMode
        ? "rgba(211, 156, 255, 0.16)"
        : "rgba(137, 214, 255, 0.16)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const y = 38 + i * 24;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const yOffset = Math.sin((x * 0.02) + wave + i * 0.9) * (3 + i);
        if (x === 0) {
          ctx.moveTo(x, y + yOffset);
        } else {
          ctx.lineTo(x, y + yOffset);
        }
      }
      ctx.stroke();
    }

    const cometShift = (this.distance * 1.6) % (w + 180);
    for (let i = 0; i < 7; i += 1) {
      const x = w - ((cometShift + i * 130) % (w + 180));
      const y = 20 + i * 20 + Math.sin((this.distance * 0.02) + i) * 4;
      const len = 26 + (i % 3) * 12;
      ctx.fillStyle = riftMode
        ? "rgba(255, 194, 236, 0.2)"
        : upperMode
          ? "rgba(238, 199, 255, 0.17)"
          : "rgba(220, 243, 255, 0.16)";
      ctx.fillRect(x, y, len, 2);
    }

    const stripeShift = Math.floor((this.distance * 0.45) % 40);
    for (let x = -40 + stripeShift; x < w; x += 40) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, 18, 22, 4);
    }

    if (!useLevel1Bg) {
      const ground = ctx.createLinearGradient(0, this.groundY, 0, h);
      if (riftMode) {
        ground.addColorStop(0, "#1a1232");
        ground.addColorStop(1, "#0f0b23");
      } else if (upperMode) {
        ground.addColorStop(0, "#1d1533");
        ground.addColorStop(1, "#110d22");
      } else {
        ground.addColorStop(0, "#0d2234");
        ground.addColorStop(1, "#081722");
      }
      ctx.fillStyle = ground;
      ctx.fillRect(0, this.groundY, w, h - this.groundY);
    } else {
      ctx.fillStyle = "rgba(8, 22, 34, 0.15)";
      ctx.fillRect(0, this.groundY, w, h - this.groundY);
    }

    ctx.fillStyle = riftMode
      ? "rgba(255, 118, 222, 0.3)"
      : upperMode
        ? "rgba(218, 126, 255, 0.26)"
        : "rgba(74, 237, 185, 0.22)";
    ctx.fillRect(0, this.groundY - 2, w, 2);
    if (upperMode || riftMode) {
      ctx.fillStyle = riftMode ? "rgba(255, 143, 228, 0.24)" : "rgba(185, 117, 255, 0.24)";
      ctx.fillRect(0, this.ceilingY, w, 2);
    }

    for (let i = 0; i < this.pickups.length; i += 1) {
      const pickup = this.pickups[i];
      const pulse = 0.65 + Math.sin(this.frameTick * 0.08 + pickup.phase) * 0.35;
      const glow = ctx.createRadialGradient(pickup.x, pickup.y, 1, pickup.x, pickup.y, pickup.r * 2.5);
      glow.addColorStop(0, riftMode ? `rgba(255, 212, 248, ${0.95 * pulse})` : `rgba(255, 244, 196, ${0.9 * pulse})`);
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = riftMode ? "#ff9de9" : "#ffe18c";
      ctx.arc(pickup.x, pickup.y, pickup.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = riftMode ? "rgba(255, 233, 249, 0.9)" : "rgba(255, 247, 211, 0.95)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    for (let i = 0; i < this.obstacles.length; i += 1) {
      const obstacle = this.obstacles[i];
      if (this.drawObstacleSprite(ctx, obstacle)) {
        continue;
      }

      if (obstacle.kind === "spike-up" || obstacle.kind === "spike-down") {
        const left = obstacle.x;
        const right = obstacle.x + obstacle.w;
        const top = obstacle.y;
        const mid = obstacle.x + obstacle.w / 2;
        const bottom = obstacle.y + obstacle.h;

        ctx.beginPath();
        if (obstacle.kind === "spike-down") {
          ctx.moveTo(left, top);
          ctx.lineTo(mid, bottom);
          ctx.lineTo(right, top);
        } else {
          ctx.moveTo(left, bottom);
          ctx.lineTo(mid, top);
          ctx.lineTo(right, bottom);
        }
        ctx.closePath();
        ctx.fillStyle = riftMode ? "#ff77df" : upperMode ? "#c97bff" : "#ff8a4a";
        ctx.fill();
        ctx.strokeStyle = riftMode ? "#ffe0f7" : upperMode ? "#f2d7ff" : "#ffd8bf";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const grad = ctx.createLinearGradient(0, obstacle.y, 0, obstacle.y + obstacle.h);
        if (riftMode) {
          grad.addColorStop(0, "#ffb1ef");
          grad.addColorStop(1, "#cb56b5");
        } else if (upperMode) {
          grad.addColorStop(0, "#d79cff");
          grad.addColorStop(1, "#9f58d8");
        } else {
          grad.addColorStop(0, "#ffb066");
          grad.addColorStop(1, "#d86e2f");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        ctx.strokeStyle = riftMode ? "#ffe5f7" : upperMode ? "#f0d5ff" : "#ffe2cb";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillStyle = riftMode
          ? "rgba(255, 230, 248, 0.3)"
          : upperMode
            ? "rgba(255, 237, 255, 0.25)"
            : "rgba(255, 236, 219, 0.25)";
        ctx.fillRect(obstacle.x + 1, obstacle.y + 2, Math.max(2, obstacle.w - 2), 3);
      }
    }

    for (let i = 0; i < this.trailParticles.length; i += 1) {
      const p = this.trailParticles[i];
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.fillStyle = `rgba(137, 255, 223, ${0.12 + alpha * 0.5})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    const centerX = this.playerX + this.playerSize / 2;
    const centerY = this.playerY + this.playerSize / 2;
    const spriteSize = this.playerSize * this.playerSpriteScale;
    const spriteDrawX = -spriteSize / 2;
    const spriteDrawY = (this.playerSize / 2) - spriteSize;
    const spriteWorldX = this.playerX + (this.playerSize - spriteSize) / 2;
    const spriteWorldY = this.playerY + (this.playerSize - spriteSize);
    const tilt = Math.max(-0.26, Math.min(0.26, this.vy * 0.03));

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(tilt);
    if (this.isOverdriveActive()) {
      ctx.shadowColor = `rgba(255, 228, 153, ${0.4 + this.jumpFlash * 0.04})`;
      ctx.shadowBlur = 22 + this.jumpFlash * 1.25;
    } else {
      ctx.shadowColor = `rgba(129, 255, 223, ${0.3 + this.jumpFlash * 0.03})`;
      ctx.shadowBlur = 14 + this.jumpFlash * 1.1;
    }
    if (this.isImageReady(this.playerSpriteImage)) {
      ctx.drawImage(this.playerSpriteImage, spriteDrawX, spriteDrawY, spriteSize, spriteSize);
    } else {
      ctx.fillStyle = "#00cfa0";
      ctx.fillRect(-this.playerSize / 2, -this.playerSize / 2, this.playerSize, this.playerSize);
      ctx.strokeStyle = "#dffff5";
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.playerSize / 2, -this.playerSize / 2, this.playerSize, this.playerSize);
    }
    ctx.restore();

    if (this.jumpFlash > 0 && !this.isImageReady(this.playerSpriteImage)) {
      ctx.strokeStyle = `rgba(177, 255, 233, ${this.jumpFlash / 12})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(spriteWorldX - 3, spriteWorldY - 3, spriteSize + 6, spriteSize + 6);
    }

    if (this.isOverdriveActive()) {
      const auraPower = 0.1 + (this.pulseCharge / 100) * 0.2;
      ctx.fillStyle = `rgba(255, 221, 126, ${auraPower})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  spawnTrailParticle(power = 1) {
    const size = this.randomRange(1.5, 3.1) * power;
    this.trailParticles.push({
      x: this.playerX + this.randomRange(5, this.playerSize - 4),
      y: this.playerY + this.randomRange(6, this.playerSize - 6),
      vx: this.randomRange(-2.4, -1.0) * power,
      vy: this.randomRange(-0.35, 0.4),
      size,
      life: this.randomRange(11, 19),
      maxLife: 19
    });

    if (this.trailParticles.length > 110) {
      this.trailParticles.splice(0, this.trailParticles.length - 110);
    }
  }

  updateVisualEffects() {
    for (let i = 0; i < this.trailParticles.length; i += 1) {
      const p = this.trailParticles[i];
      p.x += p.vx - this.speed * 0.45;
      p.y += p.vy;
      p.vy += 0.02;
      p.life -= 1;
      p.size = Math.max(0.3, p.size * 0.985);
    }

    this.trailParticles = this.trailParticles.filter((p) => p.life > 0 && p.x > -40);
    this.jumpFlash = Math.max(0, this.jumpFlash - 0.65);
  }

  updateObstacleMotion() {
    for (let i = 0; i < this.obstacles.length; i += 1) {
      const obstacle = this.obstacles[i];
      obstacle.x -= this.speed * (this.isOverdriveActive() ? 1.04 : 1);

      if (obstacle.driftAmp) {
        const shifted = obstacle.baseY + Math.sin(this.distance * obstacle.driftSpeed + obstacle.driftPhase) * obstacle.driftAmp;
        const minY = this.ceilingY;
        const maxY = this.groundY - obstacle.h;
        obstacle.y = Math.max(minY, Math.min(maxY, shifted));
      }
    }
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -40);
  }

  resetRound() {
    this.configureLevel();
    this.playerY = this.groundY - this.playerSize;
    this.vy = 0;
    this.jumpsUsed = 0;
    this.distance = 0;
    this.speed = this.baseSpeed;
    this.obstacles = [];
    this.spawnIn = this.levelMode === "upper"
      ? this.randomRange(240, 340)
      : this.levelMode === "rift"
        ? this.randomRange(210, 320)
        : this.randomRange(220, 300);
    this.pickups = [];
    this.schedulePickupSpawn();
    this.trailParticles = [];
    this.jumpFlash = 0;
    this.collisions = 0;
    this.pulseCharge = 0;
    this.overdriveTime = 0;
    this.overdriveMaxTime = 1;
    this.overdriveActivations = 0;
    this.pickupsCollected = 0;
    this.frameTick = 0;
    this.running = false;
    cancelAnimationFrame(this.frameId);

    this.updateHud("готов");
    this.drawScene();
  }

  resetSession() {
    this.closeDialog();
    this.runs = 0;
    this.clearFeedback();
    this.resetRound();
  }

  stop(status = "пауза") {
    if (this.uiLocked) {
      return;
    }
    if (!this.running) {
      return;
    }
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.updateHud(status);
    this.drawScene();
  }

  retry(message = "Забег сброшен. Можно стартовать заново.") {
    if (this.uiLocked) {
      return;
    }
    if (this.options.canRun && !this.options.canRun()) {
      return;
    }
    this.resetRound();
    this.setFeedback(message, false);
  }

  start() {
    if (this.uiLocked) {
      return;
    }
    if (this.running) {
      return;
    }
    if (this.options.canRun && !this.options.canRun()) {
      return;
    }

    this.runs += 1;
    this.clearFeedback();
    this.resetRound();
    this.running = true;
    this.updateHud("в процессе");
    this.playMusic();

    if (this.options.onRunStart) {
      this.options.onRunStart(this.runs);
    }

    this.frameId = requestAnimationFrame(this.boundLoop);
  }

  jump() {
    if (this.uiLocked) {
      return;
    }
    if (!this.running) {
      return;
    }
    const floor = this.groundY - this.playerSize;
    const onGround = this.playerY >= floor - 0.5;

    if (onGround) {
      this.vy = this.jumpPower;
      this.jumpsUsed = 1;
      this.jumpFlash = 8;
      for (let i = 0; i < 4; i += 1) {
        this.spawnTrailParticle(1.3);
      }
      return;
    }

    if (this.jumpsUsed < this.maxJumps) {
      this.vy = this.jumpPower * 0.94;
      this.jumpsUsed += 1;
      this.jumpFlash = 10;
      for (let i = 0; i < 5; i += 1) {
        this.spawnTrailParticle(1.6);
      }
    }
  }

  findCollision() {
    const px = this.playerX + 5;
    const py = this.playerY + 5;
    const pw = this.playerSize - 10;
    const ph = this.playerSize - 10;

    for (let i = 0; i < this.obstacles.length; i += 1) {
      const obstacle = this.obstacles[i];
      const insetX = obstacle.hitInsetX || 0;
      const insetTop = obstacle.hitInsetTop || 0;
      const insetBottom = obstacle.hitInsetBottom || 0;
      const ox = obstacle.x + insetX;
      const oy = obstacle.y + insetTop;
      const ow = Math.max(1, obstacle.w - insetX * 2);
      const oh = Math.max(1, obstacle.h - insetTop - insetBottom);

      if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
        return { obstacle, index: i };
      }
    }

    return null;
  }

  finishRun() {
    this.running = false;
    this.best = Math.max(this.best, this.distance);
    localStorage.setItem("pro_dash_best", String(Math.floor(this.best)));
    this.updateHud("финиш");

    if (this.options.onFinish) {
      this.options.onFinish({
        runs: this.runs,
        collisions: this.collisions,
        distance: this.distance,
        best: this.best,
        pickups: this.pickupsCollected,
        overdrives: this.overdriveActivations,
        levelMode: this.levelMode
      });
    }

    this.playFinishAnimation();
    if (this.options.suppressDefaultFinishDialog) {
      this.drawScene();
      return;
    }

    this.showDialog({
      title: "Поздравляем!",
      text: `Финиш достигнут. Сфер собрано: ${this.pickupsCollected}, овердрайвов: ${this.overdriveActivations}.`,
      confirmText: "Класс!",
      kind: "finish"
    });

    this.drawScene();
  }

  failRun() {
    this.running = false;
    this.collisions += 1;
    this.updateHud("столкновение");
    this.setFeedback("Есть столкновение.", true);

    if (this.options.onCollision) {
      this.options.onCollision({ runs: this.runs, collisions: this.collisions });
    }

    this.showDialog({
      title: "Столкновение",
      text: "Повторить?",
      confirmText: "Да, повторить",
      cancelText: "Нет",
      onConfirm: () => {
        this.start();
      },
      onCancel: () => {
        this.setFeedback("Нажми «Старт забега», когда будешь готов.", false);
      }
    });

    this.drawScene();
  }

  loop() {
    if (!this.running) {
      return;
    }

    this.frameTick += 1;
    this.updateOverdrive();

    const overdriveBonusSpeed = this.isOverdriveActive() ? 1.2 : 0;
    this.distance += this.speed + (this.isOverdriveActive() ? 0.42 : 0);
    this.speed = Math.min(
      this.maxSpeed + overdriveBonusSpeed,
      this.speed + this.speedRamp + (this.isOverdriveActive() ? 0.0007 : 0)
    );
    this.spawnIn -= this.speed;

    if (this.spawnIn <= 0) {
      this.spawnPattern();
    }

    this.updateObstacleMotion();
    this.updatePickups();

    this.vy += this.gravity;
    this.playerY += this.vy;

    const floor = this.groundY - this.playerSize;
    if (this.playerY >= floor) {
      this.playerY = floor;
      this.vy = 0;
      this.jumpsUsed = 0;
    }
    if (this.playerY <= this.ceilingY) {
      this.playerY = this.ceilingY;
      this.vy = Math.max(0, this.vy);
    }

    if (Math.random() < 0.72) {
      this.spawnTrailParticle(1);
    }
    this.updateVisualEffects();

    const collision = this.findCollision();
    if (collision) {
      if (this.isOverdriveActive()) {
        this.obstacles.splice(collision.index, 1);
        this.overdriveTime = Math.max(0, this.overdriveTime - Math.floor(this.overdriveMaxTime * 0.68));
        this.pulseCharge = Math.round((this.overdriveTime / Math.max(1, this.overdriveMaxTime)) * 100);
        this.setFeedback("Щит поглотил столкновение.", false);
        for (let i = 0; i < 10; i += 1) {
          this.spawnTrailParticle(2.1);
        }
      } else {
        this.failRun();
        return;
      }
    }

    if (this.distance >= this.goal) {
      this.finishRun();
      return;
    }

    if (this.distance > this.best) {
      this.best = this.distance;
    }

    this.updateHud("в процессе");
    this.drawScene();
    this.frameId = requestAnimationFrame(this.boundLoop);
  }
}
