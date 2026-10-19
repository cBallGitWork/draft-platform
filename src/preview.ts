// The signed-in frame without signing in, for screenshots: `/?preview=manager` on the dev server
// (the ui-verifier agent's way in). `import.meta.env.DEV` is false in `vite build`, so the
// production bundle drops this and a logged-out visitor can never reach the frame through it.

import type { TopBarState } from "./frame/topBarState";
import { MAIL_PATH } from "./frame/menu";

export const previewing =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "manager";

/** Made-up figures, so the shot shows Mail's count and Continue in use. */
export const previewTopBar: TopBarState = { unreadMail: 3, next: { path: MAIL_PATH, reason: "3 unread letters" } };
