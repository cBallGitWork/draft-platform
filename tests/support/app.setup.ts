// The app project's setup (vitest.config.ts): whatever a test rendered, a screen or a hook, is
// unmounted after it, so no test file needs its own afterEach(cleanup).

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
