import { useState, type FormEvent } from "react";
import { BODY_MAX, SUBJECT_MAX } from "../../convex/mailLimits";
import type { LeagueSummary } from "../../convex/myLeagues";
import { PanelTitle, Problem } from "../frame/Panel";
import type { Mail } from "./actions";
import { WRITE_TITLE, sentWords, writeHint } from "./words";

type Outcome = { sent: true; leagueName: string } | { sent: false; problem: string };

/** spec/16: the commissioner's one-way letter to the whole league, from a league they run. */
export function WriteToLeague({ leagues, writeToLeague }: { leagues: readonly LeagueSummary[]; writeToLeague: Mail["writeToLeague"] }) {
  const [leagueId, setLeagueId] = useState(leagues[0].leagueId);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const league = leagues.find((each) => each.leagueId === leagueId) ?? leagues[0];

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    const problem = await writeToLeague({ leagueId: league.leagueId, subject, body });
    setSending(false);
    if (problem !== null) {
      setOutcome({ sent: false, problem });
      return;
    }
    setOutcome({ sent: true, leagueName: league.name });
    setSubject("");
    setBody("");
  }

  return (
    <section aria-labelledby="write-title" className="min-w-0 max-w-xl flex-[1_1_320px] bg-panel">
      <PanelTitle id="write-title">{WRITE_TITLE}</PanelTitle>
      <Problem problem={outcome?.sent === false ? outcome.problem : null} />
      {outcome?.sent && (
        <p role="status" className="px-3 pt-2 text-derived">
          {sentWords(outcome.leagueName)}
        </p>
      )}
      <form onSubmit={send} className="flex flex-col gap-2 p-3">
        <p className="text-muted">{writeHint}</p>
        {leagues.length > 1 && (
          <>
            <label htmlFor="letter-league" className="font-semibold">
              League
            </label>
            <select
              id="letter-league"
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
        <label htmlFor="letter-subject" className="font-semibold">
          Subject
        </label>
        <input
          id="letter-subject"
          required
          maxLength={SUBJECT_MAX}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="text-box"
        />
        <label htmlFor="letter-body" className="font-semibold">
          Letter
        </label>
        <textarea
          id="letter-body"
          required
          maxLength={BODY_MAX}
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="text-box py-1"
        />
        <button type="submit" disabled={sending} className="action self-start">
          Send to {league.name}
        </button>
      </form>
    </section>
  );
}
