import { v, type Infer } from "convex/values";
import { classicDescriptionOf, FIRST_CLASSIC_FORMATIONS, type ClassicFormation } from "../lineup/classicFormations";
import { FIRST_PRESETS, presetDescriptionOf } from "../lineup/presets";

// The Guide's formation entries (spec/23 S23.7): one per preset and classic side the site lists,
// under Tactics, following the list, never a copy of it, so a formation added to the list gets its
// entry by itself. Its text is the one held description the formation window shows (S05.61):
// Claude's, until the admin edits it, his edit held by name and read by both (S23.12). No server
// imports, so the formation window reads it too.

/** A formation entry's list: the presets or the classic sides. */
export const formationKind = v.union(v.literal("preset"), v.literal("classic"));
export type FormationKind = Infer<typeof formationKind>;

/** The admin's edit to one formation entry's text. */
export type HeldDescription = { kind: FormationKind; name: string; text: string };

/** Every formation entry the site lists, presets then classic sides, each with Claude's text. */
export const LISTED_FORMATIONS: readonly { kind: FormationKind; name: string; text: string }[] = [
  ...FIRST_PRESETS.flatMap(({ name }) => {
    const text = presetDescriptionOf(name);
    return text === undefined ? [] : [{ kind: "preset" as const, name, text }];
  }),
  ...FIRST_CLASSIC_FORMATIONS.map((each) => ({ kind: "classic" as const, name: each.name, text: classicDescriptionOf(each) })),
];

/** The descriptions the formation window shows: the admin's held edit by name, else Claude's. */
export function describedWith(held: readonly HeldDescription[]) {
  const edited = (kind: FormationKind, name: string) => held.find((each) => each.kind === kind && each.name === name)?.text;
  return {
    preset: (name: string): string | undefined => edited("preset", name) ?? presetDescriptionOf(name),
    classic: (formation: Pick<ClassicFormation, "name" | "description">): string => edited("classic", formation.name) ?? classicDescriptionOf(formation),
  };
}
