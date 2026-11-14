import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { SITE_VERSION } from "../../../convex/shared/siteVersion";
import { freshConvex } from "../../support/convex/test.harness";

// The server's version, which an open tab compares with its own to know a release is out that its
// code can't work with (spec/12, The frame). `S12.13`

test("the server answers anyone, signed in or not, with the version it holds now", async () => {
  expect(await freshConvex().query(api.release.version.current, {})).toBe(SITE_VERSION);
});
