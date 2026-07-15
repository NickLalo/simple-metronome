import { MetronomeEngine } from "./metronome-engine.js";
import { AudioLoadTimeoutError } from "./audio-load.js";
import { TapTempo, clampInteger } from "./tempo.js";

const TEMPO_MIN = 40;
const TEMPO_MAX = 240;
const TEMPO_ENTRY_IDLE_MS = 3_000;
const PRACTICE_TOOLTIP_BEAT_COUNT = 12;

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element;
}

function revealApp() {
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  fontsReady.finally(() => {
    window.requestAnimationFrame(() => document.documentElement.classList.remove("app-loading"));
  });
}

const elements = {
  accentToggle: byId("accent-toggle"),
  audioErrorClose: byId("audio-error-close"),
  audioErrorDialog: byId("audio-error-dialog"),
  audioErrorMessage: byId("audio-error-message"),
  barsInput: byId("bars-input"),
  beatIndicator: byId("beat-indicator"),
  beatsInput: byId("beats-input"),
  gainInput: byId("gain-input"),
  gainSlider: byId("gain-slider"),
  increaseInput: byId("increase-input"),
  practiceButton: byId("practice-button"),
  practiceTooltipBeats: byId("practice-tooltip-beats"),
  practiceTooltipText: byId("practice-tooltip-text"),
  practiceTooltipTrigger: byId("practice-tooltip-trigger"),
  randomButton: byId("random-button"),
  shortcutGuide: byId("shortcut-guide"),
  shortcutsToggle: byId("shortcuts-toggle"),
  startInput: byId("start-input"),
  startButton: byId("start-button"),
  startButtonLabel: document.querySelector("#start-button .button-label"),
  status: byId("app-status"),
  tapButton: byId("tap-button"),
  targetInput: byId("target-input"),
  targetProgressDots: Array.from(document.querySelectorAll(".target-progress-dot")),
  targetSettings: byId("target-settings"),
  targetToggle: byId("target-toggle"),
  tempoInput: byId("tempo-input"),
  tempoSlider: byId("tempo-slider"),
};

const tapTempo = new TapTempo({ minimum: TEMPO_MIN, maximum: TEMPO_MAX });
let practiceTooltipBeatsRemaining = 0;
let tempoEntryTimeoutId = null;
const engine = new MetronomeEngine({
  tempo: Number(elements.tempoInput.value),
  beatsPerBar: Number(elements.beatsInput.value),
  accent: elements.accentToggle.checked,
  gain: Number(elements.gainInput.value),
  onBeat: showBeat,
  onPlayingChange: showPlayingState,
  onReady: () => setStatus("Audio ready"),
  onTempoChange: (tempo, reason) => {
    renderTempo(tempo);
    setStatus(reason === "reset" ? `Stopped — tempo reset to ${tempo} BPM` : `Tempo increased to ${tempo} BPM`);
  },
});

function setStatus(message) {
  elements.status.textContent = message;
}

function showAudioError(error) {
  elements.audioErrorMessage.textContent =
    error instanceof AudioLoadTimeoutError
      ? "The metronome click didn't load within 2 seconds. Check your connection, then try starting it again."
      : "The browser couldn't start the metronome audio. Check your audio settings, then try again.";

  if (!elements.audioErrorDialog.open) {
    if (typeof elements.audioErrorDialog.showModal === "function") {
      elements.audioErrorDialog.showModal();
    } else {
      elements.audioErrorDialog.setAttribute("open", "");
    }
  }
}

function closeAudioError() {
  if (typeof elements.audioErrorDialog.close === "function") {
    elements.audioErrorDialog.close();
  } else {
    elements.audioErrorDialog.removeAttribute("open");
  }
}

function setSliderFill(input) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const percentage = ((Number(input.value) - minimum) / (maximum - minimum)) * 100;
  input.style.setProperty("--range-progress", `${percentage}%`);
}

function renderTempo(tempo) {
  elements.tempoInput.value = String(tempo);
  elements.tempoSlider.value = String(tempo);
  setSliderFill(elements.tempoSlider);
  renderTargetProgress();
}

function updateTempo(value, { announce = true } = {}) {
  const tempo = engine.setTempo(clampInteger(value, TEMPO_MIN, TEMPO_MAX, engine.tempo), {
    rememberAsStart: !elements.targetToggle.checked,
  });
  renderTempo(tempo);

  if (elements.targetToggle.checked) {
    if (tempo < Number(elements.startInput.value)) {
      elements.startInput.value = String(tempo);
    }
    if (tempo > Number(elements.targetInput.value)) {
      elements.targetInput.value = String(tempo);
    }
    configureTarget();
  }

  if (announce) {
    setStatus(`Tempo set to ${tempo} BPM`);
  }

  return tempo;
}

function clearTempoEntryTimeout() {
  if (tempoEntryTimeoutId === null) {
    return;
  }

  window.clearTimeout(tempoEntryTimeoutId);
  tempoEntryTimeoutId = null;
}

function scheduleTempoEntryTimeout() {
  clearTempoEntryTimeout();
  tempoEntryTimeoutId = window.setTimeout(() => {
    tempoEntryTimeoutId = null;
    if (document.activeElement === elements.tempoInput) {
      elements.tempoInput.blur();
    }
  }, TEMPO_ENTRY_IDLE_MS);
}

function finishTempoEntry() {
  clearTempoEntryTimeout();
  elements.tempoInput.blur();
}

function createPracticeTooltipBeatDots() {
  const dots = Array.from({ length: PRACTICE_TOOLTIP_BEAT_COUNT }, (_, index) => {
    const dot = document.createElement("span");
    dot.className = "practice-tooltip-beat";
    dot.style.setProperty("--dot-index", index);
    return dot;
  });
  elements.practiceTooltipBeats.replaceChildren(...dots);
}

function renderPracticeTooltipBeatDots() {
  const spentCount = PRACTICE_TOOLTIP_BEAT_COUNT - practiceTooltipBeatsRemaining;
  Array.from(elements.practiceTooltipBeats.children).forEach((dot, index) => {
    dot.classList.toggle("is-spent", index < spentCount);
  });
}

function startPracticeTooltipCountdown() {
  practiceTooltipBeatsRemaining = PRACTICE_TOOLTIP_BEAT_COUNT;
  elements.practiceTooltipTrigger.classList.remove("is-counting", "is-dismissed");
  elements.practiceTooltipTrigger.classList.add("is-counting");
  renderPracticeTooltipBeatDots();
}

function dismissPracticeTooltip() {
  practiceTooltipBeatsRemaining = 0;
  elements.practiceTooltipTrigger.classList.remove("is-counting");
  elements.practiceTooltipTrigger.classList.add("is-dismissed");
  elements.practiceButton.blur();
}

function consumePracticeTooltipBeat() {
  if (practiceTooltipBeatsRemaining === 0) {
    return;
  }

  practiceTooltipBeatsRemaining -= 1;
  renderPracticeTooltipBeatDots();
  if (practiceTooltipBeatsRemaining === 0) {
    dismissPracticeTooltip();
  }
}

function restorePracticeTooltip() {
  elements.practiceTooltipTrigger.classList.remove("is-dismissed");
  if (!elements.practiceTooltipTrigger.classList.contains("is-counting")) {
    practiceTooltipBeatsRemaining = PRACTICE_TOOLTIP_BEAT_COUNT;
    renderPracticeTooltipBeatDots();
  }
}

function renderBeatIndicator(beatsPerBar) {
  const dots = [];
  for (let index = 0; index < beatsPerBar; index += 1) {
    const dot = document.createElement("span");
    dot.className = "beat-dot";
    dots.push(dot);
  }
  elements.beatIndicator.replaceChildren(...dots);
}

function showBeat(beatNumber) {
  Array.from(elements.beatIndicator.children).forEach((dot, index) => {
    dot.classList.toggle("is-active", index + 1 === beatNumber);
    dot.classList.toggle("is-downbeat", beatNumber === 1 && index === 0);
  });

  if (beatNumber > 0) {
    consumePracticeTooltipBeat();
  }
}

function showPlayingState(isPlaying) {
  elements.startButton.dataset.state = isPlaying ? "playing" : "stopped";
  elements.startButton.setAttribute("aria-pressed", String(isPlaying));
  elements.startButtonLabel.textContent = isPlaying ? "Stop" : "Start";
  if (!isPlaying) {
    dismissPracticeTooltip();
  }
  setStatus(isPlaying ? `Playing at ${engine.tempo} BPM` : "Stopped");
}

function getTargetSettings() {
  const target = clampInteger(elements.targetInput.value, TEMPO_MIN, TEMPO_MAX, 160);
  const start = clampInteger(elements.startInput.value, TEMPO_MIN, target, Math.min(engine.tempo, target));
  const step = clampInteger(elements.increaseInput.value, 1, 30, 3);
  const barsPerChange = clampInteger(elements.barsInput.value, 1, 16, 4);

  return { start, target, step, barsPerChange };
}

function renderTargetProgress() {
  const { start, target } = getTargetSettings();
  const span = target - start;
  const progress = span === 0 ? Number(engine.tempo >= target) : (engine.tempo - start) / span;
  const filledCount = elements.targetToggle.checked
    ? Math.round(Math.min(1, Math.max(0, progress)) * elements.targetProgressDots.length)
    : 0;

  elements.targetProgressDots.forEach((dot, index) => {
    dot.classList.toggle("is-filled", index < filledCount);
  });
}

function updatePracticeTooltipText({ start, target, step, barsPerChange }) {
  const barLabel = barsPerChange === 1 ? "bar" : "bars";
  elements.practiceTooltipText.textContent =
    `Starts at ${start} BPM with the accent off, then adds ${step} BPM every ${barsPerChange} ${barLabel} ` +
    `until ${target}. Stopping resets to ${start} BPM.`;
}

function configureTarget() {
  const { start, target, step, barsPerChange } = getTargetSettings();

  elements.startInput.value = String(start);
  elements.targetInput.value = String(target);
  elements.increaseInput.value = String(step);
  elements.barsInput.value = String(barsPerChange);
  engine.setStartingTempo(start);
  engine.configureTarget({
    enabled: elements.targetToggle.checked,
    target,
    step,
    barsPerChange,
  });
  renderTargetProgress();
  updatePracticeTooltipText({ start, target, step, barsPerChange });
  return { start, target, step, barsPerChange };
}

async function togglePlayback() {
  if (engine.isPlaying) {
    engine.stop();
    return;
  }

  elements.startButton.disabled = true;
  elements.startButtonLabel.textContent = "Loading…";
  setStatus("Loading metronome audio…");

  try {
    await engine.start();
  } catch (error) {
    elements.startButtonLabel.textContent = "Start";
    dismissPracticeTooltip();
    setStatus("Audio could not be started. Try again.");
    showAudioError(error);
    console.error("Unable to start metronome audio", error);
  } finally {
    elements.startButton.disabled = false;
  }
}

function recordTap() {
  const tempo = tapTempo.record(Date.now());

  if (tempo === null) {
    setStatus("Tap again to set the tempo");
    return;
  }

  updateTempo(tempo);
}

function setRandomTempo() {
  const tempo = Math.floor(Math.random() * 81) + 80;
  updateTempo(tempo);
  setStatus(`Random tempo: ${tempo} BPM`);
}

async function startPracticeMode() {
  elements.accentToggle.checked = false;
  engine.setAccent(false);
  elements.targetToggle.checked = true;
  elements.targetSettings.disabled = false;
  const { start, target, step, barsPerChange } = configureTarget();
  engine.setTempo(start, { rememberAsStart: true });
  renderTempo(start);
  startPracticeTooltipCountdown();

  if (!engine.isPlaying) {
    await togglePlayback();
  }

  if (!engine.isPlaying) {
    return;
  }

  const barLabel = barsPerChange === 1 ? "bar" : "bars";
  setStatus(`Practice mode: ${start} to ${target} BPM, +${step} every ${barsPerChange} ${barLabel}`);
}

function enhanceNumberInput(input) {
  const wrapper = document.createElement("span");
  const controls = document.createElement("span");
  const labels = {
    "bars-input": "bar interval",
    "beats-input": "beats per bar",
    "gain-input": "gain",
    "increase-input": "BPM increase",
    "start-input": "starting BPM",
    "target-input": "target BPM",
  };
  const label = labels[input.id] || input.id.replace(/-input$/, "").replaceAll("-", " ");

  wrapper.className = "number-stepper";
  controls.className = "number-stepper-controls";

  [1, -1].forEach((direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `number-step-button ${direction > 0 ? "step-up" : "step-down"}`;
    button.setAttribute("aria-label", `${direction > 0 ? "Increase" : "Decrease"} ${label}`);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (input.disabled) {
        return;
      }
      direction > 0 ? input.stepUp() : input.stepDown();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
    });
    controls.append(button);
  });

  input.before(wrapper);
  wrapper.append(input, controls);
}

function commitNumberInput(input, minimum, maximum, fallback, callback) {
  const value = clampInteger(input.value, minimum, maximum, fallback);
  input.value = String(value);
  callback(value);
}

function addRangeWheelControl(input, callback) {
  input.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextValue = clampInteger(
        Number(input.value) + direction,
        Number(input.min),
        Number(input.max),
        Number(input.value),
      );
      input.value = String(nextValue);
      setSliderFill(input);
      callback(nextValue);
    },
    { passive: false },
  );
}

document.querySelectorAll("[data-tempo-step]").forEach((button) => {
  button.addEventListener("click", () => updateTempo(engine.tempo + Number(button.dataset.tempoStep)));
});

document.querySelectorAll('input[type="number"]').forEach(enhanceNumberInput);

elements.startButton.addEventListener("click", togglePlayback);
elements.audioErrorClose.addEventListener("click", closeAudioError);
elements.tapButton.addEventListener("click", recordTap);
elements.randomButton.addEventListener("click", setRandomTempo);
elements.practiceButton.addEventListener("click", startPracticeMode);
elements.practiceTooltipTrigger.addEventListener("pointerenter", restorePracticeTooltip);
elements.practiceTooltipTrigger.addEventListener("focusin", restorePracticeTooltip);

elements.tempoInput.addEventListener("focus", scheduleTempoEntryTimeout);
elements.tempoInput.addEventListener("input", () => {
  elements.tempoInput.value = elements.tempoInput.value.replace(/\D/g, "");
  scheduleTempoEntryTimeout();
});
elements.tempoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    finishTempoEntry();
  }
});
elements.tempoInput.addEventListener("change", () => updateTempo(elements.tempoInput.value));
elements.tempoInput.addEventListener("blur", () => {
  clearTempoEntryTimeout();
  updateTempo(elements.tempoInput.value, { announce: false });
});
elements.tempoSlider.addEventListener("input", () => updateTempo(elements.tempoSlider.value, { announce: false }));
elements.tempoSlider.addEventListener("change", () => setStatus(`Tempo set to ${engine.tempo} BPM`));
elements.tempoSlider.addEventListener("dblclick", () => {
  updateTempo(112, { announce: false });
  setStatus("Tempo reset to 112 BPM");
});

elements.beatsInput.addEventListener("change", () => {
  commitNumberInput(elements.beatsInput, 1, 17, engine.beatsPerBar, (value) => {
    engine.setBeatsPerBar(value);
    renderBeatIndicator(value);
    setStatus(`${value} beats per bar`);
  });
});

elements.accentToggle.addEventListener("change", () => {
  engine.setAccent(elements.accentToggle.checked);
  setStatus(elements.accentToggle.checked ? "First-beat accent on" : "First-beat accent off");
});

elements.shortcutsToggle.addEventListener("change", () => {
  const isVisible = elements.shortcutsToggle.checked;
  document.body.classList.toggle("show-shortcuts", isVisible);
  elements.shortcutGuide.hidden = !isVisible;
  setStatus(isVisible ? "Keyboard shortcuts shown" : "Keyboard shortcuts hidden");
});

elements.targetToggle.addEventListener("change", () => {
  elements.targetSettings.disabled = !elements.targetToggle.checked;
  const settings = configureTarget();
  if (elements.targetToggle.checked) {
    engine.setTempo(settings.start, { rememberAsStart: true });
    renderTempo(settings.start);
  }
  setStatus(
    elements.targetToggle.checked ? `Target tempo on — starting at ${settings.start} BPM` : "Target tempo off",
  );
});

[elements.increaseInput, elements.barsInput].forEach((input) => {
  input.addEventListener("change", configureTarget);
});

elements.startInput.addEventListener("change", () => {
  const start = clampInteger(elements.startInput.value, TEMPO_MIN, TEMPO_MAX, engine.tempo);
  const target = clampInteger(elements.targetInput.value, TEMPO_MIN, TEMPO_MAX, 160);
  elements.startInput.value = String(start);
  elements.targetInput.value = String(Math.max(start, target));
  const settings = configureTarget();

  if (elements.targetToggle.checked && !engine.isPlaying) {
    engine.setTempo(settings.start, { rememberAsStart: true });
    renderTempo(settings.start);
    setStatus(`Start tempo set to ${settings.start} BPM`);
  }
});

elements.targetInput.addEventListener("change", () => {
  const target = clampInteger(elements.targetInput.value, TEMPO_MIN, TEMPO_MAX, 160);
  const start = clampInteger(elements.startInput.value, TEMPO_MIN, TEMPO_MAX, Math.min(engine.tempo, target));
  elements.targetInput.value = String(target);
  elements.startInput.value = String(Math.min(start, target));
  const settings = configureTarget();
  if (elements.targetToggle.checked && !engine.isPlaying) {
    engine.setTempo(settings.start, { rememberAsStart: true });
    renderTempo(settings.start);
  }
});

elements.gainInput.addEventListener("change", () => {
  commitNumberInput(elements.gainInput, -36, 18, engine.gain, (value) => {
    engine.setGain(value);
    elements.gainSlider.value = String(value);
    setSliderFill(elements.gainSlider);
    setStatus(value === -36 ? "Metronome muted" : `Gain set to ${value} dB`);
  });
});
elements.gainSlider.addEventListener("input", () => {
  const gain = engine.setGain(elements.gainSlider.value);
  elements.gainInput.value = String(gain);
  setSliderFill(elements.gainSlider);
});
elements.gainSlider.addEventListener("change", () => {
  setStatus(engine.gain === -36 ? "Metronome muted" : `Gain set to ${engine.gain} dB`);
});
elements.gainSlider.addEventListener("dblclick", () => {
  const gain = engine.setGain(0);
  elements.gainInput.value = String(gain);
  elements.gainSlider.value = String(gain);
  setSliderFill(elements.gainSlider);
  setStatus("Gain reset to 0 dB");
});

addRangeWheelControl(elements.tempoSlider, (value) => updateTempo(value));
addRangeWheelControl(elements.gainSlider, (value) => {
  elements.gainInput.value = String(engine.setGain(value));
});

document.addEventListener("click", (event) => {
  if (event.detail === 0 || !(event.target instanceof HTMLElement)) {
    return;
  }

  event.target.closest("button")?.blur();
});

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const target = event.target;
  const isInput = target instanceof HTMLElement && target.matches("input");
  const isButton = target instanceof HTMLElement && target.matches("button");
  if (isInput || isButton) {
    if (event.key === "Escape") {
      target.blur();
      return;
    }
  }

  if (isInput || (isButton && (event.key === " " || event.key === "Enter"))) {
    return;
  }

  const key = event.key.toLowerCase();
  const actions = {
    " ": togglePlayback,
    a: () => updateTempo(engine.tempo - 1),
    arrowdown: () => updateTempo(engine.tempo - 5),
    arrowleft: () => updateTempo(engine.tempo - 1),
    arrowright: () => updateTempo(engine.tempo + 1),
    arrowup: () => updateTempo(engine.tempo + 5),
    b: () => elements.beatsInput.select(),
    d: () => updateTempo(engine.tempo + 1),
    e: () => elements.accentToggle.click(),
    g: () => elements.gainInput.select(),
    h: () => elements.shortcutsToggle.click(),
    p: startPracticeMode,
    r: setRandomTempo,
    s: () => updateTempo(engine.tempo - 5),
    t: recordTap,
    w: () => updateTempo(engine.tempo + 5),
    y: () => elements.targetToggle.click(),
  };

  if (/^\d$/.test(key)) {
    event.preventDefault();
    elements.tempoInput.value = key;
    elements.tempoInput.focus();
    elements.tempoInput.setSelectionRange(1, 1);
    scheduleTempoEntryTimeout();
    return;
  }

  const action = actions[key];
  if (action) {
    event.preventDefault();
    action();
  }
});

window.addEventListener("beforeunload", () => {
  clearTempoEntryTimeout();
  engine.dispose();
});

createPracticeTooltipBeatDots();
renderTempo(engine.tempo);
renderBeatIndicator(engine.beatsPerBar);
setSliderFill(elements.gainSlider);
configureTarget();
revealApp();
