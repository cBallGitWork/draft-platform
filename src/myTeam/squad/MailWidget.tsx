import { Link } from "@tanstack/react-router";
import type { LetterSummary } from "../../../convex/mail/mail";
import { MAIL_PATH } from "../../frame/menu";
import { letterLink } from "../../mail/paths";
import { letterDay, unreadCount, unreadWords } from "../../mail/words";
import { Loading, Panel, PanelNote } from "../../ui/Panel";
import type { LatestMail } from "./seam";
import { allMailWords, MAIL_WIDGET_TITLE, mailLoadingWords, nextGlyph, noMailWords } from "./words";

// The Squad tab's Mail and news (its approved picture): the newest letters, unread ones with
// Mail's orange edge (plate.md, Marks: Unread); a letter opens it in Mail, and All mail opens Mail.

/** `mail` is undefined while it loads, and null for someone signed out, who has none. */
export function MailWidget({ mail }: { mail: LatestMail | null | undefined }) {
  return (
    <Panel title={MAIL_WIDGET_TITLE} aside={mail ? <span>{unreadCount(mail.unread)}</span> : undefined}>
      {mail === undefined ? (
        <Loading className="px-3 py-2">{mailLoadingWords}</Loading>
      ) : mail === null || mail.letters.length === 0 ? (
        <PanelNote>{noMailWords}</PanelNote>
      ) : (
        <ol>
          {mail.letters.map((letter) => (
            <MailLine key={letter.letterId} letter={letter} />
          ))}
        </ol>
      )}
      <Link to={MAIL_PATH} className="flex min-h-tap items-center px-3 font-semibold lg:min-h-0 lg:py-1">
        {allMailWords} <span aria-hidden="true">&nbsp;{nextGlyph}</span>
      </Link>
    </Panel>
  );
}

function MailLine({ letter }: { letter: LetterSummary }) {
  return (
    <li className="border-b border-panel-rule">
      <Link {...letterLink(letter.letterId)} className={`flex flex-col px-3 py-1 hover:bg-stepper ${letter.read ? "" : "shadow-event-edge"}`}>
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate ${letter.read ? "text-muted" : "font-semibold"}`}>
            {!letter.read && <span className="sr-only">{unreadWords}: </span>}
            {letter.subject}
          </span>
          <time dateTime={new Date(letter.at).toISOString()} className="shrink-0 text-muted">
            {letterDay(letter.at)}
          </time>
        </span>
        <span className="truncate text-muted">{letter.body}</span>
      </Link>
    </li>
  );
}
