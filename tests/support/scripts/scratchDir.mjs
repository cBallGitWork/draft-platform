import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestFinished } from "vitest";

/** A fresh folder in the machine's temp folder, its name starting `prefix`, for a script test to
 *  write in: removed once the test that made it ends, passed or failed. Call it inside a test or its
 *  beforeEach. */
export function scratchDir(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  onTestFinished(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
