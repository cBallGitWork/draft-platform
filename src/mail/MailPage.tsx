import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail/mail";
import { LETTERS_SHOWN } from "../../convex/mail/mailLimits";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../auth";
import { Loading, PAGE_TITLE_ID, PageTitle } from "../frame/Panel";
import { runs } from "../leagues/roles";
import type { Mail } from "./actions";
import { WriteToLeague } from "./WriteToLeague";
import {
  MAIL_TITLE,
  letterDay,
  letterSource,
  letterTime,
  loadingWords,
  noLettersWords,
  onlyLatestWords,
  unreadCount,
  unreadWords,
} from "./words";

/** The leagues a letter to the whole league can go from: those the person runs, or, for the
 *  admin, every league, but never one being deleted. The server checks again. */
export function leaguesToWriteFrom(session: Session): readonly LeagueSummary[] {
  if (!session.signedIn) return [];
  return session.leagues.filter((league) => !league.deletion && runs(league, session.isAdmin));
}

/** Mail (spec/16): the person's letters, newest first, each opened in place, which marks it read;
 *  and, for whoever runs a league, a letter to the whole league. */
export function MailPage({ mail, unread, writableLeagues }: { mail: Mail; unread: number; writableLeagues: readonly LeagueSummary[] }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <section aria-labelledby={PAGE_TITLE_ID} className="min-w-0 max-w-3xl grow-2 basis-letters bg-panel">
        <PageTitle aside={<span>{unreadCount(unread)}</span>}>{MAIL_TITLE}</PageTitle>
        <Letters mail={mail} />
      </section>
      {writableLeagues.length > 0 && <WriteToLeague leagues={writableLeagues} writeToLeague={mail.writeToLeague} />}
    </div>
  );
}

function Letters({ mail }: { mail: Mail }) {
  const [openId, setOpenId] = useState<Id<"letters"> | null>(null);
  if (mail.letters === undefined) return <Loading className="px-3 py-2">{loadingWords}</Loading>;
  if (mail.letters.length === 0) return <p className="px-3 py-2 text-muted">{noLettersWords}</p>;

  function toggle(letter: LetterSummary) {
    const opening = openId !== letter.letterId;
    setOpenId(opening ? letter.letterId : null);
    if (opening && !letter.read) void mail.open(letter.letterId);
  }

  return (
    <>
      <ol>
        {mail.letters.map((letter) => (
          <Letter key={letter.letterId} letter={letter} isOpen={openId === letter.letterId} onToggle={() => toggle(letter)} />
        ))}
      </ol>
      {mail.letters.length >= LETTERS_SHOWN && <p className="px-3 py-2 text-muted">{onlyLatestWords}</p>}
    </>
  );
}

function Letter({ letter, isOpen, onToggle }: { letter: LetterSummary; isOpen: boolean; onToggle: () => void }) {
  const bodyId = `letter-${letter.letterId}`;
  return (
    <li className="border-b border-panel-rule">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={onToggle}
        className={`grid min-h-tap w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 px-3 py-1 text-left hover:bg-stepper ${letter.read ? "" : "shadow-event-edge"}`}
      >
        <time dateTime={new Date(letter.at).toISOString()} className="bg-plate px-1 text-center whitespace-nowrap">
          {letterDay(letter.at)} <span className="text-soft">{letterTime(letter.at)}</span>
        </time>
        <span className={letter.read ? "text-muted" : "font-semibold text-fact"}>
          {!letter.read && <span className="sr-only">{unreadWords}: </span>}
          <span className="block text-lead">{letter.subject}</span>
          <span className="block font-normal text-muted">{letterSource(letter.leagueName, letter.from)}</span>
        </span>
      </button>
      <div id={bodyId} hidden={!isOpen} className="bg-ground px-3 py-2 whitespace-pre-line wrap-anywhere">
        {letter.body}
      </div>
    </li>
  );
}
