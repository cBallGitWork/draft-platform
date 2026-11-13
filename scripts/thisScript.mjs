// What every script asks of itself (#1723): was it run directly, and where is the checkout it sits in.

import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The checkout's root: the folder above scripts/. */
export const CHECKOUT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Whether the module at `metaUrl` (its `import.meta.url`) is the one node was run with, not an import. */
export const ranDirectly = (metaUrl) => process.argv[1] !== undefined && metaUrl === pathToFileURL(process.argv[1]).href;
