export function buildMeetingSummaryPrompt(
  transcript: string,
  detectedLanguage: string
): string {
  return `You are a professional meeting notes assistant. Based on the following transcript, generate structured meeting notes.

Respond in ${detectedLanguage} (same language as the transcript).

Output EXACTLY in this format with these exact section headers:

## Summary
[2-4 sentence paragraph summarizing the meeting]

## Key Decisions
[Bullet list of decisions made. Write "None identified." if none.]

## Action Items
[Checkbox list in format "- [ ] Action item (Owner if mentioned)". Write "None identified." if none.]

---

TRANSCRIPT:
${transcript}`;
}
