import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { ErrorScreen } from "./frame/ErrorScreen";
import { frameChildren } from "./routes/frame";
import { leaguePagesChildren } from "./routes/leaguePages";
import { frameRoute, leaguePagesRoute, rootRoute, signInRoute, type ShellContext } from "./routes/root";

export type { ShellContext };

// The app's routes, assembled: root.tsx holds the root, the guards, sign-in and the two frames, and
// leaguePages.tsx and frame.tsx the pages under each.

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
