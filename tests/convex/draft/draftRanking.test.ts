import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { draftRanking, RANKING_LINES_MOST, rankingRefusals } from "../../../convex/draft/draftRanking";
import { rankingProblems } from "../../../convex/draft/rankingFile";
import { ARSENAL, GONE, insertClubs, insertDroppedPlayer, insertPlayers, ODEGAARD, RICE, SAKA, UNHELD } from "../../support/convex/footballRows.harness";
import { ADMIN, actingAs } from "../../support/convex/leagues.harness";
import { signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused, type TestConvex } from "../../support/convex/test.harness";

// The admin's ranking (spec/04, The queue and the ranking; #1093): one for the whole platform,
// stored only when every line is good, each upload replacing the last; a player who has left the
// game is skipped, never a bad line (Craig, 4 Nov 2026, on #1093).

let t: TestConvex;

beforeEach(async () => {
  t = await signInDeployment();
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, [SAKA, RICE, ODEGAARD]);
    await insertDroppedPlayer(ctx, GONE, Date.now());
  });
});

const upload = async (file: string) => (await actingAs(t, ADMIN)).mutation(api.draft.draftRanking.upload, { file });
const held = () => t.run((ctx) => draftRanking(ctx));

test("a good file is stored best first, and read back as the admin uploaded it", async () => {
  expect(await upload(`code,rank\n${RICE.code},7\n${SAKA.code},2\n${ODEGAARD.code},30`)).toEqual({ ok: true, ranked: 3, skipped: [] });

  const view = await (await actingAs(t, ADMIN)).query(api.draft.draftRanking.view, {});
  expect(view).toEqual({
    players: [
      { code: SAKA.code, rank: 2 },
      { code: RICE.code, rank: 7 },
      { code: ODEGAARD.code, rank: 30 },
    ],
    uploadedAt: Date.now(),
  });
});

test("with none uploaded, the read is null", async () => {
  expect(await (await actingAs(t, ADMIN)).query(api.draft.draftRanking.view, {})).toBeNull();
});

test("a new upload replaces the last, so there is one ranking", async () => {
  await upload(`${SAKA.code},1\n${RICE.code},2`);
  await upload(`${ODEGAARD.code},1`);

  expect((await held())?.players).toEqual([{ code: ODEGAARD.code, rank: 1 }]);
  expect(await t.run((ctx) => ctx.db.query("draftRanking").collect())).toHaveLength(1);
});

describe("a bad file", () => {
  test("every bad line is reported, an unknown player among them, and nothing is stored", async () => {
    await upload(`${SAKA.code},1`);

    const outcome = await upload(`${UNHELD},1\n${RICE.code},2\n${RICE.code},3\n${ODEGAARD.code},2\n${SAKA.code},x`);

    expect(outcome).toEqual({
      ok: false,
      problems: [
        { line: 1, words: rankingProblems.unknownCode(UNHELD) },
        { line: 3, words: rankingProblems.sameCode(RICE.code, 2) },
        { line: 4, words: rankingProblems.sameRank(2, 2) },
        { line: 5, words: rankingProblems.badRank("x") },
      ],
    });
    expect((await held())?.players).toEqual([{ code: SAKA.code, rank: 1 }]);
  });

  test("a file ranking no one is refused, and the ranking held stays", async () => {
    await upload(`${SAKA.code},1`);
    await expectRefused(upload("code,rank\n\n"), rankingRefusals.empty);
    expect((await held())?.players).toEqual([{ code: SAKA.code, rank: 1 }]);
  });

  test("a file ranking more than the most is refused whole", async () => {
    const lines = Array.from({ length: RANKING_LINES_MOST + 1 }, (_, index) => `${index + 1},${index + 1}`);
    await expectRefused(upload(lines.join("\n")), rankingRefusals.tooLong);
    expect(await held()).toBeNull();
  });
});

test("a player who has left the game is skipped and listed, and the rest is stored", async () => {
  expect(await upload(`${SAKA.code},1\n${GONE.code},2\n${RICE.code},3`)).toEqual({ ok: true, ranked: 2, skipped: [{ line: 2, code: GONE.code }] });
  expect((await held())?.players).toEqual([
    { code: SAKA.code, rank: 1 },
    { code: RICE.code, rank: 3 },
  ]);
});
