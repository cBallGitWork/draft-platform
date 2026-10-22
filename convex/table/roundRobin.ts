// The head-to-head fixtures (#33; spec/09): a round robin drawn over the gameweeks the league plays
// (spec/13, Gameweeks), so an unticked gameweek has none and the rounds it would have had move on
// to the next one played. A league plays one or more games a gameweek: each gameweek is dealt that
// many rounds. Once one round robin is dealt, the next begins, each in its own order, as evenly as
// can be: every pair meets once a round robin, and each team is left over once. The order is
// seeded by something stable (the league's id), so drawing again gives the same fixtures.
// Pure: no I/O.

/** With an odd number of teams, what the team left over plays each gameweek: no one, or the
 *  league's average score that gameweek (spec/09). A league's rule (spec/03), stored as data. */
export const ODD_TEAM_OUTS = ["bye", "leagueAverage"] as const;
export type OddTeamOut = (typeof ODD_TEAM_OUTS)[number];

/** How a league's round robin is drawn: its rules, and the seed its order is drawn from. */
export type DrawOptions = {
  oddTeamOut: OddTeamOut;
  /** How many games each team plays a gameweek (spec/09): a league's rule, 1 or more. */
  gamesPerGameweek: number;
  seed: string;
};

/** The fewest teams a round robin is drawn for: a fixture needs two. */
export const FEWEST_TO_DRAW = 2;

/** The opponent of the team left over, in a league whose odd team out plays the average. */
export const LEAGUE_AVERAGE = "leagueAverage";

export type Fixture<Team> = { team: Team; opponent: Team | typeof LEAGUE_AVERAGE };
export type GameweekFixtures<Team> = {
  gameweek: number;
  fixtures: Fixture<Team>[];
  /** The teams left over, in a league whose odd team out has a bye: one a game. */
  byes: Team[];
};

type Round<Team> = [Team, Team | null][];

/** The rounds of one round robin, by the circle method: one team stays put while the rest turn
 *  round it, so each team meets every other once. With an odd number, a gap joins the circle, and
 *  whoever faces it (null) is left over: each team once a round robin. */
export function roundsOf<Team>(teams: readonly Team[]): Round<Team>[] {
  const circle: (Team | null)[] = teams.length % 2 === 0 ? [...teams] : [...teams, null];
  const size = circle.length;
  const rounds: Round<Team>[] = [];
  for (let round = 0; round < size - 1; round += 1) {
    const pairs: Round<Team> = [];
    for (let index = 0; index < size / 2; index += 1) {
      const [one, other] = [circle[index], circle[size - 1 - index]];
      // Whoever faces the gap comes first.
      pairs.push(one === null ? [other!, null] : [one, other]);
    }
    rounds.push(pairs);
    circle.splice(1, 0, circle.pop()!);
  }
  return rounds;
}

/** How many rounds one round robin of `teamCount` teams has (`roundsOf`), so the most games a team
 *  can play in a gameweek: one against each other team, and with an odd number, one more for the
 *  team left over, against the league's average or a bye. */
export const roundsInARoundRobin = (teamCount: number) => (teamCount % 2 === 0 ? teamCount - 1 : teamCount);

/** The games each team plays a gameweek: the league's number, but never more than one round
 *  robin's rounds, as a team has no more opponents than that to meet once each (the league's
 *  average counting as one). A league asking for more plays as many as there are. */
export const gamesInAGameweek = (roundCount: number, gamesPerGameweek: number) => Math.min(gamesPerGameweek, roundCount);

/** The league's fixtures in each gameweek it plays (`gameweeks`, in order), its teams in the
 *  order they were made. Fewer than FEWEST_TO_DRAW have no one to play, so no fixtures. */
export function drawFixtures<Team>(
  teams: readonly Team[],
  gameweeks: readonly number[],
  { oddTeamOut, gamesPerGameweek, seed }: DrawOptions,
): GameweekFixtures<Team>[] {
  if (teams.length < FEWEST_TO_DRAW) return [];
  const rounds = roundsOf(teams);
  const games = gamesInAGameweek(rounds.length, gamesPerGameweek);
  const order = roundOrder(rounds.length, gameweeks.length * games, games, seed);
  return gameweeks.map((gameweek, index) => {
    const fixtures: Fixture<Team>[] = [];
    const leftOver: Team[] = [];
    for (const round of order.slice(index * games, (index + 1) * games)) {
      for (const [team, opponent] of rounds[round]) {
        if (opponent !== null) fixtures.push({ team, opponent });
        else if (oddTeamOut === "leagueAverage") fixtures.push({ team, opponent: LEAGUE_AVERAGE });
        else leftOver.push(team);
      }
    }
    return { gameweek, fixtures, byes: leftOver };
  });
}

/** Which round is played at each of `total` turns, `games` to a gameweek: one round robin after
 *  another, each shuffled by the seed. A gameweek straddling two round robins never gets one round
 *  twice, which would pair a team with the same opponent twice: the next round robin opens with
 *  rounds the gameweek hasn't had. */
export function roundOrder(roundCount: number, total: number, games: number, seed: string): number[] {
  if (roundCount < 1 || games < 1 || games > roundCount) {
    throw new Error(`Can't deal ${games} of ${roundCount} rounds a gameweek`);
  }
  const random = seededRandom(seed);
  const order: number[] = [];
  while (order.length < total) {
    const shuffled = shuffle(Array.from({ length: roundCount }, (_, round) => round), random);
    const inThisGameweek = new Set(order.slice(order.length - (order.length % games)));
    const stillToDeal = inThisGameweek.size === 0 ? 0 : games - inThisGameweek.size;
    const opening = shuffled.filter((round) => !inThisGameweek.has(round)).slice(0, stillToDeal);
    order.push(...opening, ...shuffled.filter((round) => !opening.includes(round)));
  }
  return order.slice(0, total);
}

/** A Fisher-Yates shuffle, by `random`. */
function shuffle<Item>(items: Item[], random: () => number): Item[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/** FNV-1a's 32-bit offset basis and prime, mulberry32's step, and how many 32-bit numbers there are. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MULBERRY32_STEP = 0x6d2b79f5;
const UINT32_RANGE = 2 ** 32;

/** Numbers in [0, 1) that are the same for the same seed: mulberry32, seeded by the seed's FNV-1a
 *  hash. Not for secrets; only so a league's draw comes out the same each time it's read. */
export function seededRandom(seed: string): () => number {
  let state = FNV_OFFSET_BASIS;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), FNV_PRIME);
  return () => {
    state = (state + MULBERRY32_STEP) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}
