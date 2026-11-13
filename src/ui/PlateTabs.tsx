const TAB =
  "min-h-tap border-l border-plate-rule px-4 font-semibold text-soft first:border-l-0 hover:text-fact " +
  "aria-pressed:text-fact aria-pressed:shadow-tab-active lg:min-h-bar-control";

/** A page's tabs, butted on its title plate after the title (the approved Table and Scouting
 *  pictures): one button each, the chosen one pressed. Tabs too many for the phone's width wrap
 *  onto the plate's next line rather than push the page sideways (League settings' six; #1034). */
export function PlateTabs<Tab extends string>({
  label,
  tabs,
  words,
  chosen,
  choose,
}: {
  label: string;
  tabs: readonly Tab[];
  words: Record<Tab, string>;
  chosen: Tab;
  choose: (tab: Tab) => void;
}) {
  return (
    <span role="group" aria-label={label} className="ml-6 flex grow flex-wrap self-stretch">
      {tabs.map((tab) => (
        <button key={tab} type="button" aria-pressed={chosen === tab} onClick={() => choose(tab)} className={TAB}>
          {words[tab]}
        </button>
      ))}
    </span>
  );
}
