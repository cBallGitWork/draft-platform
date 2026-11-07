import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { screenMoment } from "../../convex/shared/moments";
import { PATCH_NOTES_PATH } from "../patches/paths";
import { KIND_WORDS } from "../patches/words";
import { gameweekWords } from "../rules/words";
import { useChange } from "../shared/useChange";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import { useMinute } from "../shared/useMinute";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Confirm } from "../ui/Confirm";
import { Panel, PanelNote, Problem, Status } from "../ui/Panel";
import type { ScoringSeam, PatchGameweek, ScoringVersion } from "./seam";
import {
  announceGameweekLabel,
  announcedWords,
  announceWords,
  comingWords,
  noPatchGameweekWords,
  notesLinkWords,
  noVersionsYetWords,
  patchGameweekWords,
  saveDraftFirstWords,
  versionColumns,
  versionsTitle,
  withdrawNoWords,
  withdrawQuestion,
  withdrawWords,
  withdrawYesWords,
} from "./words";

// The admin's patches in the rules editor (spec/14, Changes and corrections; Craig, 6 Nov 2026, on
// #368): announcing the draft patch from a gameweek, and the versions list, where the coming patch
// can be withdrawn.

const ANNOUNCE_GAMEWEEK_ID = "patch-gameweek";

/** Under the draft patch's bar: the gameweek it takes effect from, among those the server offers,
 *  and Announce, for the draft saved at `savedAt`; null while there's none saved, or the draft is
 *  edited since. */
export function AnnounceBar({ announce, savedAt, gameweeks }: { announce: ScoringSeam["announce"]; savedAt: number | null; gameweeks: readonly PatchGameweek[] }) {
  const [gameweek, pick] = useChoiceAmong(gameweeks.map((each) => each.gameweek));
  const [announced, setAnnounced] = useState<string | null>(null);
  const { busy, problem, run } = useChange();
  const chosen = gameweeks.find((each) => each.gameweek === gameweek);

  async function announceIt(draftSavedAt: number, takesEffectAt: number) {
    let made: string | null = null;
    await run(async () => {
      const answer = await announce(draftSavedAt, takesEffectAt);
      if (typeof answer === "string") return answer;
      made = announcedWords(answer.name, answer.fromGameweek);
      return null;
    });
    setAnnounced(made);
  }

  return (
    <div className="bg-panel">
      {chosen === undefined ? (
        <PanelNote>{noPatchGameweekWords}</PanelNote>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
          <label htmlFor={ANNOUNCE_GAMEWEEK_ID} className="text-soft">
            {announceGameweekLabel}
          </label>
          <select id={ANNOUNCE_GAMEWEEK_ID} value={chosen.gameweek} onChange={(event) => pick(Number(event.target.value))} className="text-box min-w-0">
            {gameweeks.map((each) => (
              <option key={each.gameweek} value={each.gameweek}>
                {patchGameweekWords(each.gameweek, each.takesEffectAt)}
              </option>
            ))}
          </select>
          <span className="flex grow justify-end">
            <button
              type="button"
              disabled={savedAt === null || busy}
              onClick={() => savedAt !== null && void announceIt(savedAt, chosen.takesEffectAt)}
              className={savedAt === null ? "action-idle" : "action"}
            >
              {announceWords}
            </button>
          </span>
        </div>
      )}
      {savedAt === null && announced === null && <PanelNote edge="b">{saveDraftFirstWords}</PanelNote>}
      <Status words={announced} className="px-3 pb-2" />
      <Problem problem={problem} />
    </div>
  );
}

type VersionColumn = keyof typeof versionColumns;
const LEFT_COLUMNS: readonly VersionColumn[] = ["name", "kind", "announcedAt", "notes"];
const cellClasses = (column: VersionColumn) => cellClassOf(LEFT_COLUMNS.includes(column));

/** Every version of the site's scoring, newest first: its name, patch or fix, announced on, the
 *  gameweek it takes effect from and its patch notes; the coming one marked, and, while it waits,
 *  withdrawn on a confirm. Only the latest can be waiting: versions take effect in order. */
export function VersionsPanel({ versions, withdraw }: { versions: readonly ScoringVersion[]; withdraw: ScoringSeam["withdraw"] }) {
  const now = useMinute();
  const [asking, setAsking] = useState(false);
  const { busy, problem, run } = useChange();
  const latest = versions.at(-1);
  const coming = latest !== undefined && latest.kind === "patch" && latest.takesEffectAt > now ? latest : undefined;
  return (
    <Panel title={versionsTitle}>
      {versions.length === 0 ? (
        <PanelNote>{noVersionsYetWords}</PanelNote>
      ) : (
        <table className="w-full border-collapse">
          <ColumnHeads columns={versionColumns} classOf={cellClasses} />
          <tbody>
            {versions.toReversed().map((version) => (
              <tr key={version.id} className="border-t border-panel-rule">
                <th scope="row" className={`${cellClasses("name")} font-semibold`}>
                  {version.name}
                  {version === coming && <span className="ml-2 text-derived">{comingWords}</span>}
                </th>
                <td className={cellClasses("kind")}>{KIND_WORDS[version.kind]}</td>
                <td className={cellClasses("announcedAt")}>{screenMoment(version.announcedAt)}</td>
                <td className={`${cellClasses("fromGameweek")} text-figure`}>{gameweekWords(version.fromGameweek)}</td>
                <td className={cellClasses("notes")}>
                  <Link to={PATCH_NOTES_PATH} hash={`version-${version.name}`} className="link-look">
                    {notesLinkWords}
                  </Link>
                  {version === coming && !asking && (
                    <button type="button" onClick={() => setAsking(true)} className="secondary-action ml-2">
                      {withdrawWords}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {coming && asking && (
        <div className="flex flex-col gap-2 px-3 py-2">
          <Confirm
            question={withdrawQuestion(coming.name)}
            yes={withdrawYesWords}
            no={withdrawNoWords}
            busy={busy}
            onYes={() => void run(() => withdraw(coming.id)).then((made) => made && setAsking(false))}
            onNo={() => setAsking(false)}
          />
        </div>
      )}
      <Problem problem={problem} />
    </Panel>
  );
}
