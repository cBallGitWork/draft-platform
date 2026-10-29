// What a screen reader hears after a box's name: the words of the elements its aria-describedby
// names, in order. The repo has no jest-dom, so this stands in for toHaveAccessibleDescription.

export function descriptionOf(box: HTMLElement): string {
  const ids = box.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}
