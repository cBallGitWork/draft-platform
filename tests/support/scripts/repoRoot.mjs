import { join } from "node:path";

/** The repository's root, for script tests that read its files or run its scripts from there. */
export const REPO_ROOT = join(import.meta.dirname, "../../..");
