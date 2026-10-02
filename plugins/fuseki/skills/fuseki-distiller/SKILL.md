---
name: fuseki-distiller
description: Distil the insights recorded about how a Fuseki project's skill definitions worked — the drafts runs left when something blocked them — into one proposal per skill definition whose instructions should change, written as the whole new text, at the project's level or the organisation's, superseding the drafts it folds and naming contradictions. It never approves, applies, rejects or deletes anything: a person does, on the skill definition's Guidance tab. Use when the person says "distil the insights", "what did we learn about plan-story", "fold the learnings", when the Weekly distiller routine fires, or when blockers were recorded and the person asks what a skill definition should say instead.
argument-hint: <project key> [skill definition code] [since <date> | since the last run] [change set id]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" *), Bash(date *), mcp__fuseki__list_insights, mcp__fuseki__get_insight, mcp__fuseki__list_skill_definitions, mcp__fuseki__get_skill_definition, mcp__fuseki__record_skill_definition_insight, mcp__fuseki__supersede_insight, mcp__fuseki__contradict_insight, mcp__fuseki__list_routines, mcp__fuseki__get_routine, mcp__fuseki__list_change_sets, mcp__fuseki__get_change_set, mcp__fuseki__start_change_set, mcp__fuseki__observe_change_set, mcp__fuseki__complete_change_set, mcp__fuseki__get_project, mcp__fuseki__list_projects, mcp__fuseki__list_portfolios
---

# Fuseki distiller

An insight is the raw record of what went wrong when a skill followed its definition: a draft a run
left after a blocker, on the person's word. Insights are never fetched with a definition, and no
other skill reads them on its own. This skill is the one that reads them on purpose, all together,
and turns what they say into the one thing that changes a definition: a **proposal** — an insight
carrying the whole new text — that a person approves and applies on the skill definition's Guidance
tab.

Every write carries a `changeSetId`, so the project's history says which run wrote the proposal and
superseded the drafts.

## Two triggers, one pass

| Trigger | Who invokes you | The change set | Where the window starts | What you hand back |
| --- | --- | --- | --- | --- |
| The Weekly distiller routine fired | `fuseki-routines`, inside the change set it opened naming the routine | the routine's: you open none and complete none | the previous firing, which `fuseki-routines` hands you | the digest, which `fuseki-routines` completes the change set with |
| A person asks: "distil the insights on FUS" | the person | yours: `start_change_set(projectKey, summary)` first, `complete_change_set` last | the Weekly distiller's last firing | the digest, as the change set's summary and as your answer |

**Handed a change set id, you never complete it** — not when the pass is done, not when nobody says
who will. It is the routine's run, and `fuseki-routines` completes it with your digest; completing it
yourself ends that run under it. Your last call is the last `observe_change_set`, and your answer ends
"Change set <id> is still running; its caller completes it with this digest." Handed none, open one
with a one-line summary ("Distil the insights on FUS"), no `routineId` — a person asking is not a
routine — and complete it at the end with outcome `Completed` and the digest as its summary. That
change set is the only one you ever complete.

**A run the routine fired is unattended to its last word.** Nobody is asked anything: what needs a
person goes in the digest, which lands in their inbox as the run report. In a person's session the
digest is also your answer, and the person is there for a question only where the pass cannot go on
without one.

The project is the one named, else the one this repository is bound to
(`node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" state get project`). The pass works on **that project's insights**: the routine is the
project's, and its instructions say "on this project".

## The pass

1. **The window.** A skill definition named → that code only; a moment named → from it. Otherwise
   from the previous firing of the project's Weekly distiller, the first of these that answers:
   - the moment `fuseki-routines` handed you;
   - `lastFiredAtUtc` of the routine named Weekly distiller in `list_routines(projectKey)` — **except
     inside that routine's own change set**, where it is this run's own start: skip it there;
   - the `startedAtUtc` of the newest Completed change set of that routine other than the one you work
     in: `list_change_sets(projectKey, routineId, status: Completed)`;
   - 30 days before now (`date -u "+%Y-%m-%dT%H:%M:%SZ"`), **and the digest says so**: "No earlier
     firing of the Weekly distiller; read the last 30 days."
2. **Read.** `list_insights(projectKey, since)` (with `code` when one was named). Read every status:
   drafts and confirmed learnings are input; `Rejected`, `Deprecated` and `Contradicted` are context,
   never input. Group the rows by `skillDefinitionCode`. `get_insight` when a body needs reading
   whole.

   **An answer with `notReturnedCount` above zero has not read the window.** It carries at most fifty
   insights, newest first. Read it again in narrower pieces until nothing is left out — one code at a
   time, then halves of the window — and if a piece still overflows, work the pieces you read whole
   and **name in the digest which stretch and how many insights you never saw**. A pass that distils
   part of the window and reports it as the window is worse than one that refuses.
3. **Choose the level, per code** ([reference/levels.md](reference/levels.md)): `Project` when every
   insight you will fold came from this one project — always, when the read was the project's —
   `Organisation` otherwise.
4. **Read the text in force at that level**, once per code with insights to fold:
   `get_skill_definition(code, projectKey)` for `Project`, `get_skill_definition(code)` for
   `Organisation`. A proposal is written against that text and its version, whole.
5. **Analyse**, per code, by [reference/analysis.md](reference/analysis.md): what recurs, what
   contradicts, and whether the instructions should say something else, and what.
6. **Write, per code, in this order**, every call carrying `changeSetId`:
   - **one** `record_skill_definition_insight(code, projectKey, title, body, proposedText, proposalScope,
     changeSetId)` — `proposedText` the whole new instructions with the change in place,
     `proposalScope` the level of step 3, `projectKey` the project the insights came from (required
     with `Project`), and a body ending with the "Distilled from:" line;
   - then `supersede_insight(code, insightId, supersededByInsightId, changeSetId)` for each draft the
     proposal folds, `supersededByInsightId` being the proposal you just recorded. A draft a person
     rejected, and a learning a person confirmed, are never superseded: they are read, not folded away;
   - then `observe_change_set(changeSetId, note)`: what was read, written and superseded for that
     code, by identifier.

   A code with insights and nothing to fold still gets its `observe_change_set` line, saying why.
7. **Hand back** the digest of [reference/analysis.md](reference/analysis.md): handed a change set,
   as your answer, the change set left running; your own, `complete_change_set` with outcome
   `Completed` and the digest as its summary, then the digest as your answer.

## Where the proposal lands

The server stamps the proposal with the version in force at its level and puts a review row in the
inbox of the people who rule on that level — you send nothing about it. A person approves it on the
skill definition's Guidance tab and applies it there; at a level with no copy yet, the tab offers
"Customise, then apply". The next `get_skill_definition` at that level reads the applied text. Until
then nothing has changed, and you never say it has.

## What you never do

- Approve, reject, apply, put under trial or confirm an insight, or customise, edit or remove a
  definition. No tool does any of them: they are a person's, on the Guidance tab. When asked, say
  where they do it — `https://fuseki.dev/dashboard/projects/<project key>/settings/skills/<code>` for a
  project's proposal, `https://fuseki.dev/dashboard/organisation/skill-definitions/<code>` for the
  organisation's.
- Contradict an insight on your own judgement, or because it is old. `contradict_insight` only on the
  person's word in this session, naming the insight; never in a run the routine fired.
- Delete anything. Superseding keeps the row and marks it.
- Record a learning of your own, or a proposal from one insight that does not recur.
- Write more than one proposal per code per pass.
- Complete, cancel or fail a change set you were handed.

## Reading a refusal

- `INVALID_ARGUMENT` naming `since` — a moment in the future; read the clock again.
- `INVALID_ARGUMENT` naming `code` — not one of the thirteen codes; the refusal lists them.
- `INVALID_ARGUMENT` naming `proposalScope` or `projectKey` — text needs a level, a level needs text,
  and `Project` needs the project's key.
- `CONFLICT` on `supersede_insight` saying it is already superseded — another pass folded it; leave it.
- `NOT_FOUND` or `CONFLICT` on `supersede_insight` naming the newer insight — it is not about the same
  skill definition; you recorded the proposal under the wrong code. Record it again under the draft's
  code, then supersede.
- `CONFLICT` naming the change set — it was completed, cancelled or failed by the server. Nothing was
  written. Stop and hand back; a run the routine fired is opened again by the next firing.
- `FORBIDDEN` — the person's role cannot read skill definitions or write in a change set; say so and
  stop.

## Rules that are easy to get wrong

- **A proposal is the whole text**, every heading kept, with the change in place — not a diff and
  not the paragraph that changes. A fragment applied is a definition with a hole in it.
- **One proposal per code per pass.** Three drafts on `plan-story` become one proposal on
  `plan-story`, not three.
- **Never invent a learning.** Every sentence the proposal changes traces to an insight you read,
  named in its body. A pass that finds nothing to fold says so.
- **The window is the previous firing, not this one.** Inside the routine's own run its
  `lastFiredAtUtc` is the run you are in.
- **Report by identifier and code**, and report what the tools answered, never what you meant to
  write.
