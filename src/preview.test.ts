import { afterEach, expect, test, vi } from "vitest";
import { previewSession } from "./preview";

/** The preview session the app reads on load, with the address bar at `search`. */
function previewOnLoad(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  return previewSession();
}

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

test("on the dev server, ?preview=manager opens the signed-in frame, in a league", () => {
  vi.stubEnv("DEV", true);
  expect(previewOnLoad("?preview=manager")).toMatchObject({ signedIn: true, isAdmin: false, inLeague: true });
});

test("on the dev server, ?preview=newcomer and ?preview=admin are signed in to no league, and only admin is the admin", () => {
  vi.stubEnv("DEV", true);
  expect(previewOnLoad("?preview=newcomer")).toMatchObject({ signedIn: true, isAdmin: false, inLeague: false });
  expect(previewOnLoad("?preview=admin")).toMatchObject({ signedIn: true, isAdmin: true, inLeague: false });
});

test("on the dev server, ?preview=visitor is signed out", () => {
  vi.stubEnv("DEV", true);
  expect(previewOnLoad("?preview=visitor")).toEqual({ signedIn: false });
});

test("in the built site, ?preview=manager is no preview: the app signs in for real", () => {
  vi.stubEnv("DEV", false);
  expect(previewOnLoad("?preview=manager")).toBeNull();
});

test.each(["", "?preview=toString", "?preview=nobody"])(
  "on the dev server, %j is no preview: the app signs in for real",
  (search) => {
    vi.stubEnv("DEV", true);
    expect(previewOnLoad(search)).toBeNull();
  },
);
