// The table screen's tests' opener (tests/src/table/*.test.tsx): the app at the table, for the
// manager, with the fake seam's data (table.harness.ts).

import { TABLE_PATH } from "../../../src/frame/menu";
import { manager, openApp } from "./shell.harness";
import type { TableData } from "./table.harness";

export const openTable = (table: TableData = {}) => openApp(TABLE_PATH, manager, { table });
