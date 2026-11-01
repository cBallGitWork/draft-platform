// The tap-size check (plate.md, The phone: "every target 44px"), run inside the page by
// scripts/shoot.mjs and the smoke run (tests/smoke/smoke.spec.ts), so both measure the same way.
// Pass it to Playwright's page.evaluate: it must stay self-contained, using nothing from this module.

/** Every tap on the page smaller than the tap size (`--spacing-tap`, read from the page) either
 *  way, each said as its name and its smaller side. A tap is as small as its narrower side, so a
 *  17px-wide, 44px-tall button fails (#817). A control is tapped through its labels too, so the
 *  biggest of it and them is what's measured: a tick box's 22px well on its 44px row passes, and so
 *  does a key's hidden radio (the key is its label); a label taps let through (`pointer-events:
 *  none`) is no tap and doesn't count; a control nothing draws (0px) is skipped. */
export function tapsUnderTapSize() {
  const tapToken = getComputedStyle(document.documentElement).getPropertyValue("--spacing-tap").trim();
  if (!/^\d+px$/.test(tapToken)) throw new Error(`--spacing-tap (src/styles.css) is "${tapToken}", not a size in px`);
  const tapSize = parseInt(tapToken, 10);
  const smallerSide = (area) => {
    const { width, height } = area.getBoundingClientRect();
    return Math.min(width, height);
  };
  const tappable = (area) => getComputedStyle(area).pointerEvents !== "none";
  const tapArea = (control) =>
    [...(control.labels ?? [])].filter(tappable).reduce((biggest, area) => (smallerSide(area) > smallerSide(biggest) ? area : biggest), control);
  const name = (control, area) =>
    control.getAttribute("aria-label") ?? (area.textContent?.trim() || control.tagName.toLowerCase());
  const small = [...document.querySelectorAll("a, button, input, select, textarea")]
    .map((control) => {
      const area = tapArea(control);
      return { control, area, side: Math.round(smallerSide(area)) };
    })
    .filter(({ side }) => side > 0 && side < tapSize)
    .map(({ control, area, side }) => `${name(control, area)} (${side}px)`);
  return { tapSize, small };
}
