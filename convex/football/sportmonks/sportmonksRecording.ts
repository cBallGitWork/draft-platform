import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { getData, liveFixturesUrl, readSportmonksPayloads, sportmonksToken, SPORTMONKS_TOKEN_ENV } from "./sportmonks";
import { SM_STATE, type RawFixture } from "./sportmonksRaw";

// Sportmonks' raw reads for the tests' recordings (#1391): one competition's six-hourly read's
// three bodies' `data`, and one live read of its latest finished matches with lineups, details
// and events. Only `data` comes back, never the token (it goes in a header) or Sportmonks' plan
// and rate-limit fields. From the CLI, on the dev deployment, for the Scottish Premiership:
// `npx convex run football/sportmonks/sportmonksRecording:read '{"competition": 501}'`.

/** How many finished matches the live read holds. */
const RECORDED_MATCHES = 3;

export const read = internalAction({
  args: { competition: v.number() },
  returns: v.any(),
  handler: async (_ctx, { competition }) => {
    const token = sportmonksToken();
    if (token === null) throw new Error(`${SPORTMONKS_TOKEN_ENV} is not set on this deployment`);
    const season = await readSportmonksPayloads(token, competition);
    const finished = season.schedule
      .flatMap((stage) => stage.rounds ?? [])
      .flatMap((round) => round.fixtures ?? [])
      .filter((match) => match.state_id === SM_STATE.fullTime)
      .sort((a, b) => (b.starting_at_timestamp ?? 0) - (a.starting_at_timestamp ?? 0))
      .slice(0, RECORDED_MATCHES);
    const { data } = await getData<RawFixture[]>(liveFixturesUrl(finished.map((match) => match.id)), token);
    return { season, fixture: { data } };
  },
});
