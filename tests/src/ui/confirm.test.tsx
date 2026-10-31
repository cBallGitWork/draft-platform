// The confirm for a step that deletes or removes (src/ui/Confirm): its yes is the danger action,
// never Continue's white action (plate.md, Decided: Destructive confirms; #403).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { contrast } from "../../../convex/football/clubColours";
import stylesCss from "../../../src/styles.css?raw";
import controlsCss from "../../../src/ui/controls.css?raw";
import { Confirm } from "../../../src/ui/Confirm";

const YES = "Delete it";
const NO = "Keep it";

/** WCAG 2.1 AA: words 4.5:1, a control's edge 3:1. */
const TEXT_CONTRAST = 4.5;
const EDGE_CONTRAST = 3;

const token = (name: string) => stylesCss.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))![1];
/** The danger action's rules, as controls.css writes them. */
const dangerStart = controlsCss.indexOf("@utility danger-action");
const dangerAction = controlsCss.slice(dangerStart, controlsCss.indexOf("@utility", dangerStart + 1));

function renderConfirm(busy = false) {
  const onYes = vi.fn();
  const onNo = vi.fn();
  render(<Confirm question="Delete the league?" yes={YES} no={NO} busy={busy} onYes={onYes} onNo={onNo} />);
  return { onYes, onNo };
}

describe("the confirm", () => {
  it("draws its yes as the danger action and its no as the secondary action, never Continue's", () => {
    renderConfirm();

    expect(screen.getByRole("button", { name: YES }).className).toBe("danger-action");
    expect(screen.getByRole("button", { name: NO }).className).toBe("secondary-action");
  });

  it("answers yes and no", async () => {
    const { onYes, onNo } = renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: YES }));
    await userEvent.click(screen.getByRole("button", { name: NO }));
    expect(onYes).toHaveBeenCalledOnce();
    expect(onNo).toHaveBeenCalledOnce();
  });

  it("while busy, its yes is disabled", () => {
    renderConfirm(true);
    expect(screen.getByRole("button", { name: YES })).toHaveProperty("disabled", true);
  });
});

describe("the danger action", () => {
  it("is edged and worded in the event orange on the alert strip's fill, and under the pointer its edge doubles and its words go white, never Continue's orange fill", () => {
    expect(dangerAction).toContain("background: var(--color-alert)");
    expect(dangerAction).toContain("border: 1px solid var(--color-event)");
    expect(dangerAction).toMatch(/&:enabled:hover \{\s*box-shadow: inset 0 0 0 1px var\(--color-event\);\s*color: var\(--color-fact\);/);
  });

  it("meets WCAG AA in every state: its words on its fill, its edge on a panel", () => {
    expect(contrast(token("event"), token("alert"))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(contrast(token("fact"), token("alert"))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(contrast(token("event"), token("ground"))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(contrast(token("event"), token("ground"))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(contrast(token("muted"), token("alert"))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(contrast(token("event"), token("panel-solid"))).toBeGreaterThanOrEqual(EDGE_CONTRAST);
  });
});
