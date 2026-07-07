import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeInput } from "./time-input";

afterEach(cleanup);

describe("TimeInput", () => {
  it("renders the two segments (hh, mm) from an initial value", () => {
    render(<TimeInput value="08:30" onChange={() => {}} />);
    const segs = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    expect(segs).toHaveLength(2);
    expect(segs[0].value).toBe("08");
    expect(segs[1].value).toBe("30");
  });

  it("emits HH:mm once both segments are complete and valid", async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "08");
    await userEvent.type(mm, "30");
    expect(onChange).toHaveBeenLastCalledWith("08:30");
  });

  it("rejects an out-of-range hour (25) → emits empty", async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "25");
    await userEvent.type(mm, "00");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("strips non-digits and caps a segment at 2 chars", async () => {
    render(<TimeInput value="" onChange={() => {}} />);
    const [hh] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "1a2b3");
    expect(hh.value).toBe("12");
  });
});
