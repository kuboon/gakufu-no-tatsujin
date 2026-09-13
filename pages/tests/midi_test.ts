import { assertEquals } from "@std/assert";

import { readMessage } from "../islands/midi.ts";

/** One MIDI message, as the browser hands it over. */
function message(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

Deno.test("a note-on presses, a note-off releases", () => {
  assertEquals(readMessage(message(0x90, 60, 100)), {
    action: "press",
    midi: 60,
  });
  assertEquals(readMessage(message(0x80, 60, 0)), {
    action: "release",
    midi: 60,
  });
});

Deno.test("a note-on with no velocity is a release, as the hardware means it", () => {
  assertEquals(readMessage(message(0x90, 64, 0)), {
    action: "release",
    midi: 64,
  });
});

Deno.test("the channel is not the game's business", () => {
  for (let channel = 0; channel < 16; channel += 1) {
    assertEquals(readMessage(message(0x90 | channel, 67, 90)), {
      action: "press",
      midi: 67,
    });
    assertEquals(readMessage(message(0x80 | channel, 67, 0)), {
      action: "release",
      midi: 67,
    });
  }
});

Deno.test("everything that is not a note is ignored", () => {
  assertEquals(readMessage(message(0xb0, 64, 127)), null, "control change");
  assertEquals(readMessage(message(0xe0, 0, 64)), null, "pitch bend");
  assertEquals(readMessage(message(0xf8)), null, "clock");
  assertEquals(readMessage(message(0x90, 60)), null, "a message cut short");
  assertEquals(readMessage(message()), null, "nothing at all");
});
