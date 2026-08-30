import { assertAlmostEquals, assertEquals } from "@std/assert";

import { keyboardLayout, keyRange, typingMap } from "../islands/keyboard.ts";
import { midiFromName } from "../islands/music.ts";

Deno.test("a range widens to whole white keys", () => {
  assertEquals(keyRange(midiFromName("C4"), midiFromName("A4")), {
    from: 60,
    to: 69,
  });
  // C#4 up to A#4 reaches out to the white keys either side.
  assertEquals(keyRange(61, 70), { from: 60, to: 71 });
});

Deno.test("white keys tile the width and black keys straddle the seams", () => {
  const keys = keyboardLayout(60, 72);
  const whites = keys.filter((key) => !key.black);
  const blacks = keys.filter((key) => key.black);

  assertEquals(whites.length, 8);
  assertEquals(blacks.length, 5);
  assertAlmostEquals(whites[0].left, 0);
  assertAlmostEquals(
    whites[whites.length - 1].left + whites[whites.length - 1].width,
    1,
  );

  for (let i = 1; i < whites.length; i++) {
    assertAlmostEquals(
      whites[i].left,
      whites[i - 1].left + whites[i - 1].width,
    );
  }

  // C#4 sits centred on the seam between C4 and D4.
  const seam = whites[1].left;
  assertAlmostEquals(blacks[0].left + blacks[0].width / 2, seam);
});

Deno.test("the computer keyboard lands where a piano would", () => {
  const typed = typingMap(keyboardLayout(60, 72));
  assertEquals(typed.get("a"), 60);
  assertEquals(typed.get("w"), 61);
  assertEquals(typed.get("s"), 62);
  assertEquals(typed.get("k"), 72);
  assertEquals(typed.get("z"), undefined);
});
