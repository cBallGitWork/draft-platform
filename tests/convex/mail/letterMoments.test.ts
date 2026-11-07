import { expect, test } from "vitest";
import { letterAsRead, marking } from "../../../convex/mail/letterMoments";
import { momentIn } from "../../../convex/shared/moments";

// A letter keeps the moments it names and tells them in the reader's zone as they read it (#912,
// Craig 1 Nov 2026: "users time zone").

const SYDNEY = "Australia/Sydney";
/** Wednesday 21 October 2026, 10:00 in London (BST). */
const AT = Date.UTC(2026, 9, 21, 9, 0);
const LATER = AT + 86_400_000;

test("each moment is marked as filed, and told in whichever zone the reader is in as they read it", () => {
  const { tell, moments } = marking();
  const letter = { subject: `Due ${tell(AT)}`, body: `From ${tell(AT)} to ${tell(LATER)}.` };
  const filed = { ...letter, moments };

  expect(letterAsRead(filed, SYDNEY)).toEqual({
    subject: `Due ${momentIn(AT, SYDNEY)}`,
    body: `From ${momentIn(AT, SYDNEY)} to ${momentIn(LATER, SYDNEY)}.`,
  });
  expect(letterAsRead(filed, undefined).body).toBe(`From ${momentIn(AT, undefined)} to ${momentIn(LATER, undefined)}.`);
});

test("a letter that names no moment reads as written, a typed mark too", () => {
  const typed = { subject: "Kick-off", body: "See {moment:0} for when." };
  expect(letterAsRead(typed, SYDNEY)).toEqual(typed);
});
