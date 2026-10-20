import { afterEach, expect, test, vi } from "vitest";

/** isSignedIn as the app reads it on load, with the address bar at `search`. */
async function signedInOnLoad(search: string): Promise<boolean> {
  window.history.replaceState(null, "", `/${search}`);
  vi.resetModules();
  const { isSignedIn } = await import("./auth");
  return isSignedIn();
}

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

test("on the dev server, ?preview=manager opens the signed-in frame", async () => {
  vi.stubEnv("DEV", true);
  expect(await signedInOnLoad("?preview=manager")).toBe(true);
});

test("in the built site, ?preview=manager leaves a visitor signed out", async () => {
  vi.stubEnv("DEV", false);
  expect(await signedInOnLoad("?preview=manager")).toBe(false);
});

test("without ?preview=manager, nobody is signed in, even on the dev server", async () => {
  vi.stubEnv("DEV", true);
  expect(await signedInOnLoad("")).toBe(false);
});
