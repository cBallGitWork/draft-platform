// The app project's setup (vitest.config.ts): whatever a test rendered, a screen or a hook, is
// unmounted after it and only then is the address put back to "/" (the app must unmount before
// history is reset), so no test file needs its own afterEach for either. The router restores scroll
// on every navigation, and jsdom has no scrolling to restore, so scrollTo does nothing here.

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
