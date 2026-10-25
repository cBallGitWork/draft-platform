import { Outlet } from "@tanstack/react-router";
import type { AuthActions } from "../auth";
import { MAIL_PATH } from "../frame/menu";
import { MenuTab } from "../frame/MenuTab";
import { TOP_BAR, TOP_BAR_ROW } from "../frame/Panel";
import { ProductName } from "../frame/ProductName";
import { SignOut } from "../frame/SignOut";
import { MAIL_TITLE } from "../mail/words";
import { LEAGUES_PATH } from "./paths";
import { LEAGUES_TITLE } from "./words";

/** The frame for someone signed in but in no league: the name, their leagues, Mail with its count,
 *  and Sign out. No league menu. */
export function LeaguelessFrame({ unreadMail, onSignOut }: { unreadMail: number; onSignOut: AuthActions["signOut"] }) {
  return (
    <>
      <header className={`${TOP_BAR_ROW} ${TOP_BAR}`}>
        <ProductName />
        {/* On a phone the two tabs take their own row under the name and Sign out, as the menu does. */}
        <div className="order-last flex w-full border-t border-plate-rule lg:order-none lg:w-auto lg:border-t-0 lg:border-r">
          <MenuTab path={LEAGUES_PATH} label={LEAGUES_TITLE} />
          <MenuTab path={MAIL_PATH} label={MAIL_TITLE} unreadMail={unreadMail} />
        </div>
        <span className="grow" />
        <SignOut onSignOut={onSignOut} />
      </header>
      <main className="p-2">
        <Outlet />
      </main>
    </>
  );
}
