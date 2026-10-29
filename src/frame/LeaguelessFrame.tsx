import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AuthActions } from "../signIn/seam";
import { FeedbackLink } from "../feedback/FeedbackPage";
import { MAIL_PATH } from "./menu";
import { MainMenu, MenuTab } from "./topBar/MenuTab";
import { TOP_BAR, TOP_BAR_ROW } from "../ui/Panel";
import { ProductName } from "./topBar/ProductName";
import { SignOut } from "./topBar/SignOut";
import { MAIL_TITLE } from "../mail/words";
import { LEAGUES_PATH } from "../leagues/paths";
import { LEAGUES_TITLE } from "../leagues/words";

/** The frame for someone signed in but in no league: the name, their leagues, Mail with its count,
 *  Feedback and Sign out, and the banner, if one shows. No league's sections. */
export function LeaguelessFrame({ unreadMail, onSignOut, banner }: { unreadMail: number; onSignOut: AuthActions["signOut"]; banner: ReactNode }) {
  return (
    <>
      <header className={`${TOP_BAR_ROW} ${TOP_BAR}`}>
        <ProductName />
        <MainMenu>
          <MenuTab path={LEAGUES_PATH} label={LEAGUES_TITLE} />
          <MenuTab path={MAIL_PATH} label={MAIL_TITLE} unreadMail={unreadMail} />
        </MainMenu>
        <span className="grow" />
        <FeedbackLink />
        <SignOut onSignOut={onSignOut} />
      </header>
      <main className="p-2">
        {banner}
        <Outlet />
      </main>
    </>
  );
}
