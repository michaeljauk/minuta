import { describe, expect, it } from "vitest";
import { buildMeetingSummaryPrompt } from "./prompts";

describe("buildMeetingSummaryPrompt", () => {
  it("includes the transcript in the output", () => {
    const transcript = "Alice: Let's ship it. Bob: Agreed.";
    const result = buildMeetingSummaryPrompt(transcript, "English");
    expect(result).toContain(transcript);
  });

  it("includes the detected language instruction", () => {
    const result = buildMeetingSummaryPrompt("some text", "German");
    expect(result).toContain("German");
  });

  it("contains all required section headers", () => {
    const result = buildMeetingSummaryPrompt("text", "English");
    expect(result).toContain("## Summary");
    expect(result).toContain("## Key Decisions");
    expect(result).toContain("## Action Items");
  });

  it("includes the action item checkbox format instruction", () => {
    const result = buildMeetingSummaryPrompt("text", "English");
    expect(result).toContain("- [ ]");
  });
});
