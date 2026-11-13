// Whether a new schema could strand saved data (spec/20, Rolling back, S20.9; #1996): a table or field
// removed, or a type narrowed, could; a field or table added, or a type widened, can't. Types are
// built with Convex's own validators and read in the form the schema exports them.

import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { describe, expect, test } from "vitest";
import {
  SHAPE_PART_LENGTH,
  fingerprintOf,
  shapeFromParts,
  shapeParts,
  strandedAt,
  strandedIn,
} from "../../scripts/schema-shape.mjs";

const stranded = (before, after) => strandedAt(before.json, after.json);
const status = v.union(v.literal("open"), v.literal("closed"));

describe("what strands nothing", () => {
  test.each([
    ["the same type", v.string(), v.string()],
    ["a field added", v.object({ name: v.string() }), v.object({ name: v.string(), club: v.optional(v.string()) })],
    ["a required field added (Convex refuses the deploy instead)", v.object({ name: v.string() }), v.object({ name: v.string(), age: v.number() })],
    ["a required field made optional", v.object({ name: v.string() }), v.object({ name: v.optional(v.string()) })],
    ["a union given a branch", status, v.union(v.literal("open"), v.literal("closed"), v.literal("void"))],
    ["a literal widened to its type", v.literal("open"), v.string()],
    ["a type widened to a union holding it", v.number(), v.union(v.number(), v.null())],
    ["a field inside an array widened", v.array(v.object({ id: v.number() })), v.array(v.object({ id: v.optional(v.number()) }))],
    ["a record's values widened", v.record(v.string(), v.number()), v.record(v.string(), v.union(v.number(), v.string()))],
    ["anything to any", v.object({ name: v.string() }), v.any()],
  ])("%s", (_, before, after) => {
    expect(stranded(before, after)).toBeNull();
  });
});

describe("what could strand saved data, and where", () => {
  test.each([
    ["a field removed", v.object({ name: v.string(), club: v.string() }), v.object({ name: v.string() }), "club"],
    ["an optional field made required", v.object({ club: v.optional(v.string()) }), v.object({ club: v.string() }), "club"],
    ["a field's type changed", v.object({ price: v.number() }), v.object({ price: v.string() }), "price"],
    ["a union losing a branch", v.object({ state: status }), v.object({ state: v.literal("open") }), "state"],
    ["a type narrowed to a literal", v.string(), v.literal("open"), ""],
    ["a field removed inside an array", v.object({ picks: v.array(v.object({ id: v.number(), round: v.number() })) }), v.object({ picks: v.array(v.object({ id: v.number() })) }), "picks.[].round"],
    ["a record's keys narrowed", v.record(v.string(), v.number()), v.record(v.id("players"), v.number()), "[key]"],
    ["an id to another table", v.id("players"), v.id("clubs"), ""],
    ["a value split across a new union's branches (cautious)", v.boolean(), v.union(v.literal(true), v.literal(false)), ""],
  ])("%s", (_, before, after, at) => {
    expect(stranded(before, after)).toBe(at);
  });
});

const table = (tableName, type) => ({ tableName, documentType: type.json });
const live = { schemaValidation: true, shape: [table("clubs", v.object({ name: v.string() })), table("players", v.object({ name: v.string() }))] };

test("a table added strands nothing; a table removed, or a field in one, is named", () => {
  expect(strandedIn(live, { ...live, shape: [...live.shape, table("trades", v.object({}))] })).toBeNull();
  expect(strandedIn(live, { ...live, shape: [live.shape[1]] })).toBe("clubs");
  expect(strandedIn(live, { ...live, shape: [live.shape[0], table("players", v.object({}))] })).toBe("players.name");
});

test("turning schema validation on could strand any table; turning it off strands nothing", () => {
  const unchecked = { ...live, schemaValidation: false };
  expect(strandedIn(unchecked, live)).not.toBeNull();
  expect(strandedIn(live, unchecked)).toBeNull();
});

test("a shape kept in parts reads back whole, and only when it matches its fingerprint", () => {
  // Random field names, so compression can't fit it in one part.
  const big = { ...live, shape: Array.from({ length: 400 }, (_, n) => table(`table${n}`, v.object({ [randomUUID()]: v.string() }))) };
  const parts = shapeParts(big);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every((part) => part.length <= SHAPE_PART_LENGTH)).toBe(true);
  expect(shapeFromParts(parts, fingerprintOf(big))).toEqual(big);
  expect(shapeFromParts(parts, fingerprintOf(live))).toBeNull();
  expect(shapeFromParts(parts.slice(1), fingerprintOf(big))).toBeNull();
});
