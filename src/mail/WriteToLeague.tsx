import { useState, type FormEvent } from "react";
import { BODY_MAX, SUBJECT_MAX } from "../../convex/mail/mailLimits";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { PANEL_BODY, Panel, Problem, Status } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import type { MailSeam } from "./seam";
import { WRITE_TITLE, sendToWords, sentWords, writeHint, writeLabels } from "./words";

const LEAGUE_CHOICE_ID = "letter-league";
const SUBJECT_ID = "letter-subject";
const BODY_ID = "letter-body";
/** The hint, who gets the letter, describes the letter's box. */
const HINT_ID = "letter-hint";

/** How many lines the letter's box shows before it scrolls. */
const LETTER_ROWS = 6;

/** spec/16: the commissioner's one-way letter to the whole league, from a league they run. */
export function WriteToLeague({ leagues, writeToLeague }: { leagues: readonly LeagueSummary[]; writeToLeague: MailSeam["writeToLeague"] }) {
  // The first league is passed as the start, so the default doesn't follow whichever comes first later.
  const [leagueId, setLeagueId] = useChoiceAmong(
    leagues.map((each) => each.leagueId),
    leagues[0].leagueId,
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const { busy: sending, problem, run } = useChange();
  /** The league the last letter went to; cleared by a refusal. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const league = leagues.find((each) => each.leagueId === leagueId) ?? leagues[0];

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const made = await run(() => writeToLeague({ leagueId: league.leagueId, subject, body }));
    setSentTo(made ? league.name : null);
    if (!made) return;
    setSubject("");
    setBody("");
  }

  return (
    <Panel title={WRITE_TITLE} className="min-w-0 max-w-xl grow basis-letter-form">
      <Problem problem={problem} />
      <Status words={sentTo === null ? null : sentWords(sentTo)} className="px-3 pt-2 text-derived" />
      <form onSubmit={send} className={PANEL_BODY}>
        <p id={HINT_ID} className="text-muted">
          {writeHint}
        </p>
        {leagues.length > 1 && (
          <>
            <label htmlFor={LEAGUE_CHOICE_ID} className="font-semibold">
              {writeLabels.league}
            </label>
            <select
              id={LEAGUE_CHOICE_ID}
              value={league.leagueId}
              onChange={(event) => setLeagueId(event.target.value as LeagueSummary["leagueId"])}
              className="text-box"
            >
              {leagues.map((each) => (
                <option key={each.leagueId} value={each.leagueId}>
                  {each.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor={SUBJECT_ID} className="font-semibold">
          {writeLabels.subject}
        </label>
        <input
          id={SUBJECT_ID}
          required
          maxLength={SUBJECT_MAX}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="text-box"
        />
        <label htmlFor={BODY_ID} className="font-semibold">
          {writeLabels.body}
        </label>
        <textarea
          id={BODY_ID}
          required
          maxLength={BODY_MAX}
          rows={LETTER_ROWS}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-describedby={HINT_ID}
          className="text-box py-1"
        />
        <button type="submit" disabled={sending} className="action self-start">
          {sendToWords(league.name)}
        </button>
      </form>
    </Panel>
  );
}
