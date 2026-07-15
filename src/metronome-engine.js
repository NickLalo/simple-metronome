import {
  Loop,
  Sampler,
  getDestination,
  getContext,
  getDraw,
  getTransport,
  loaded,
  start as startAudio,
} from "tone";
import clickUrl from "./assets/metronome-click.mp3?url";
import { waitForAudioLoad } from "./audio-load.js";
import { configureAudioSessionForPlayback } from "./audio-session.js";
import { TempoRamp, clampInteger } from "./tempo.js";

const noop = () => {};

export class MetronomeEngine {
  #beatIndex = 0;
  #initializationPromise = null;
  #loop = null;
  #sampler = null;
  #ramp = new TempoRamp();

  constructor({
    tempo = 112,
    beatsPerBar = 4,
    accent = true,
    gain = 0,
    onBeat = noop,
    onPlayingChange = noop,
    onReady = noop,
    onTempoChange = noop,
  } = {}) {
    this.tempo = tempo;
    this.startingTempo = tempo;
    this.beatsPerBar = beatsPerBar;
    this.accent = accent;
    this.gain = gain;
    this.isPlaying = false;
    this.isReady = false;
    this.transport = getTransport();
    this.onBeat = onBeat;
    this.onPlayingChange = onPlayingChange;
    this.onReady = onReady;
    this.onTempoChange = onTempoChange;
  }

  async initialize() {
    if (this.isReady) {
      return;
    }

    if (this.#initializationPromise) {
      return this.#initializationPromise;
    }

    this.#initializationPromise = this.#createAudioGraph();

    try {
      await this.#initializationPromise;
    } catch (error) {
      this.#initializationPromise = null;
      throw error;
    }
  }

  async #createAudioGraph() {
    getDestination().volume.value = -6;
    this.#sampler = new Sampler({
      urls: { C3: clickUrl },
    }).toDestination();
    this.#applyGain();

    try {
      await waitForAudioLoad(loaded());
    } catch (error) {
      this.#sampler.dispose();
      this.#sampler = null;
      throw error;
    }

    this.#loop = new Loop((time) => this.#tick(time), "4n").start(0);
    this.transport.bpm.value = this.tempo;
    this.isReady = true;
    this.onReady();
  }

  async start() {
    if (this.isPlaying) {
      return;
    }

    await this.#resumeAudioContext();
    await this.initialize();
    this.#beatIndex = 0;
    this.#ramp.reset();
    this.transport.position = 0;
    this.transport.bpm.value = this.tempo;
    this.transport.start();
    this.isPlaying = true;
    this.onPlayingChange(true);
  }

  async #resumeAudioContext() {
    configureAudioSessionForPlayback();

    const context = getContext();
    await startAudio();

    if (context.state !== "running") {
      await context.resume();
    }

    if (context.state !== "running") {
      throw new Error(`Audio context could not be started (state: ${context.state})`);
    }
  }

  stop() {
    if (!this.isPlaying) {
      return;
    }

    this.transport.stop();
    this.transport.position = 0;
    this.#beatIndex = 0;
    this.#ramp.reset();
    this.isPlaying = false;
    this.onPlayingChange(false);
    this.onBeat(0, this.beatsPerBar);

    if (this.#ramp.enabled && this.tempo !== this.startingTempo) {
      this.tempo = this.startingTempo;
      this.transport.bpm.value = this.tempo;
      this.onTempoChange(this.tempo, "reset");
    }
  }

  async toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      await this.start();
    }
  }

  setTempo(value, { rememberAsStart = true } = {}) {
    this.tempo = clampInteger(value, 40, 240, this.tempo);
    if (rememberAsStart) {
      this.startingTempo = this.tempo;
      this.#ramp.reset();
    }

    this.transport.bpm.value = this.tempo;
    return this.tempo;
  }

  setStartingTempo(value) {
    this.startingTempo = clampInteger(value, 40, 240, this.startingTempo);
    return this.startingTempo;
  }

  setBeatsPerBar(value) {
    this.beatsPerBar = clampInteger(value, 1, 17, this.beatsPerBar);
    this.#beatIndex = 0;
    return this.beatsPerBar;
  }

  setAccent(enabled) {
    this.accent = Boolean(enabled);
  }

  setGain(value) {
    this.gain = clampInteger(value, -36, 18, this.gain);
    this.#applyGain();
    return this.gain;
  }

  configureTarget({ enabled, target, step, barsPerChange }) {
    this.#ramp.configure({
      enabled: Boolean(enabled),
      target: clampInteger(target, 40, 240, this.tempo),
      step: clampInteger(step, 1, 30, 4),
      barsPerChange: clampInteger(barsPerChange, 1, 16, 2),
    });
  }

  dispose() {
    this.stop();
    this.#loop?.dispose();
    this.#sampler?.dispose();
    this.#loop = null;
    this.#sampler = null;
    this.isReady = false;
  }

  #applyGain() {
    if (this.#sampler) {
      this.#sampler.volume.value = this.gain === -36 ? -Infinity : this.gain;
    }
  }

  #tick(time) {
    if (!this.#sampler) {
      return;
    }

    const beatNumber = this.#beatIndex + 1;
    const isAccentedBeat = this.accent && this.#beatIndex === 0;
    const notes = isAccentedBeat ? ["C3", "E3", "G3"] : "C3";
    const velocity = isAccentedBeat ? 1 : 0.8;
    const tempoChange = this.#beatIndex === 0 ? this.#ramp.beginBar() : null;

    this.#sampler.triggerAttackRelease(notes, "16n", time, velocity);
    getDraw().schedule(() => {
      if (tempoChange !== null && this.tempo === tempoChange) {
        this.onTempoChange(tempoChange, "target");
      }

      this.onBeat(beatNumber, this.beatsPerBar);
    }, time);

    this.#beatIndex += 1;
    if (this.#beatIndex < this.beatsPerBar) {
      return;
    }

    this.#beatIndex = 0;
    const nextTempo = this.#ramp.completeBar(this.tempo);
    if (nextTempo === null) {
      return;
    }

    this.tempo = nextTempo;
    this.transport.bpm.value = nextTempo;
  }
}
