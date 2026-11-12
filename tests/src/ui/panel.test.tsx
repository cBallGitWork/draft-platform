// The panel pieces every screen shares (src/ui/Panel.tsx): a page's section and a panel are each
// named by their title plate, a notice is a status rather than an alert, and a muted panel line pads
// the side it's asked to, and the close cross keeps its tap area and says what it closes.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { closeGlyph } from "../../../src/shared/words";
import { CloseButton, Notice, PageSection, Panel, PanelNote, Problem, Status } from "../../../src/ui/Panel";

it("names a page's section by its title, with the aside on the plate and the caller's classes kept", () => {
  render(
    <PageSection title="Mail" aside={<span>2 unread</span>} className="max-w-xl bg-panel">
      <p>A letter</p>
    </PageSection>,
  );
  const section = screen.getByRole("region", { name: "Mail" });
  expect(section.className).toBe("max-w-xl bg-panel");
  const plate = screen.getByRole("heading", { level: 1, name: "Mail" }).parentElement;
  expect(plate?.textContent).toBe("Mail2 unread");
  expect(section.textContent).toBe("Mail2 unreadA letter");
});

it("labels a page's section by its own heading's id, with no aside or children", () => {
  render(<PageSection title="Your leagues" />);
  const heading = screen.getByRole("heading", { level: 1, name: "Your leagues" });
  expect(screen.getByRole("region").getAttribute("aria-labelledby")).toBe(heading.id);
});

it("names a panel by its title plate, a level-2 heading, keeping the panel ground and the caller's classes", () => {
  render(
    <Panel title="Squad" className="min-w-0 grow-2">
      <p>A row</p>
    </Panel>,
  );
  const panel = screen.getByRole("region", { name: "Squad" });
  expect(panel.className).toBe("bg-panel min-w-0 grow-2");
  const heading = screen.getByRole("heading", { level: 2, name: "Squad" });
  expect(panel.getAttribute("aria-labelledby")).toBe(heading.id);
  expect(heading.className).toBe("bg-plate px-3 py-1 shadow-bevel-plate text-lead font-bold");
  expect(panel.textContent).toBe("SquadA row");
});

it("sets a panel's title in the second face when it names a team, with or without an aside", () => {
  render(
    <>
      <Panel title="Saka Potatoes" namesTeam />
      <Panel title="Kroos Control" namesTeam aside={<span>11 of 11</span>} />
    </>,
  );
  expect(screen.getByRole("heading", { level: 2, name: "Saka Potatoes" }).className).toBe(
    "bg-plate px-3 py-1 shadow-bevel-plate text-lead display-face",
  );
  expect(screen.getByRole("heading", { level: 2, name: "Kroos Control" }).className).toBe("text-lead display-face");
});

it("puts a panel's aside at the plate's far end, and gives two panels their own ids", () => {
  render(
    <>
      <Panel title="Tactics" aside={<span>11 starting</span>} />
      <Panel title="Fixtures" />
    </>,
  );
  const heading = screen.getByRole("heading", { level: 2, name: "Tactics" });
  expect(heading.className).toBe("text-lead font-bold");
  expect(heading.parentElement?.className).toBe("flex items-baseline justify-between bg-plate px-3 py-1 shadow-bevel-plate");
  expect(heading.parentElement?.textContent).toBe("Tactics11 starting");
  expect(screen.getByRole("region", { name: "Tactics" }).className).toBe("bg-panel");
  expect(heading.id).not.toBe(screen.getByRole("heading", { level: 2, name: "Fixtures" }).id);
});

it("says a notice as a status in the alert strip, where a problem is an alert", () => {
  render(
    <>
      <Notice>2 invites wait for tomorrow</Notice>
      <Problem problem="Refused" />
    </>,
  );
  expect(screen.getByRole("status").className).toBe("alert-strip");
  expect(screen.getByRole("status").textContent).toBe("2 invites wait for tomorrow");
  expect(screen.getByRole("alert").textContent).toBe("Refused");
});

it("keeps a status line in the page while it has no words, with its look only once it has some", () => {
  const { rerender } = render(<Status words={null} className="alert-strip" />);
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("");
  expect(status.getAttribute("class")).toBeNull();

  rerender(<Status words="Saved" className="alert-strip" />);
  expect(screen.getByRole("status")).toBe(status);
  expect(status.textContent).toBe("Saved");
  expect(status.className).toBe("alert-strip");
});

it.each([
  ["no edge given", undefined, "px-3 py-2 text-muted"],
  ["edge y", "y", "px-3 py-2 text-muted"],
  ["edge b", "b", "px-3 pb-2 text-muted"],
  ["edge t", "t", "px-3 pt-2 text-muted"],
] as const)("pads a muted panel line with %s as %s", (_, edge, classes) => {
  render(<PanelNote edge={edge}>None found</PanelNote>);
  expect(screen.getByText("None found").className).toBe(classes);
});

it("draws the close cross as a button named by its label, the glyph hidden, calling close on a click", async () => {
  const close = vi.fn();
  render(<CloseButton label="Close Saka" close={close} className="lg:min-h-0" />);
  const button = screen.getByRole("button", { name: "Close Saka" });
  expect(button.getAttribute("type")).toBe("button");
  expect(button.className).toBe("min-h-tap min-w-tap lg:min-h-0");
  const glyph = button.firstElementChild;
  expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  expect(glyph?.textContent).toBe(closeGlyph);
  await userEvent.click(button);
  expect(close).toHaveBeenCalledTimes(1);
});
