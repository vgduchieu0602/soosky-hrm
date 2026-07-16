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

  it("displays 13:30 as 01:30 PM and defaults new entries to AM", async () => {
    render(<TimeInput value="13:30" onChange={() => {}} />);
    const segs = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    expect(segs[0].value).toBe("01");
    expect(segs[1].value).toBe("30");
    expect(screen.getByText("PM")).toBeTruthy();
  });

  it("toggling AM/PM converts 12h entry to the correct 24h value", async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "08");
    await userEvent.type(mm, "30");
    expect(onChange).toHaveBeenLastCalledWith("08:30"); // AM default
    await userEvent.click(screen.getByText("AM"));
    expect(onChange).toHaveBeenLastCalledWith("20:30"); // switched to PM
  });

  it("12:00 AM maps to 00:00 and 12:00 PM maps to 12:00", async () => {
    const onChangeMidnight = vi.fn();
    render(<TimeInput value="" onChange={onChangeMidnight} />);
    let [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "12");
    await userEvent.type(mm, "00");
    expect(onChangeMidnight).toHaveBeenLastCalledWith("00:00");
    cleanup();

    const onChangeNoon = vi.fn();
    render(<TimeInput value="" onChange={onChangeNoon} />);
    [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "12");
    await userEvent.type(mm, "00");
    await userEvent.click(screen.getByText("AM"));
    expect(onChangeNoon).toHaveBeenLastCalledWith("12:00");
  });

  it("rejects an out-of-range 12h hour (13) → emits empty", async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "13");
    await userEvent.type(mm, "00");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("pads a single-digit hour to 08 on blur (typing '8' then tabbing away)", async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "8");
    await userEvent.tab(); // blur hh without a second digit
    await userEvent.type(mm, "30");
    expect(onChange).toHaveBeenLastCalledWith("08:30");
  });

  it("pads a single-digit minute to 05 on blur", async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} />);
    const [hh, mm] = screen.getAllByPlaceholderText("--") as HTMLInputElement[];
    await userEvent.type(hh, "08");
    await userEvent.type(mm, "5");
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith("08:05");
  });
});
