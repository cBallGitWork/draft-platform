#!/usr/bin/env node
// The production release, vercel.json's build command (spec/20, Every release and Rolling back):
// `npx convex deploy --cmd 'npm run build'`, with a backup taken first when the release could
// strand saved data (a table or field removed, or a type narrowed), because reverting code doesn't
// bring back dropped data. A release that only adds tables or fields, or widens a type, takes none:
// each backup is a full export, read against the Convex plan's database allowance (#1996).
//
// What is live: the shape of convex/schema.ts's tables and their document types
// (scripts/schema-shape.mjs), which the last release recorded on the live deployment as environment
// variables, its fingerprint in one and the shape itself, compressed, in as many as it needs.
// Convex has no documented way to read a deployment's schema back, so the release records its own.
// No record (a first release), a record that doesn't match its fingerprint, or a schema this can't
// read counts as stranding: a backup too many costs a little, a backup missed can lose a league.
//
// The backup is `npx convex export`, which asks Convex for a snapshot export, kept on the
// deployment's Backup & Restore page, and downloads a copy. Vercel's build is thrown away after,
// so the copy goes with it: the backup that lasts is the one Convex keeps. If the backup fails,
// nothing is deployed and the release stops, saying why. docs/setup.md says how to restore.
//
// Just before deploying, it sets TIMED_JOBS_ON on the live deployment, which runs the timed feed,
// waiver and trade jobs there and only there (#1997); if it can't, nothing is deployed.
//
// Before any of that, it refuses a build that isn't production's, or that has no deploy key, and
// says why in the build log: a preview (a `vercel deploy` from the CLI, say) must never put its
// code on the live deployment, and without the key `convex deploy` can't reach it.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { TIMED_JOBS_SETTING } from "../convex/outbound/deploymentSettings.ts";
import { fingerprintOf, savedShape, shapeFromParts, shapeParts, strandedIn } from "./schema-shape.mjs";
import { ranDirectly } from "./thisScript.mjs";

/** The live deployment's environment variable holding the last release's schema fingerprint. */
export const FINGERPRINT_ENV = "LIVE_SCHEMA_FINGERPRINT";
/** The live deployment's environment variables holding the last release's shape, numbered from 1. */
export const SHAPE_ENV_PREFIX = "LIVE_SCHEMA_SHAPE_";
/** The most variables the shape is read from or recorded in, far more than today's schema needs (two, 13 Nov 2026). */
export const SHAPE_PARTS_MAX = 20;
/** What each release sets `TIMED_JOBS_SETTING` to on the live deployment: any value turns them on. */
export const TIMED_JOBS_ON = "on";
const SCHEMA_PATH = "convex/schema.ts";
export const DEPLOY_ARGS = ["deploy", "--cmd", "npm run build"];
const BACKUP_FILE = "backup.zip";
/** The dashboard page where Convex keeps the backups. */
const BACKUP_PAGE = "the production deployment's Backup & Restore page";
const STOPPED = "Release stopped, nothing went live";
const SCHEMA_BUNDLE_PREFIX = ".release-schema-";
const BACKUP_DIR_PREFIX = "release-backup-";
/** What `npx convex export` prints once Convex has the snapshot (convex/dist/esm/cli/lib/convexExport.js). */
const SNAPSHOT_TAKEN = /Created snapshot export at timestamp (\d+)/;
/** Vercel's name for the live site's environment, which it gives a build as VERCEL_ENV. */
export const VERCEL_PRODUCTION = "production";
/** The setting in Vercel that lets its build deploy the server code to the live deployment. */
export const DEPLOY_KEY_SETTING = "CONVEX_DEPLOY_KEY";
/** The variable a Vercel build reads its environment from. */
export const VERCEL_ENV = "VERCEL_ENV";

/** Why this build mustn't release, or null when it may. Outside Vercel there is no VERCEL_ENV,
 *  and the key alone decides. */
export function refusal(env) {
  const environment = env[VERCEL_ENV];
  if (environment && environment !== VERCEL_PRODUCTION) {
    return `${STOPPED}: this is a ${environment} build (${VERCEL_ENV}=${environment}), and only a ${VERCEL_PRODUCTION} build deploys to the live database.`;
  }
  if (!env[DEPLOY_KEY_SETTING]) {
    return (
      `${STOPPED}: ${DEPLOY_KEY_SETTING} isn't set, so this build can't reach the live deployment. ` +
      `Vercel holds it for ${VERCEL_PRODUCTION} builds only; \`npm run setup:live\` puts it there (docs/setup.md).`
    );
  }
  return null;
}

/** Bundles convex/schema.ts with esbuild, Convex's own bundler, and reads its serialised form. */
export async function schemaJson(schemaPath = SCHEMA_PATH) {
  const { build } = await import("esbuild");
  const bundled = await build({
    entryPoints: [schemaPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    packages: "external",
  });
  // Written beside the schema so its packages resolve from this checkout's node_modules.
  const file = join(process.cwd(), `${SCHEMA_BUNDLE_PREFIX}${process.pid}.mjs`);
  writeFileSync(file, bundled.outputFiles[0].text);
  try {
    const { default: schema } = await import(pathToFileURL(file).href);
    return schema.export(); // marked internal in Convex's types, so a missing one is caught below
  } finally {
    rmSync(file, { force: true });
  }
}

/**
 * Runs `npx convex <args>`. Captured output is echoed, so the build log shows everything, except
 * its standard output when `quiet` (a recorded shape, kilobytes of compressed text).
 */
export function convexCli(args, { capture = false, quiet = false } = {}) {
  const result = spawnSync("npx", ["convex", ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (capture) {
    if (!quiet) process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
}

const failure = (result) => (result.error?.message ?? result.stderr.trim()) || `exit ${result.status}`;
const shapeEnv = (n) => `${SHAPE_ENV_PREFIX}${n}`;
/** The value of the shape's `n`th variable, "" when unset, or null when it can't be read. */
function shapePart(convex, n) {
  const part = convex(["env", "get", shapeEnv(n)], { capture: true, quiet: true });
  return part.status === 0 ? part.stdout.trim() : null;
}

/** The shape the last release recorded, its parts in order; null when a read fails. */
function recordedParts(convex) {
  const parts = [];
  for (let n = 1; n <= SHAPE_PARTS_MAX; n++) {
    const part = shapePart(convex, n);
    if (part === null) return null;
    if (!part) break;
    parts.push(part);
  }
  return parts;
}

/** Why this release backs up first, or null when it strands nothing. */
function backupReason(convex, shape, live) {
  if (shape === null) return `Couldn't read ${SCHEMA_PATH}'s shape, so taking a backup first, to be safe.`;
  if (live === null) return "The live deployment has no record of its schema yet (a first release): taking a backup first.";
  const parts = recordedParts(convex);
  const liveShape = parts && shapeFromParts(parts, live);
  if (!liveShape) return "The live deployment's record of its schema can't be read, so taking a backup first, to be safe.";
  const stranded = strandedIn(liveShape, shape);
  return stranded === null ? null : `This release could strand saved data (${stranded}, in ${SCHEMA_PATH}): taking a backup first.`;
}

/** Records the shape now live: its parts, then any left from a longer one removed, then its fingerprint. */
function recordShape(convex, shape) {
  const parts = shapeParts(shape);
  // Past the cap the next release couldn't read it back, so it would back up every time: say so.
  if (parts.length > SHAPE_PARTS_MAX) {
    return { status: 1, stderr: `the shape needs ${parts.length} variables, over the ${SHAPE_PARTS_MAX} a release reads` };
  }
  for (const [at, part] of parts.entries()) {
    const set = convex(["env", "set", shapeEnv(at + 1), part], { capture: true });
    if (set.status !== 0) return set;
  }
  for (let n = parts.length + 1; n <= SHAPE_PARTS_MAX && shapePart(convex, n); n++) {
    const removed = convex(["env", "remove", shapeEnv(n)], { capture: true });
    if (removed.status !== 0) return removed;
  }
  const set = convex(["env", "set", FINGERPRINT_ENV, fingerprintOf(shape)], { capture: true });
  return set.status === 0 ? null : set;
}

/**
 * The release: back up if it could strand saved data, deploy, then record the shape now live.
 * `shape` is null when the schema couldn't be read. Returns the exit code.
 */
export function release({ convex, shape, backupPath, log = console.log }) {
  const recorded = convex(["env", "get", FINGERPRINT_ENV], { capture: true });
  if (recorded.status !== 0) {
    log(`${STOPPED}: couldn't read ${FINGERPRINT_ENV} from the live deployment (${failure(recorded)}).`);
    return 1;
  }
  const live = recorded.stdout.trim() || null;
  const fingerprint = shape && fingerprintOf(shape);
  const unchanged = fingerprint !== null && fingerprint === live;
  const reason = unchanged ? null : backupReason(convex, shape, live);

  if (unchanged) {
    log("Saved data's shape is unchanged since the last release: no backup needed.");
  } else if (reason === null) {
    log(`This release only adds to saved data's shape (${SCHEMA_PATH}), so it strands nothing: no backup needed.`);
  } else {
    log(reason);
    const backup = convex(["export", "--path", backupPath], { capture: true });
    if (backup.status !== 0) {
      log(
        `${STOPPED}: it could strand saved data and the backup before it failed (${failure(backup)}). ` +
          `Convex's free plan keeps two backups a deployment: if both are there, delete the older on ${BACKUP_PAGE}, then redeploy from Vercel.`,
      );
      return 1;
    }
    const snapshot = SNAPSHOT_TAKEN.exec(backup.stdout + backup.stderr)?.[1];
    log(
      snapshot
        ? `Backup taken: snapshot ${snapshot}, on ${BACKUP_PAGE}.`
        : `Backup taken, but the CLI printed no timestamp: it is the newest on ${BACKUP_PAGE}.`,
    );
  }

  // Before the code that reads it goes live, so the live site's timed jobs never stop (#1997).
  const jobsOn = convex(["env", "set", TIMED_JOBS_SETTING, TIMED_JOBS_ON], { capture: true });
  if (jobsOn.status !== 0) {
    log(`${STOPPED}: couldn't set ${TIMED_JOBS_SETTING} on the live deployment (${failure(jobsOn)}), and without it its feeds, waiver runs and trade offers stop.`);
    return 1;
  }

  const deployed = convex(DEPLOY_ARGS);
  if (deployed.status !== 0) return deployed.status;

  if (fingerprint !== null && !unchanged) {
    const failed = recordShape(convex, shape);
    if (failed) {
      // Live already: failing the build now would only hide that. The next release backs up again.
      log(`Released, but couldn't record the schema's shape (${failure(failed)}): the next release will take a backup it may not need.`);
    }
  }
  return 0;
}

async function main() {
  const refused = refusal(process.env);
  if (refused) {
    console.log(refused);
    return 1;
  }
  let shape = null;
  try {
    shape = savedShape(await schemaJson());
  } catch (error) {
    console.log(`Reading ${SCHEMA_PATH}'s shape failed: ${error.message}`);
  }
  const dir = mkdtempSync(join(tmpdir(), BACKUP_DIR_PREFIX));
  try {
    return release({ convex: convexCli, shape, backupPath: join(dir, BACKUP_FILE) });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (ranDirectly(import.meta.url)) process.exit(await main());
