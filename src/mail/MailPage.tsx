import { useEffect, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail/mail";
import { LETTERS_SHOWN } from "../../convex/mail/mailLimits";
import { leagueOpens } from "../../convex/leagues/leagueOpens";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../signIn/seam";
import { Loading, PAGE_STACK, PageSection, Panel, PanelNote } from "../ui/Panel";
import { PlateTabs } from "../ui/PlateTabs";
import { Placeholder } from "../ui/Placeholder";
import { runs } from "../leagues/access";
import type { MailSeam } from "./seam";
import { WriteToLeague } from "./WriteToLeague";
import {
  LETTERS_TITLE,
  MAIL_TABS,
  MAIL_TITLE,
  WRITE_TITLE,
  fromWords,
  kindPlaceholderLabel,
  letterDate,
  letterTime,
  letterWhen,
  loadingWords,
  mailTabWords,
  mailTabsLabel,
  noLetterOpenWords,
  noLettersWords,
  noUnreadWords,
  onlyLatestWords,
  senderWords,
  unreadWords,
  type MailTab,
} from "./words";

/** The leagues a letter to the whole league can go from: those the person runs, or, for the
 *  admin, every league, but only one that opens (`leagueOpens`). The server checks again. */
export function leaguesToWriteFrom(session: Session): readonly LeagueSummary[] {
  if (!session.signedIn) return [];
  return session.leagues.filter((league) => leagueOpens(league) && runs(league));
}

/** What the right-hand panel shows: a letter, the letter being written to the league, or nothing. */
type Reading = { letter: Id<"letters"> } | "writing" | null;

/** Mail (spec/16; docs/design/approved/mail/): the letters of the league picked in the top bar
 *  (S16.1), with the site's, down the left under their days, newest first, All or only the unread;
 *  the one selected open on the right, which marks it read; and, for whoever runs a league, Write
 *  to the league on the plate, opening the letter to write there. `opened` is a letter the address
 *  names, open from the start (a screen's Mail widget links to it). */
export function MailPage({
  mail,
  leagueId,
  writableLeagues,
  leaguesCut,
  opened,
}: {
  mail: MailSeam;
  /** The league picked in the top bar; null for someone in none, who reads every letter. */
  leagueId: Id<"leagues"> | null;
  writableLeagues: readonly LeagueSummary[];
  /** The person's leagues stop short, so `writableLeagues` may miss one they run (#297). */
  leaguesCut: boolean;
  opened?: Id<"letters">;
}) {
  const [tab, choose] = useState<MailTab>("all");
  const [reading, read] = useState<Reading>(opened === undefined ? null : { letter: opened });
  const letters = mail.useLetters(leagueId);
  const openId = reading !== null && reading !== "writing" ? reading.letter : null;
  // The letter the address opened is marked read once the letters arrive, as selecting it would be.
  const unreadOpened = opened !== undefined && (letters?.some((letter) => letter.letterId === opened && !letter.read) ?? false);
  useEffect(() => {
    if (unreadOpened && opened !== undefined) void mail.open(opened);
  }, [unreadOpened, opened, mail]);

  const unread = letters?.filter((letter) => !letter.read).length ?? 0;
  const open = (letter: LetterSummary) => {
    read({ letter: letter.letterId });
    if (!letter.read) void mail.open(letter.letterId);
  };
  const plate = (
    <>
      <PlateTabs label={mailTabsLabel} tabs={MAIL_TABS} words={mailTabWords(unread)} chosen={tab} choose={choose} />
      {writableLeagues.length > 0 && (
        <button type="button" aria-pressed={reading === "writing"} onClick={() => read("writing")} className="secondary-action self-center">
          {WRITE_TITLE}
        </button>
      )}
    </>
  );
  const openLetter = letters?.find((letter) => letter.letterId === openId);
  return (
    <PageSection title={MAIL_TITLE} aside={plate} className={PAGE_STACK}>
      <div className="grid items-start gap-2 lg:grid-cols-mail">
        <Panel title={LETTERS_TITLE} className="min-w-0">
          {letters === undefined ? (
            <Loading className="px-3 py-2">{loadingWords}</Loading>
          ) : (
            <Letters letters={tab === "unread" ? letters.filter((letter) => !letter.read || letter.letterId === openId) : letters} tab={tab} openId={openId} open={open} />
          )}
        </Panel>
        {reading === "writing" ? (
          <WriteToLeague leagues={writableLeagues} cut={leaguesCut} writeToLeague={mail.writeToLeague} />
        ) : openLetter ? (
          <OpenLetter letter={openLetter} />
        ) : (
          <div className="bg-panel">
            <PanelNote>{noLetterOpenWords}</PanelNote>
          </div>
        )}
      </div>
    </PageSection>
  );
}

/** The letters, grouped under the day each came, newest first. */
function Letters({
  letters,
  tab,
  openId,
  open,
}: {
  letters: readonly LetterSummary[];
  tab: MailTab;
  openId: Id<"letters"> | null;
  open: (letter: LetterSummary) => void;
}) {
  if (letters.length === 0) return <PanelNote>{tab === "unread" ? noUnreadWords : noLettersWords}</PanelNote>;
  return (
    <>
      <ol>
        {byDay(letters).map(({ day, letters: ofDay }) => (
          <li key={day}>
            <h3 className="bg-ground px-3 py-1 font-semibold">{day}</h3>
            <ol>
              {ofDay.map((letter) => (
                <LetterRow key={letter.letterId} letter={letter} isOpen={openId === letter.letterId} open={() => open(letter)} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {letters.length >= LETTERS_SHOWN && <PanelNote>{onlyLatestWords}</PanelNote>}
    </>
  );
}

/** The letters in runs of one day each, in the order given. */
function byDay(letters: readonly LetterSummary[]): { day: string; letters: LetterSummary[] }[] {
  const days: { day: string; letters: LetterSummary[] }[] = [];
  for (const letter of letters) {
    const day = letterDate(letter.at);
    const last = days.at(-1);
    if (last?.day === day) last.letters.push(letter);
    else days.push({ day, letters: [letter] });
  }
  return days;
}

/** A letter's row: its kind, who it's from, its subject and the time. Unread, the orange edge and
 *  a bold subject; open, the cyan edge and a tint (plate.md, Marks). */
function LetterRow({ letter, isOpen, open }: { letter: LetterSummary; isOpen: boolean; open: () => void }) {
  const edge = isOpen ? "bg-stepper shadow-current-edge" : letter.read ? "" : "shadow-event-edge";
  return (
    <li className="border-b border-panel-rule">
      <button
        type="button"
        aria-current={isOpen ? "true" : undefined}
        onClick={open}
        className={`grid min-h-tap w-full grid-cols-letter-row items-center gap-3 px-3 py-1 text-left hover:bg-stepper ${edge}`}
      >
        <Placeholder label={kindPlaceholderLabel} className="h-4 w-full" />
        <span className="min-w-0">
          {!letter.read && <span className="sr-only">{unreadWords}: </span>}
          <span className="block truncate text-muted">{senderWords(letter.leagueName, letter.from)}</span>
          <span className={`block truncate ${letter.read ? "text-soft" : "font-semibold text-fact"}`}>{letter.subject}</span>
        </span>
        <time dateTime={new Date(letter.at).toISOString()} className="text-muted">
          {letterTime(letter.at)}
        </time>
      </button>
    </li>
  );
}

/** The open letter: who it's from and when on the plate, then its subject over its text. */
function OpenLetter({ letter }: { letter: LetterSummary }) {
  return (
    <Panel
      title={fromWords(senderWords(letter.leagueName, letter.from))}
      aside={<time dateTime={new Date(letter.at).toISOString()}>{letterWhen(letter.at)}</time>}
      className="min-w-0"
    >
      <article className="flex flex-col gap-3 p-4">
        <h3 className="text-lead font-bold text-fact">{letter.subject}</h3>
        <p className="whitespace-pre-line wrap-anywhere">{letter.body}</p>
      </article>
    </Panel>
  );
}
