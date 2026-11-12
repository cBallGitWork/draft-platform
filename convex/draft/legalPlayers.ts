import { AREAS, type Area } from "../lineup/pitch";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { areasShort } from "../squads/areaMinimums";

// Which players a team may draft (spec/04, The picks; #1088). A pick that would break the squad's
// rules is greyed out: a player whose club the team is already at the league's maximum for, and
// a player whose pick would leave too few picks to reach an area's minimum. So every finished
// squad is legal. A player who plays two areas fills one minimum, as areaMinimums.ts matches them.
// The players still undrafted count too: a player whose pick would leave no legal finish from them
// is greyed out, and if no legal finish exists at all, the squad-only checks apply (Craig, 5 Nov
// 2026, on #1088: "Yes, grey those out"). Pure: no I/O.

/** A player in a squad, or one who might be picked: his club's season-stable code and the areas
 *  he plays (../lineup/pitch.ts's `areasOf`). */
export interface DraftPlayer {
  clubCode: number;
  areas: readonly Area[];
}

type SquadRules = LeagueRules["squad"];

/** Players alike for the squad's rules, the same club and the same areas, and how many. */
interface Alike {
  player: DraftPlayer;
  count: number;
}

const alikeKey = ({ clubCode, areas }: DraftPlayer): string => `${clubCode}:${areas.join(",")}`;

/** The players grouped by club and areas. */
function alikeOf(players: readonly DraftPlayer[]): Map<string, Alike> {
  const groups = new Map<string, Alike>();
  for (const player of players) {
    const group = groups.get(alikeKey(player));
    if (group === undefined) groups.set(alikeKey(player), { player, count: 1 });
    else group.count += 1;
  }
  return groups;
}

/** How many more players the squad needs to fill every area's minimum: the places no one in it
 *  fills, each a player's to fill. */
function placesShort(squad: readonly DraftPlayer[], minimumByArea: SquadRules["minimumByArea"]): number {
  if (minimumByArea === null) return 0;
  return areasShort(
    squad.map(({ areas }) => areas),
    minimumByArea,
  ).reduce((total, { players, minimum }) => total + minimum - players, 0);
}

/** The most that can flow from `source` to `sink` along `edges` (from, to, capacity), by shortest
 *  augmenting paths (Edmonds-Karp). */
function maxFlow(nodes: number, edges: readonly [number, number, number][], source: number, sink: number): number {
  const to: number[] = [];
  const room: number[] = [];
  const out: number[][] = Array.from({ length: nodes }, () => []);
  for (const [from, end, capacity] of edges) {
    out[from].push(to.length);
    to.push(end);
    room.push(capacity);
    out[end].push(to.length);
    to.push(from);
    room.push(0);
  }
  let total = 0;
  for (;;) {
    /** The edge each node was first reached by. */
    const reachedBy: (number | undefined)[] = new Array(nodes);
    const queue = [source];
    for (let at = 0; at < queue.length && reachedBy[sink] === undefined; at++) {
      for (const edge of out[queue[at]]) {
        const next = to[edge];
        if (room[edge] > 0 && next !== source && reachedBy[next] === undefined) {
          reachedBy[next] = edge;
          queue.push(next);
        }
      }
    }
    if (reachedBy[sink] === undefined) return total;
    let most = Infinity;
    for (let node = sink; node !== source; node = to[reachedBy[node]! ^ 1]) most = Math.min(most, room[reachedBy[node]!]);
    for (let node = sink; node !== source; node = to[reachedBy[node]! ^ 1]) {
      room[reachedBy[node]!] -= most;
      room[reachedBy[node]! ^ 1] += most;
    }
    total += most;
  }
}

/** Whether `picks` more players from `left` can finish `squad` legally: within the club maximum,
 *  and with every area's minimum filled. The club maximum alone leaves enough to pick when the
 *  players left within it number `picks`; any fewer that fill the minimums can then be added to
 *  (the club maximum is a partition matroid). The fewest that fill them is a flow: picks to clubs,
 *  within the room each has, to the players left there, to the areas they play, joined by the
 *  squad's own players, to each area's minimum. */
function canFinish(squad: readonly DraftPlayer[], picks: number, left: readonly Alike[], { minimumByArea, maxPerClub }: SquadRules): boolean {
  const held = new Map<number, number>();
  for (const { clubCode } of squad) held.set(clubCode, (held.get(clubCode) ?? 0) + 1);
  const roomAt = (clubCode: number) => (maxPerClub === null ? Infinity : Math.max(0, maxPerClub - (held.get(clubCode) ?? 0)));
  const leftAt = new Map<number, number>();
  for (const { player, count } of left) leftAt.set(player.clubCode, (leftAt.get(player.clubCode) ?? 0) + count);
  const pickable = [...leftAt].reduce((total, [clubCode, count]) => total + Math.min(count, roomAt(clubCode)), 0);
  if (pickable < picks) return false;
  if (minimumByArea === null) return true;

  const clubs = [...leftAt.keys()];
  const squadAlike = [...alikeOf(squad).values()];
  // Nodes: the source, the picks, each club, each kind of player left, each kind in the squad, each
  // area, the sink.
  const [source, picksNode] = [0, 1];
  const clubNode = (index: number) => 2 + index;
  const leftNode = (index: number) => 2 + clubs.length + index;
  const squadNode = (index: number) => 2 + clubs.length + left.length + index;
  const areaNode = (area: Area) => 2 + clubs.length + left.length + squadAlike.length + AREAS.indexOf(area);
  const sink = 2 + clubs.length + left.length + squadAlike.length + AREAS.length;
  const edges: [number, number, number][] = [
    [source, picksNode, picks],
    ...clubs.map((clubCode, index): [number, number, number] => [picksNode, clubNode(index), roomAt(clubCode)]),
    ...left.flatMap(({ player, count }, index): [number, number, number][] => [
      [clubNode(clubs.indexOf(player.clubCode)), leftNode(index), count],
      ...player.areas.map((area): [number, number, number] => [leftNode(index), areaNode(area), Infinity]),
    ]),
    ...squadAlike.flatMap(({ player, count }, index): [number, number, number][] => [
      [source, squadNode(index), count],
      ...player.areas.map((area): [number, number, number] => [squadNode(index), areaNode(area), Infinity]),
    ]),
    ...AREAS.map((area): [number, number, number] => [areaNode(area), sink, minimumByArea[area]]),
  ];
  const places = AREAS.reduce((total, area) => total + minimumByArea[area], 0);
  return maxFlow(sink + 1, edges, source, sink) === places;
}

/** Why a team may not pick a player: its squad has no picks left, it is at the league's maximum
 *  for his club, his pick would leave too few picks to reach an area's minimum, or it would leave
 *  no legal finish from the players still undrafted. The draft room's list says which. */
export type NotLegal = "squadFull" | "clubFull" | "areasShort" | "noFinish";

/** Why the team holding `squad`, with `picksLeft` picks still to make counting this one, may not
 *  pick a player, under the league's squad rules and from the players still `undrafted`; null when
 *  it may. */
export function whyNotLegal(
  squad: readonly DraftPlayer[],
  picksLeft: number,
  rules: SquadRules,
  undrafted: readonly DraftPlayer[],
): (player: DraftPlayer) => NotLegal | null {
  const { minimumByArea, maxPerClub } = rules;
  /** Why the checks on the team's squad alone refuse him, or null when they don't. */
  const whyBySquad = (player: DraftPlayer): NotLegal | null => {
    if (picksLeft < 1) return "squadFull";
    if (maxPerClub !== null && squad.filter(({ clubCode }) => clubCode === player.clubCode).length >= maxPerClub) return "clubFull";
    return placesShort([...squad, player], minimumByArea) <= picksLeft - 1 ? null : "areasShort";
  };
  const bySquad = (player: DraftPlayer) => whyBySquad(player) === null;

  const left = alikeOf(undrafted);
  const finishing = new Map<string, boolean>();
  /** Whether picking the player leaves a legal finish from the players undrafted after him. */
  const finishes = (player: DraftPlayer): boolean => {
    const key = alikeKey(player);
    let can = finishing.get(key);
    if (can === undefined) {
      const after = [...left.entries()].map(([groupKey, group]) => (groupKey === key ? { ...group, count: group.count - 1 } : group));
      can = canFinish([...squad, player], picksLeft - 1, after, rules);
      finishing.set(key, can);
    }
    return can;
  };
  let anyFinish: boolean | undefined;

  return (player) => {
    const bySquadAlone = whyBySquad(player);
    if (bySquadAlone !== null) return bySquadAlone;
    if (finishes(player)) return null;
    anyFinish ??= [...left.values()].some((group) => bySquad(group.player) && finishes(group.player));
    return anyFinish ? "noFinish" : null;
  };
}
