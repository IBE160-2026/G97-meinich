# AI sessions

One file per working session with an AI tool that produced or changed code, a planning document or a decision. The point is traceability: a reader should be able to go from a pull request or commit to the session that produced it, see what was asked, and see where the AI was corrected.

`docs/ai-log.md` is the companion: it records the lessons — what went wrong and how it was caught. This folder records the sessions themselves.

## File name

`YYYY-MM-DD-<topic>.md`, for example `2026-10-14-story-1.2-analysis-page.md`. Use the story id in the topic when the session belongs to a story.

## Template

```markdown
# <Short title>

**Date:** YYYY-MM-DD
**Tool:** Claude Code (model) / ChatGPT / …
**Story / issue:** #n, story id — or "planning"
**Result:** PR #n / commits abc1234, def5678 / documents changed

## Goal
One or two sentences: what the session was for.

## Prompts that mattered
The prompts that shaped the outcome, verbatim or close to it. Not every message — the ones a reader needs to understand the result.

## What came back, and what was done with it
- Accepted: …
- Rejected, and why: …
- Corrected, and how it was caught: …

## Links
AI-log entries, review findings, documents updated.
```

## What to keep out

No secrets, API keys or personal data. Transcripts exported in full are welcome as an attachment, but the summary above is what a reader looks at first.
