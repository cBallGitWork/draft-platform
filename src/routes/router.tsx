import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { ErrorScreen } from "../frame/ErrorScreen";
import { frameChildren } from "./frame";
import { leaguePagesChildren } from "./leaguePages";
import { frameRoute, leaguePagesRoute, rootRoute, signInRoute, type ShellContext } from "./root";

export type { ShellContext };

// The app's routes, assembled: root.tsx holds the root, the guards, sign-in and the two frames, and
// leaguePages.tsx and frame.tsx the pages under each.
//
// Addresses: a menu page's is in frame/menu.ts, which builds the menu from them; the landing `/` is
// in routes/root.tsx; every other page's is in its feature's paths.ts, or, where the server writes
// it into an email too, in convex/ (joining/joiningShared.ts's JOIN_PATH). A `*_PATH` is a plain address;
// a `*_ROUTE` is a template with `$` params, as the router matches it, filled in by its `*Path(...)`
// where a link needs one (leagues/paths.ts, `leaguePage`).

const routeTree = rootRoute.addChildren([
  signInRoute,
  leaguePagesRoute.addChildren(leaguePagesChildren),
  frameRoute.addChildren(frameChildren),
]);

export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history, defaultErrorComponent: ErrorScreen });
}

// Registered, so a link's `to`, `params` and `search` are checked against the routes when the code
// is built: a link to a page renamed or moved fails the typecheck rather than reaching a manager.
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createShellRouter>;
  }
}
