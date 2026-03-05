const ROUND_THEME_SRC = "./музыка/1 раунд.mp3";

const audio = new Audio(ROUND_THEME_SRC);
audio.preload = "auto";
audio.loop = true;
audio.volume = 0.44;

function canPlayRoundTheme() {
  return !document.body.classList.contains("home-page") && !document.getElementById("homeBuilder");
}

function stopRoundTheme(resetTime = false) {
  audio.pause();
  if (resetTime) {
    audio.currentTime = 0;
  }
}

function tryPlayRoundTheme() {
  if (!canPlayRoundTheme()) {
    return;
  }

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

const unlockRoundTheme = () => {
  tryPlayRoundTheme();
};

document.addEventListener("pointerdown", unlockRoundTheme);
document.addEventListener("keydown", unlockRoundTheme);
document.addEventListener("touchstart", unlockRoundTheme, { passive: true });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopRoundTheme(false);
    return;
  }
  tryPlayRoundTheme();
});

window.addEventListener("beforeunload", () => {
  stopRoundTheme(false);
});

window.addEventListener("pageshow", () => {
  tryPlayRoundTheme();
});
