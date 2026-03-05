const OVERLAY_ID = "fragmentRewardOverlay";
const DIALOG_ID = "fragmentRewardDialog";
const TITLE_ID = "fragmentRewardTitle";

function getRefs() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    return null;
  }

  return {
    overlay,
    title: overlay.querySelector("[data-fragment-title]"),
    text: overlay.querySelector("[data-fragment-text]"),
    image: overlay.querySelector("[data-fragment-image]"),
    missing: overlay.querySelector("[data-fragment-missing]"),
    closeBtn: overlay.querySelector("[data-fragment-close]")
  };
}

function handleEscape(event) {
  if (event.key === "Escape") {
    hideRoundFragmentReward();
  }
}

function ensureModal() {
  const existing = getRefs();
  if (existing) {
    return existing;
  }

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "fragment-reward-overlay";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <section id="${DIALOG_ID}" class="fragment-reward-dialog" role="dialog" aria-modal="true" aria-labelledby="${TITLE_ID}">
      <h3 id="${TITLE_ID}" data-fragment-title>Фрагмент получен</h3>
      <p data-fragment-text>Новый фрагмент добавлен в коллекцию.</p>
      <div class="fragment-reward-media">
        <img data-fragment-image alt="" />
        <p data-fragment-missing hidden></p>
      </div>
      <div class="fragment-reward-actions">
        <button type="button" class="btn primary" data-fragment-close>Продолжить</button>
      </div>
    </section>
  `;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      hideRoundFragmentReward();
    }
  });

  document.body.appendChild(overlay);

  const refs = getRefs();
  if (!refs || !refs.closeBtn) {
    throw new Error("Fragment reward modal is not initialized correctly");
  }

  refs.closeBtn.addEventListener("click", hideRoundFragmentReward);
  return refs;
}

export function hideRoundFragmentReward() {
  const refs = getRefs();
  if (!refs) {
    return;
  }

  refs.overlay.classList.remove("is-open");
  refs.overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("fragment-reward-lock");
  document.removeEventListener("keydown", handleEscape);
}

export function showRoundFragmentReward(roundNumber) {
  const numericRound = Number(roundNumber);
  if (!Number.isFinite(numericRound) || numericRound < 1) {
    return;
  }

  const refs = ensureModal();
  if (!refs.title || !refs.text || !refs.image || !refs.missing || !refs.closeBtn) {
    return;
  }

  refs.title.textContent = `Фрагмент ${numericRound} получен`;
  refs.text.textContent = `Раунд ${numericRound} завершен. Ты получаешь фрагмент №${numericRound}.`;
  refs.missing.textContent = `Файл ${numericRound}.png не найден в корне проекта.`;
  refs.missing.hidden = true;

  refs.image.alt = `Фрагмент ${numericRound}`;
  refs.image.hidden = false;

  const imageSrc = `./${numericRound}.png?v=${Date.now()}`;
  refs.image.onerror = () => {
    refs.image.hidden = true;
    refs.missing.hidden = false;
    refs.missing.textContent = `Не удалось загрузить: ${imageSrc}`;
  };
  refs.image.onload = () => {
    refs.image.hidden = false;
    refs.missing.hidden = true;
  };
  refs.image.src = imageSrc;

  refs.overlay.classList.add("is-open");
  refs.overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("fragment-reward-lock");
  document.addEventListener("keydown", handleEscape);
  refs.closeBtn.focus();
}
