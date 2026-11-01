import { useEffect, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail/mail";
import { LETTERS_SHOWN } from "../../convex/mail/mailLimits";
import { leagueOpens } from "../../convex/leagues/leagueOpens";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../signIn/seam";
import { DateBlock } from "./DateBlock";
import { Loading, PageSection, PanelNote } from "../ui/Panel";
import { runs } from "../leagues/roles";
import type { MailSeam } from "./seam";
import { WriteToLeague } from "./WriteToLeague";
import {
  MAIL_TITLE,
  letterSource,
  loadingWords,
  noLettersWords,
  onlyLatestWords,
  unreadCount,
  unreadWords,
} from "./words";

/** The leagues a letter to the whole league can go from: those the person runs, or, for the
 *  admin, every league, but only one that opens (`leagueOpens`). The server checks again. */
export function leaguesToWriteFrom(session: Session): readonly LeagueSummary[] {
  if (!session.signedIn) return [];
  return session.leagues.filter((league) => leagueOpens(league) && runs(league));
}

/** Mail (spec/16): the person's letters, newest first, each opened in place, which marks it read;
 *  and, for whoever runs a league, a letter to the whole league. `opened` is a letter the address
 *  names, open from the start (a screen's Mail widget links to it). */
export function MailPage({
  mail,
  unread,
  writableLeagues,
  opened,
}: {
  mail: MailSeam;
  unread: number;
  writableLeagues: readonly LeagueSummary[];
  opened?: Id<"letters">;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <PageSection title={MAIL_TITLE} aside={<span>{unreadCount(unread)}</span>} className="min-w-0 max-w-3xl grow-2 basis-letters bg-panel">
        <Letters mail={mail} opened={opened ?? null} />
      </PageSection>
      {writableLeagues.length > 0 && <WriteToLeague leagues={writableLeagues} writeToLeague={mail.writeToLeague} />}
    </div>
  );
}

function Letters({ mail, opened }: { mail: MailSeam; opened: Id<"letters"> | null }) {
  const [openId, setOpenId] = useState<Id<"letters"> | null>(opened);
  const letters = mail.useLetters();
  // The letter the address opened is marked read once the letters arrive, as a tap on it would be.
  const unreadOpened = letters?.some((letter) => letter.letterId === opened && !letter.read) ?? false;
  useEffect(() => {
    if (unreadOpened && opened !== null) void mail.open(opened);
  }, [unreadOpened, opened, mail]);
  if (letters === undefined) return <Loading className="px-3 py-2">{loadingWords}</Loading>;
  if (letters.length === 0) return <PanelNote>{noLettersWords}</PanelNote>;

  function toggle(letter: LetterSummary) {
    const opening = openId !== letter.letterId;
    setOpenId(opening ? letter.letterId : null);
    if (opening && !letter.read) void mail.open(letter.letterId);
  }

  return (
    <>
      <ol>
        {letters.map((letter) => (
          <Letter key={letter.letterId} letter={letter} isOpen={openId === letter.letterId} onToggle={() => toggle(letter)} />
        ))}
      </ol>
      {letters.length >= LETTERS_SHOWN && <PanelNote>{onlyLatestWords}</PanelNote>}
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
        className={`grid min-h-tap w-full grid-cols-dated-row items-start gap-2 px-3 py-1 text-left hover:bg-stepper ${letter.read ? "" : "shadow-event-edge"}`}
      >
        <DateBlock at={letter.at} />
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
