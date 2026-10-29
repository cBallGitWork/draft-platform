import { beforeEach, expect, test } from "vitest";
import { bylineOf } from "../../../convex/mail/letters";
import { adminByline } from "../../../convex/mail/letterWords";
import { ADMIN, MANAGERS } from "../../support/convex/leagues.harness";
import { signInDeployment } from "../../support/convex/signIn.harness";

// How whoever did something is named in letters, refusals and the Transactions tab: the admin by
// adminByline, anyone else by their email.

const [ANN] = MANAGERS;

beforeEach(async () => {
  await signInDeployment();
});

test("the admin's email is named by the admin's byline", () => {
  expect(bylineOf(ADMIN)).toBe(adminByline);
});

test("anyone else's email names them as itself", () => {
  expect(bylineOf(ANN)).toBe(ANN);
});
