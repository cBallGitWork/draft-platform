// The allowed list (convex/signIn/allowedEmails.ts): who may ask for a sign-in link.

import { beforeEach, describe, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { LISTED, signInDeployment } from "../../support/convex/signIn.harness";
import type { TestConvex } from "../../support/convex/test.harness";

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});

describe("the allowed list", () => {
  test("adding an email twice keeps one row, stored trimmed and lower-cased", async () => {
    expect(await t.mutation(internal.signIn.allowedEmails.add, { email: " New@Example.com" })).toBe("added");
    expect(await t.mutation(internal.signIn.allowedEmails.add, { email: "new@example.com" })).toBe("already on the list");

    const rows = await t.run((ctx) => ctx.db.query("allowedEmails").collect());
    expect(rows.map((row) => row.email)).toEqual([LISTED, "new@example.com"]);
  });

  test("something that isn't an email address is refused, not stored", async () => {
    await expect(t.mutation(internal.signIn.allowedEmails.add, { email: "craig" })).rejects.toThrow("isn't an email address");
  });
});
