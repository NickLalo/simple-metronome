import "./styles.css";
import { MetronomeEngine } from "./metronome-engine.js";
import { TapTempo, clampInteger } from "./tempo.js";

const TEMPO_MIN = 40;
const TEMPO_MAX = 240;
const TEMPO_ENTRY_IDLE_MS = 2_000;
const PRACTICE_TOOLTIP_TIMEOUT_MS = 5_000;

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element;
}

const elements = {
  accentToggle: byId("accent-toggle"),
  barsInput: byId("bars-input"),
  beatIndicator: byId("beat-indicator"),
  beatsInput: byId("beats-input"),
  gainInput: byId("gain-input"),
  gainSlider: byId("gain-slider"),
  increaseInput: byId("increase-input"),
  practiceButton: byId("practice-button"),
  practiceTooltipTrigger: byId("practice-tooltip-trigger"),
  randomButton: byId("random-button"),
  shortcutGuide: byId("shortcut-guide"),
  shortcutsToggle: byId("shortcuts-toggle"),
  startButton: byId("start-button"),
  startButtonLabel: document.querySelector("#start-button .button-label"),
  status: byId("app-status"),
  tapButton: byId("tap-button"),
  targetInput: byId("target-input"),
  targetSettings: byId("target-settings"),
  targetToggle: byId("target-toggle"),
  tempoInput: byId("tempo-input"),
  tempoSlider: byId("tempo-slider"),
};

const tapTempo = new TapTempo({ minimum: TEMPO_MIN, maximum: TEMPO_MAX });
let practiceTooltipTimeoutId = null;
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
}

function updateTempo(value, { announce = true } = {}) {
  const tempo = engine.setTempo(clampInteger(value, TEMPO_MIN, TEMPO_MAX, engine.tempo));
  renderTempo(tempo);

  if (elements.targetToggle.checked && Number(elements.targetInput.value) < tempo) {
    elements.targetInput.value = String(tempo);
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

function clearPracticeTooltipTimeout() {
  if (practiceTooltipTimeoutId === null) {
    return;
  }

  window.clearTimeout(practiceTooltipTimeoutId);
  practiceTooltipTimeoutId = null;
}

function schedulePracticeTooltipDismissal() {
  clearPracticeTooltipTimeout();
  elements.practiceTooltipTrigger.classList.remove("is-counting", "is-dismissed");
  void elements.practiceTooltipTrigger.offsetWidth;
  elements.practiceTooltipTrigger.classList.add("is-counting");
  practiceTooltipTimeoutId = window.setTimeout(() => {
    practiceTooltipTimeoutId = null;
    elements.practiceTooltipTrigger.classList.remove("is-counting");
    elements.practiceTooltipTrigger.classList.add("is-dismissed");
    elements.practiceButton.blur();
  }, PRACTICE_TOOLTIP_TIMEOUT_MS);
}

function restorePracticeTooltip() {
  elements.practiceTooltipTrigger.classList.remove("is-dismissed");
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
}

function showPlayingState(isPlaying) {
  elements.startButton.dataset.state = isPlaying ? "playing" : "stopped";
  elements.startButton.setAttribute("aria-pressed", String(isPlaying));
  elements.startButtonLabel.textContent = isPlaying ? "Stop" : "Start";
  setStatus(isPlaying ? `Playing at ${engine.tempo} BPM` : "Stopped");
}

function configureTarget() {
  const target = clampInteger(elements.targetInput.value, engine.tempo, TEMPO_MAX, engine.tempo);
  const step = clampInteger(elements.increaseInput.value, 1, 30, 4);
  const barsPerChange = clampInteger(elements.barsInput.value, 1, 16, 2);

  elements.targetInput.value = String(target);
  elements.increaseInput.value = String(step);
  elements.barsInput.value = String(barsPerChange);
  engine.configureTarget({
    enabled: elements.targetToggle.checked,
    target,
    step,
    barsPerChange,
  });
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
    setStatus("Audio could not be started. Check the browser console and try again.");
    console.error("Unable to start metronome audio", error);
  } finally {
    elements.startButton.disabled = false;
  }
}

function recordTap() {
  const tempo = tapTempo.record(Date.now());
  elements.tapButton.classList.remove("is-tapped");
  window.requestAnimationFrame(() => elements.tapButton.classList.add("is-tapped"));

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
  elements.targetInput.value = "160";
  elements.increaseInput.value = "3";
  elements.barsInput.value = "4";
  updateTempo(80, { announce: false });
  configureTarget();

  if (!engine.isPlaying) {
    await togglePlayback();
  }

  setStatus("Practice mode: 80 to 160 BPM, +3 every 4 bars");
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

elements.startButton.addEventListener("click", togglePlayback);
elements.tapButton.addEventListener("click", recordTap);
elements.tapButton.addEventListener("animationend", () => elements.tapButton.classList.remove("is-tapped"));
elements.randomButton.addEventListener("click", setRandomTempo);
elements.practiceButton.addEventListener("click", () => {
  schedulePracticeTooltipDismissal();
  startPracticeMode();
});
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

elements.beatsInput.addEventListener("change", () => {
  commitNumberInput(elements.beatsInput, 1, 15, engine.beatsPerBar, (value) => {
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

  if (elements.targetToggle.checked && Number(elements.targetInput.value) < engine.tempo) {
    elements.targetInput.value = String(Math.min(engine.tempo + 20, TEMPO_MAX));
  }

  configureTarget();
  setStatus(elements.targetToggle.checked ? "Target tempo on" : "Target tempo off");
});

[elements.targetInput, elements.increaseInput, elements.barsInput].forEach((input) => {
  input.addEventListener("change", configureTarget);
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

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const target = event.target;
  const isFormControl = target instanceof HTMLElement && target.matches("input, button");
  if (isFormControl) {
    if (event.key === "Escape") {
      target.blur();
    }
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
  clearPracticeTooltipTimeout();
  clearTempoEntryTimeout();
  engine.dispose();
});

renderTempo(engine.tempo);
renderBeatIndicator(engine.beatsPerBar);
setSliderFill(elements.gainSlider);
configureTarget();
