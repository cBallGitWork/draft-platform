// The plate's tick box (plate.md, Controls; src/rules/TickBox): one that can't be changed doesn't
// answer a click, and one whose label is hidden is still named by it for screen readers.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TickBox } from "../../../src/rules/TickBox";

const LABEL = "Gameweek 7";

const box = () => screen.getByRole("checkbox", { name: LABEL }) as HTMLInputElement;

describe("the tick box", () => {
  it("says it's ticked, and a click asks for the other state", async () => {
    const onChange = vi.fn();
    render(<TickBox checked onChange={onChange}>{LABEL}</TickBox>);

    expect(box().checked).toBe(true);
    expect(box().disabled).toBe(false);
    await userEvent.click(box());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("when disabled, ignores a click on the box or its row", async () => {
    const onChange = vi.fn();
    render(<TickBox checked={false} disabled onChange={onChange}>{LABEL}</TickBox>);

    expect(box().disabled).toBe(true);
    await userEvent.click(box());
    await userEvent.click(box().closest("label")!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("with its label hidden, is still named by it, and the words are only read out", async () => {
    const onChange = vi.fn();
    render(<TickBox checked={false} onChange={onChange} labelHidden>{LABEL}</TickBox>);

    expect(screen.getByText(LABEL).className).toContain("sr-only");
    await userEvent.click(box().closest("label")!);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows its words when the label isn't hidden", () => {
    render(<TickBox checked={false} onChange={vi.fn()}>{LABEL}</TickBox>);
    expect(box().closest("label")!.querySelector(".sr-only")).toBeNull();
  });
});
