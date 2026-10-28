import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { ErrorScreen } from "./frame/ErrorScreen";
import { frameChildren } from "./routes/frame";
import { leaguePagesChildren } from "./routes/leaguePages";
import { frameRoute, leaguePagesRoute, rootRoute, signInRoute, type ShellContext } from "./routes/root";

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

// Not registered for typed links yet: the pages above are made in a loop, so their paths are plain
// strings. Each screen that gets built gets its own route, and the types come with them.
export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history, defaultErrorComponent: ErrorScreen });
}
