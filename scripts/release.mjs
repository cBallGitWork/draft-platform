#!/usr/bin/env node
// The production release, vercel.json's build command (spec/20, Every release and Rolling back):
// `npx convex deploy --cmd 'npm run build'`, with a backup taken first when the release changes
// saved data's shape, because reverting code doesn't bring back changed data.
//
// Whether the shape changed: a fingerprint of convex/schema.ts's tables and their document types
// (not its indexes, which hold no data), compared with the one the last release recorded on the
// live deployment as an environment variable. Convex has no documented way to read a deployment's
// schema back, so the release records its own. No record (a first release), or a schema this can't
// read, counts as a change: a backup too many costs nothing, a backup missed can lose a league.
//
// The backup is `npx convex export`, which asks Convex for a snapshot export, kept on the
// deployment's Backup & Restore page, and downloads a copy. Vercel's build is thrown away after,
// so the copy goes with it: the backup that lasts is the one Convex keeps. If the backup fails,
// nothing is deployed and the release stops, saying why. docs/setup.md says how to restore.
//
// Before any of that, it refuses a build that isn't production's, or that has no deploy key, and
// says why in the build log: a preview (a `vercel deploy` from the CLI, say) must never put its
// code on the live deployment, and without the key `convex deploy` can't reach it.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The live deployment's environment variable holding the last release's schema fingerprint. */
export const FINGERPRINT_ENV = "LIVE_SCHEMA_FINGERPRINT";
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
const FINGERPRINT_HASH = "sha256";
/** Vercel's name for the live site's environment, which it gives a build as VERCEL_ENV. */
export const VERCEL_PRODUCTION = "production";
/** The setting in Vercel that lets its build deploy the server code to the live deployment. */
export const DEPLOY_KEY_SETTING = "CONVEX_DEPLOY_KEY";
const VERCEL_ENV = "VERCEL_ENV";

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

/**
 * The fingerprint of a schema's saved shape: each table's name and document type, from Convex's
 * own serialised form of the schema (what `npx convex deploy` pushes).
 */
export function shapeFingerprint(schemaJson) {
  const { tables, schemaValidation } = JSON.parse(schemaJson);
  const shape = tables
    .map(({ tableName, documentType }) => ({ tableName, documentType }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
  return createHash(FINGERPRINT_HASH).update(JSON.stringify({ schemaValidation, shape })).digest("hex");
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

/** Runs `npx convex <args>`. Captured output is echoed, so the build log shows everything. */
export function convexCli(args, { capture = false } = {}) {
  const result = spawnSync("npx", ["convex", ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (capture) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
}

const failure = (result) => (result.error?.message ?? result.stderr.trim()) || `exit ${result.status}`;

/**
 * The release: back up if the shape changed, deploy, then record the shape now live.
 * `fingerprint` is null when the schema couldn't be read. Returns the exit code.
 */
export function release({ convex, fingerprint, backupPath, log = console.log }) {
  const recorded = convex(["env", "get", FINGERPRINT_ENV], { capture: true });
  if (recorded.status !== 0) {
    log(`${STOPPED}: couldn't read ${FINGERPRINT_ENV} from the live deployment (${failure(recorded)}).`);
    return 1;
  }
  const live = recorded.stdout.trim() || null;

  if (fingerprint !== null && fingerprint === live) {
    log("Saved data's shape is unchanged since the last release: no backup needed.");
  } else {
    log(
      fingerprint === null
        ? `Couldn't read ${SCHEMA_PATH}'s shape, so taking a backup first, to be safe.`
        : live === null
          ? "The live deployment has no record of its schema yet (a first release): taking a backup first."
          : `This release changes saved data's shape (${SCHEMA_PATH}): taking a backup first.`,
    );
    const backup = convex(["export", "--path", backupPath], { capture: true });
    if (backup.status !== 0) {
      log(
        `${STOPPED}: it changes saved data's shape and the backup before it failed (${failure(backup)}). ` +
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

  const deployed = convex(DEPLOY_ARGS);
  if (deployed.status !== 0) return deployed.status;

  if (fingerprint !== null && fingerprint !== live) {
    const saved = convex(["env", "set", FINGERPRINT_ENV, fingerprint], { capture: true });
    if (saved.status !== 0) {
      // Live already: failing the build now would only hide that. The next release backs up again.
      log(`Released, but couldn't record the schema's fingerprint (${failure(saved)}): the next release will take a backup it may not need.`);
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
  let fingerprint = null;
  try {
    fingerprint = shapeFingerprint(await schemaJson());
  } catch (error) {
    console.log(`Reading ${SCHEMA_PATH}'s shape failed: ${error.message}`);
  }
  const dir = mkdtempSync(join(tmpdir(), BACKUP_DIR_PREFIX));
  try {
    return release({ convex: convexCli, fingerprint, backupPath: join(dir, BACKUP_FILE) });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(await main());
