/**
 * The sound: a small synthesised piano, and the clock the whole game runs on.
 *
 * Scrolling and judging both read {@link Tones.now}, which is the audio clock rather than
 * `performance.now()`. A note you hear and a note you see are then the same event: they cannot
 * drift apart the way two independent clocks would.
 */

/** Oscillator, frequency ratio and mix level of each partial in the tone. */
const VOICES: readonly (readonly [OscillatorType, number, number])[] = [
  ["triangle", 1, 0.62],
  ["sine", 2, 0.24],
  ["sine", 3, 0.09],
];

/** Frequency of a MIDI note, A4 = 440 Hz. */
function frequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The audio context, created on the first gesture and shared by every sound the game makes. */
export class Tones {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  /** Wall clock minus audio clock, so the two agree if the audio one stops. */
  #drift: number | null = null;

  /**
   * Opens the audio context. Browsers only allow this from a user gesture, so it is called when a
   * song is picked rather than when the page loads.
   */
  async unlock(): Promise<void> {
    const context = this.#open();
    if (context !== null && context.state !== "running") {
      await context.resume().catch(() => {});
    }
  }

  /**
   * Seconds on the game clock.
   *
   * The audio clock leads whenever it is actually running, so what you hear and what you see stay
   * the same event. A context that is missing or suspended — a browser that would not open one, a
   * tab that lost its audio — hands the wall clock back instead, carrying the offset across so the
   * song never jumps at the seam.
   */
  now(): number {
    const wall = performance.now() / 1000;
    const context = this.#open();
    if (context !== null && context.state === "running") {
      this.#drift = wall - context.currentTime;
      return context.currentTime;
    }
    this.#drift ??= wall;
    return wall - this.#drift;
  }

  /** Plays a note, at a time on the same clock {@link now} reads. */
  note(midi: number, at: number, seconds: number, level = 1): void {
    const context = this.#open();
    const master = this.#master;
    if (context === null || master === null) return;

    const start = Math.max(at, context.currentTime);
    const hold = Math.min(Math.max(seconds, 0.3), 1.8);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(level * 0.3, start + 0.14);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + hold + 0.22);
    envelope.connect(master);

    for (const [type, ratio, mix] of VOICES) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency(midi) * ratio;
      const partial = context.createGain();
      partial.gain.value = mix;
      oscillator.connect(partial).connect(envelope);
      oscillator.start(start);
      oscillator.stop(start + hold + 0.3);
    }
  }

  /** A metronome tick: bright on a downbeat, soft in between. */
  tick(at: number, accent: boolean): void {
    const context = this.#open();
    const master = this.#master;
    if (context === null || master === null) return;

    const start = Math.max(at, context.currentTime);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(accent ? 0.5 : 0.24, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    envelope.connect(master);

    const oscillator = context.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = accent ? 1760 : 1174;
    oscillator.connect(envelope);
    oscillator.start(start);
    oscillator.stop(start + 0.1);
  }

  /** Closes the context. */
  dispose(): void {
    this.#context?.close().catch(() => {});
    this.#context = null;
    this.#master = null;
  }

  #open(): AudioContext | null {
    if (this.#context === null && typeof AudioContext === "function") {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0.3;
      master.connect(context.destination);
      this.#context = context;
      this.#master = master;
    }
    return this.#context;
  }
}
