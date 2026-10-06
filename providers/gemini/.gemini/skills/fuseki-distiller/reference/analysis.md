# Analysing a skill definition's insights

Load this before writing anything. The reading is done; this is what to make of it.

## Group

Within one code, put insights together when they are about the same thing: the same step of the
instructions, the same input, the same check under "Done when" (or "DoR" in the planning definitions). An insight may be about two things;
then it is in two groups, and the digest says so.

## Recurring

A group with two or more insights from different runs or different people, saying the same thing in
different words, **recurs**. One insight, however strongly worded, does not: it is left where it is,
named in the digest under what was left alone.

## Contradicting

Two insights that cannot both hold contradict. Two **drafts** that contradict are both left standing
and named in the digest — a person has not looked at either. A draft that contradicts a **confirmed**
learning is left standing, and the digest says which confirmed learning it challenges. Two
**confirmed** learnings that contradict are named in the digest as the question for the person:
neither can be folded away, and only a person may say which survives. None of them is contradicted by
this pass.

## What the instructions should say instead

A recurring group yields a proposal when its insights say the instructions misled, left something
out or said something that did not happen. The proposal is the whole text in force at its level with
the change in place — read it once more as the agent that will follow it next week:

- every heading kept, in its order (`# <Name>`, `## Purpose`, `## Inputs`, `## Steps`, `## Output`,
  `## Done when` — `## DoR (Definition of Ready)` in `plan-epic`, `plan-feature` and `plan-story` — and any the text in
  force carries beyond them);
- the definition's own voice: plain English, numbered steps where it numbers them;
- nothing changed that the insights do not support, and no tool, path or person's name added.

Several recurring groups on one code go into the same proposal: one text, every change in place.

Title: what changes, in one line ("Plan a story: name the acceptance check before the steps").
Body: what recurred, in which runs, and what the change is, then a last line:

```
Distilled from: <insight id> "<title>", <insight id> "<title>", … (change sets <id>, <id>)
```

## The digest

Handed back as the change set's summary; the person reads it as the run report in their inbox and on
the runs screen. Plain lines, counts first, in this order:

```
Insights on FUS since 2026-09-28 01:00 UTC: 5 read, 4 drafts, 1 confirmed.
Proposals (rule on the Guidance tab):
  plan-story, Project level, written against version 3: <proposal id> "Plan a story: name the acceptance check before the steps" — superseded <id>, <id>, <id>
Contradictions (a person decides which holds):
  plan-epic: <id> "…" and <id> "…"
Left alone:
  map-guide: <id> "…" — one insight, nothing recurs
Not read:
  none
```

- the window, and how many insights were read, of which how many drafts;
- every proposal, by code, level, version and identifier, with the identifiers it superseded and
  one clause on what changes;
- every contradiction, each pair by identifier;
- every insight contradicted on the person's word, by identifier;
- what was left alone and why: single insights, drafts that contradict, codes with nothing to fold;
- what the pass could not read: a refusal, a stretch of the window past fifty, a code it could not
  resolve; "none" when there was nothing;
- when the window fell back to 30 days, the line saying so.

No recommendation the person did not ask for, and no learning of the pass's own.
