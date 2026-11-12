import { expect, test, vi } from "vitest";
import { switchableLeagues } from "../../../convex/leagues/lastLeague";
import { leaguesToWriteFrom } from "../../../src/mail/MailPage";
import { previewNames, previewSession } from "../../../src/app/preview";
import { previewUrl } from "../../support/smoke/previewUrl";

/** The preview session the app reads on load, with the address bar at `search`. */
function previewOnLoad(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  return previewSession();
}

test("on the dev server, ?preview=manager opens the signed-in frame, in a league", () => {
  vi.stubEnv("DEV", true);
  expect(previewOnLoad("?preview=manager")).toMatchObject({ signedIn: true, isAdmin: false, inLeague: true });
});

test("on the dev server, ?preview=commissioner runs both of the manager's leagues, so Mail offers each; ?preview=manager runs neither", () => {
  vi.stubEnv("DEV", true);
  const named = (session: ReturnType<typeof previewSession>) => (session ? leaguesToWriteFrom(session).map((league) => league.name) : null);
  expect(named(previewOnLoad("?preview=commissioner"))).toEqual(["Tim Hortons Pro League", "Mini beta"]);
  expect(named(previewOnLoad("?preview=manager"))).toEqual([]);
});

test("on the dev server, ?preview=newcomer and ?preview=admin are signed in to no league, and only admin is the admin", () => {
  vi.stubEnv("DEV", true);
  expect(previewOnLoad("?preview=newcomer")).toMatchObject({ signedIn: true, isAdmin: false, inLeague: false });
  expect(previewOnLoad("?preview=admin")).toMatchObject({ signedIn: true, isAdmin: true, inLeague: false });
});

test("#488: on the dev server, each signed-in preview person's switcher lists the leagues the server's rule would, and the app is in the first", () => {
  vi.stubEnv("DEV", true);
  for (const name of previewNames) {
    const session = previewOnLoad(`?preview=${name}`);
    if (!session?.signedIn) continue;
    const switchable = switchableLeagues(session.leagues).map((league) => league.leagueId);
    expect(session.switchableLeagueIds, name).toEqual(switchable);
    expect(session.currentLeagueId, name).toBe(switchable[0] ?? null);
  }
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

test("the smoke specs' previewUrl names the session after any search the path carries, and the app reads it back", () => {
  vi.stubEnv("DEV", true);
  expect(previewUrl("/table", "manager")).toBe("/table?preview=manager");
  expect(previewUrl("/matchup?minute=60", "commissioner")).toBe("/matchup?minute=60&preview=commissioner");
  window.history.replaceState(null, "", previewUrl("/matchup?minute=60", "visitor"));
  expect(previewSession()).toEqual({ signedIn: false });
});
