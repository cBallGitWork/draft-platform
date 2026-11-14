// Saved data's shape, for the release (scripts/release.mjs): what convex/schema.ts says each table
// holds, its fingerprint, how it is kept in the live deployment's environment variables, and
// whether a new shape could strand data the old one holds (spec/20, Rolling back; #1996).

import { createHash } from "node:crypto";
import { brotliCompressSync, brotliDecompressSync } from "node:zlib";

/** The most of the shape one environment variable holds: Convex caps a value at 8 KB. */
export const SHAPE_PART_LENGTH = 7000;
const SHAPE_ENCODING = "base64";
const FINGERPRINT_HASH = "sha256";

/**
 * A schema's saved shape: whether it is enforced, and each table's name and document type (not its
 * indexes, which hold no data), from Convex's own serialised form of the schema (what
 * `npx convex deploy` pushes).
 */
export function savedShape(schemaJson) {
  const { tables, schemaValidation } = JSON.parse(schemaJson);
  const shape = tables
    .map(({ tableName, documentType }) => ({ tableName, documentType }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
  return { schemaValidation, shape };
}

/** A saved shape's fingerprint. */
export const fingerprintOf = (saved) => createHash(FINGERPRINT_HASH).update(JSON.stringify(saved)).digest("hex");

/** The fingerprint of a schema's saved shape. */
export const shapeFingerprint = (schemaJson) => fingerprintOf(savedShape(schemaJson));

/** A saved shape as environment variable values, compressed, each within Convex's cap. */
export function shapeParts(saved) {
  const encoded = brotliCompressSync(JSON.stringify(saved)).toString(SHAPE_ENCODING);
  const parts = [];
  for (let at = 0; at < encoded.length; at += SHAPE_PART_LENGTH) parts.push(encoded.slice(at, at + SHAPE_PART_LENGTH));
  return parts;
}

/** The saved shape the values hold, or null when they hold none, or one that doesn't match `fingerprint`. */
export function shapeFromParts(parts, fingerprint) {
  try {
    const saved = JSON.parse(brotliDecompressSync(Buffer.from(parts.join(""), SHAPE_ENCODING)).toString());
    return fingerprintOf(saved) === fingerprint ? saved : null;
  } catch {
    return null;
  }
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The type that holds a literal, by the literal's JavaScript type. */
const LITERAL_TYPES = { string: "string", number: "number", boolean: "boolean" };

/**
 * Where a value `before` accepts may not fit `after` (a field's path, or "" for the type itself),
 * or null when `after` accepts every value `before` does. A field added to an object strands
 * nothing (a required one makes Convex refuse the deploy instead), unless `newRequiredStrands`: a
 * function's arguments, where a queued call made without it fails (scripts/function-inputs.mjs).
 * Cautious: a value split across a new union's branches, say, reads as stranded.
 */
export function strandedAt(before, after, { newRequiredStrands = false } = {}, path = "") {
  const options = { newRequiredStrands };
  if (after.type === "any") return null;
  if (before.type === "union") {
    for (const branch of before.value) {
      const at = strandedAt(branch, after, options, path);
      if (at !== null) return at;
    }
    return null;
  }
  if (after.type === "union") return after.value.some((branch) => strandedAt(before, branch, options, path) === null) ? null : path;
  if (before.type === "literal") {
    if (after.type === "literal") return sameValue(before.value, after.value) ? null : path;
    return LITERAL_TYPES[typeof before.value] === after.type ? null : path;
  }
  if (before.type !== after.type) return path;
  const inside = (name) => (path ? `${path}.${name}` : name);
  switch (before.type) {
    case "array":
      return strandedAt(before.value, after.value, options, inside("[]"));
    case "record":
      return (
        strandedAt(before.keys, after.keys, options, inside("[key]")) ??
        strandedAt(before.values.fieldType, after.values.fieldType, options, inside("[]"))
      );
    case "object": {
      for (const [name, field] of Object.entries(before.value)) {
        const now = after.value[name];
        if (!now || (field.optional && !now.optional)) return inside(name);
        const at = strandedAt(field.fieldType, now.fieldType, options, inside(name));
        if (at !== null) return at;
      }
      const added = Object.entries(after.value).find(([name, field]) => !field.optional && !(name in before.value));
      return newRequiredStrands && added ? inside(added[0]) : null;
    }
    default:
      // string, number, boolean, null and the rest: the same in everything they carry (an id's table).
      return sameValue(before, after) ? null : path;
  }
}

/** The first table, or table and field, whose saved data may not fit `next`'s shape, or null when none. */
export function strandedIn(live, next) {
  if (next.schemaValidation && !live.schemaValidation) return "every table, now checked against the schema";
  for (const { tableName, documentType } of live.shape) {
    const now = next.shape.find((table) => table.tableName === tableName);
    if (!now) return tableName;
    const at = strandedAt(documentType, now.documentType);
    if (at !== null) return at ? `${tableName}.${at}` : tableName;
  }
  return null;
}
