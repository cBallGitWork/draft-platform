// The app project's setup (vitest.config.ts): whatever a test rendered, a screen or a hook, is
// unmounted after it, so no test file needs its own afterEach(cleanup). The router restores scroll
// on every navigation, and jsdom has no scrolling to restore, so scrollTo does nothing here.

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

window.scrollTo = () => {};

afterEach(cleanup);
