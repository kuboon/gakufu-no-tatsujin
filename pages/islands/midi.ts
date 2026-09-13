/**
 * MIDI keyboards, where the browser has them.
 *
 * The game already speaks MIDI note numbers — a note, a key and a colour are all indexed by one —
 * so a MIDI keyboard needs no translation at all. What is left is reading the wire format, and
 * noticing a device plugged in after the page loaded.
 *
 * This is an extra, never a way in. Safari has never shipped Web MIDI, so a browser without it
 * simply never sees any of this, and the touch and typing keyboards are untouched. Access is asked
 * for only when the player presses the button that asks for it: the browser shows a permission
 * prompt, and one that appears unbidden on a game's front page is a good way to be refused.
 */

/** What a note message says. */
export interface NoteMessage {
  action: "press" | "release";
  midi: number;
}

/** Status bytes, with the channel nibble masked off. */
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/**
 * Reads one MIDI message, or nothing when it is not about a note.
 *
 * @param data The message's bytes, as the browser hands them over
 * @returns The note it presses or releases, or null for everything else
 */
export function readMessage(data: Uint8Array): NoteMessage | null {
  if (data.length < 3) return null;
  const status = data[0] & 0xf0;
  const midi = data[1] & 0x7f;

  // A note-on with no velocity is how much hardware says note-off — it lets a
  // run of notes share one status byte.
  if (status === NOTE_ON) {
    return { action: (data[2] & 0x7f) > 0 ? "press" : "release", midi };
  }
  if (status === NOTE_OFF) return { action: "release", midi };
  return null;
}

/** What the game does with what the keyboard sends. */
export interface MidiHandlers {
  press(midi: number): void;
  release(midi: number): void;
  /** The instruments now attached, by name, whenever that changes. */
  devices(names: readonly string[]): void;
}

/** Whether this browser has Web MIDI at all. Safari does not. */
export function midiSupported(): boolean {
  return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
}

/**
 * Listens to every MIDI keyboard, including ones plugged in later.
 *
 * @param handlers What to do with the notes, and with the list of instruments
 * @param signal Stops listening, and lets go of anything still held
 * @returns True once the browser has granted access
 */
export async function listenMidi(
  handlers: MidiHandlers,
  signal: AbortSignal,
): Promise<boolean> {
  const ask = (navigator as Navigator & {
    requestMIDIAccess?: () => Promise<MidiAccess>;
  }).requestMIDIAccess;
  if (ask === undefined) return false;

  let access: MidiAccess;
  try {
    access = await ask.call(navigator);
  } catch {
    // Refused, or the browser has no business granting it.
    return false;
  }
  if (signal.aborted) return false;

  // Held here rather than asked of the session, so releasing on the way out
  // does not depend on which song happens to be playing.
  const held = new Set<number>();

  const receive = (event: MidiMessageEvent): void => {
    const note = readMessage(event.data);
    if (note === null) return;
    if (note.action === "press") {
      held.add(note.midi);
      handlers.press(note.midi);
    } else {
      held.delete(note.midi);
      handlers.release(note.midi);
    }
  };

  const attach = (): void => {
    const names: string[] = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = receive;
      names.push(input.name ?? "MIDI");
    }
    handlers.devices(names);
  };

  attach();
  // A keyboard switched on after the game started is the common case, not the
  // exception: the browser hands over an empty list and fills it in later.
  access.onstatechange = attach;

  signal.addEventListener("abort", () => {
    access.onstatechange = null;
    for (const input of access.inputs.values()) input.onmidimessage = null;
    for (const midi of held) handlers.release(midi);
    held.clear();
  });

  return true;
}

/**
 * The slice of Web MIDI this game uses.
 *
 * Declared here because the DOM types Deno ships do not carry Web MIDI, and
 * naming only what is used says plainly how little of the API is in play.
 */
interface MidiAccess {
  readonly inputs: ReadonlyMap<string, MidiInput>;
  onstatechange: (() => void) | null;
}

interface MidiInput {
  readonly name: string | null;
  onmidimessage: ((event: MidiMessageEvent) => void) | null;
}

interface MidiMessageEvent {
  readonly data: Uint8Array;
}
