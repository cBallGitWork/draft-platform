import { PAGE_TITLE_ID, PageTitle } from "./Panel";
import { notBuiltWords } from "./words";

/** A page the menu reaches before its screen is built: its title plate, and a plain line saying so. */
export function PageNotBuilt({ title }: { title: string }) {
  return (
    <section aria-labelledby={PAGE_TITLE_ID} className="max-w-xl bg-panel">
      <PageTitle>{title}</PageTitle>
      <p className="px-3 py-2 text-muted">{notBuiltWords}</p>
    </section>
  );
}
