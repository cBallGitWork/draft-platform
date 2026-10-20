import { Outlet } from "@tanstack/react-router";
import { ProductName } from "../frame/ProductName";
import { SignOut } from "../frame/SignOut";

/** The frame for someone signed in but in no league: the name and Sign out, with no league menu. */
export function LeaguelessFrame({ onSignOut }: { onSignOut: () => Promise<void> }) {
  return (
    <>
      <header className="flex flex-wrap items-stretch bg-plate shadow-bevel-plate">
        <ProductName />
        <span className="grow" />
        <SignOut onSignOut={onSignOut} />
      </header>
      <main className="p-2">
        <Outlet />
      </main>
    </>
  );
}
