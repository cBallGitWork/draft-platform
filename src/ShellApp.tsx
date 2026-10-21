import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createShellRouter, type ShellContext } from "./router";

/** The app's screens for a session. When the session changes (signed in, or out), the routes'
 *  guards run again, so a signed-out visitor is sent to the sign-in page from wherever they were. */
export function ShellApp({ history, ...context }: ShellContext & { history?: RouterHistory }) {
  const [router] = useState(() => createShellRouter(context, history));
  const { session } = context;
  useEffect(() => {
    void router.invalidate();
  }, [router, session]);
  return <RouterProvider router={router} context={context} />;
}
