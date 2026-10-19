import {
  Navigate,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { AppFrame } from "./frame/AppFrame";
import type { TopBarState } from "./frame/topBarState";
import { MY_TEAM_PATH, pages } from "./frame/menu";
import { PageNotBuilt } from "./frame/PageNotBuilt";
import { SignInPage } from "./sign-in/SignInPage";

export type ShellContext = { signedIn: boolean; topBar: TopBarState };

export const SIGN_IN_PATH = "/sign-in";

// Any address nobody knows goes back to `/`, which the guards below send on: to the sign-in page
// for a visitor, to My team for a manager. So a visitor only ever sees the sign-in page (spec/12).
const rootRoute = createRootRouteWithContext<ShellContext>()({
  component: Outlet,
  notFoundComponent: () => <Navigate to="/" replace />,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: SIGN_IN_PATH,
  beforeLoad: ({ context }) => {
    if (context.signedIn) throw redirect({ to: MY_TEAM_PATH });
  },
  component: SignInPage,
});

const frameRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "frame",
  beforeLoad: ({ context }) => {
    if (!context.signedIn) throw redirect({ to: SIGN_IN_PATH });
  },
  component: function Frame() {
    return <AppFrame topBar={frameRoute.useRouteContext({ select: (context) => context.topBar })} />;
  },
});

// A signed-in manager lands on My team (spec/12).
const landingRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: MY_TEAM_PATH });
  },
});

const pageRoutes = pages.map((page) =>
  createRoute({
    getParentRoute: () => frameRoute,
    path: page.path,
    component: () => <PageNotBuilt title={page.label} />,
  }),
);

const routeTree = rootRoute.addChildren([signInRoute, frameRoute.addChildren([landingRoute, ...pageRoutes])]);

// Not registered for typed links yet: the pages above are made in a loop, so their paths are plain
// strings. Each screen that gets built gets its own route, and the types come with them.
export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history });
}
