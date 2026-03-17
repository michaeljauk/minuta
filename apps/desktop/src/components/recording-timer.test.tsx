import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordingTimer } from "./recording-timer";

describe("RecordingTimer", () => {
  it("displays MM:SS format for durations under one hour", () => {
    render(<RecordingTimer duration={90} />);
    expect(screen.getByText("01:30")).toBeInTheDocument();
  });

  it("displays HH:MM:SS format for durations of one hour or more", () => {
    render(<RecordingTimer duration={3661} />);
    expect(screen.getByText("01:01:01")).toBeInTheDocument();
  });

  it("pads minutes and seconds with leading zeros", () => {
    render(<RecordingTimer duration={65} />);
    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("shows 00:00 for zero duration", () => {
    render(<RecordingTimer duration={0} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("shows 59:59 at the boundary just before one hour", () => {
    render(<RecordingTimer duration={3599} />);
    expect(screen.getByText("59:59")).toBeInTheDocument();
  });

  it("switches to HH:MM:SS exactly at one hour", () => {
    render(<RecordingTimer duration={3600} />);
    expect(screen.getByText("01:00:00")).toBeInTheDocument();
  });
});
