export function clampInteger(value, minimum, maximum, fallback = minimum) {
  const numericValue = Number(value);
  const fallbackValue = Number(fallback);
  const safeValue = Number.isFinite(numericValue) ? numericValue : fallbackValue;

  return Math.min(maximum, Math.max(minimum, Math.round(safeValue)));
}

export class TapTempo {
  constructor({ minimum = 40, maximum = 240, resetAfter = 1500, sampleSize = 4 } = {}) {
    this.minimum = minimum;
    this.maximum = maximum;
    this.resetAfter = resetAfter;
    this.sampleSize = sampleSize;
    this.lastTap = null;
    this.intervals = [];
  }

  record(timestamp) {
    if (this.lastTap === null || timestamp <= this.lastTap || timestamp - this.lastTap > this.resetAfter) {
      this.lastTap = timestamp;
      this.intervals = [];
      return null;
    }

    this.intervals.push(timestamp - this.lastTap);
    this.intervals = this.intervals.slice(-this.sampleSize);
    this.lastTap = timestamp;

    const averageInterval = this.intervals.reduce((sum, interval) => sum + interval, 0) / this.intervals.length;
    return clampInteger(60_000 / averageInterval, this.minimum, this.maximum);
  }

  reset() {
    this.lastTap = null;
    this.intervals = [];
  }
}

export class TempoRamp {
  constructor({ enabled = false, target = 144, step = 4, barsPerChange = 2 } = {}) {
    this.enabled = enabled;
    this.target = target;
    this.step = step;
    this.barsPerChange = barsPerChange;
    this.completedBars = 0;
  }

  configure({ enabled, target, step, barsPerChange }) {
    if (enabled !== this.enabled) {
      this.completedBars = 0;
    }

    this.enabled = enabled;
    this.target = target;
    this.step = step;
    this.barsPerChange = barsPerChange;
  }

  completeBar(currentTempo) {
    if (!this.enabled || currentTempo >= this.target) {
      return null;
    }

    this.completedBars += 1;
    if (this.completedBars < this.barsPerChange) {
      return null;
    }

    this.completedBars = 0;
    return Math.min(this.target, currentTempo + this.step);
  }

  reset() {
    this.completedBars = 0;
  }
}
