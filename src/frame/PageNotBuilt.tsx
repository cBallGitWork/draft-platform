import { PageSection, PanelNote } from "../ui/Panel";
import { notBuiltWords } from "./words";

/** A page the menu reaches before its screen is built: its title plate, and a plain line saying so. */
export function PageNotBuilt({ title }: { title: string }) {
  return (
    <PageSection title={title} className="max-w-xl bg-panel">
      <PanelNote>{notBuiltWords}</PanelNote>
    </PageSection>
  );
}
