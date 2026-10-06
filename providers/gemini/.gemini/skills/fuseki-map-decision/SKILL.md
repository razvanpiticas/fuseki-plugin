---
name: fuseki-map-decision
description: Write a decision record in this repository's wiki — one architectural decision of a subsystem or of the whole system, numbered, with its context, what was chosen, the alternatives turned down and its consequences, short enough to read in a minute — by the method the server holds as the skill definition map-decision, under the documentation root's wiki/subsystems/<name>/decisions or wiki/system-wide/decisions, and, after each run, update and maintain the wiki mapping in .fuseki/state.json. An accepted record is never edited: a new one supersedes it. Use when the person asks to write or record a decision record or an ADR, to write down why the code is built the way it is, to supersede an earlier decision, or picks "Write a decision record" from the Fuseki menu.
---

# Write a decision record

The method — what a record holds, how short it stays, when a decision is significant enough, how an earlier one is superseded and when the record is done — is not in this file. It is the skill definition `map-decision`, which the server
holds and a person customises for the organisation or for one project, so the method changes without
a new plugin. This file is the mechanics: where the record goes, what it is named and what
`.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that.

**The scope comes first.** A decision of one subsystem is a subsystem record: its folder is
`decisions/` and its key in the subsystem's entry is `decisions`, as the next paragraph says. A
decision that spans subsystems or the whole system is a system-wide record: it goes in
`<docsRoot>/wiki/system-wide/decisions/` (`mkdir -p` it first), belongs to no subsystem, and its path
is recorded in `wiki.systemWide.decisions` instead — read `fuseki state get wiki.systemWide`, then
`fuseki state set wiki.systemWide.decisions '["<path>", …]'` with this path added and every path
already listed kept, never twice. The paragraph below is for a subsystem record only.

**Where the document goes, and how it is recorded.** Read the documentation root with `fuseki state get docsRoot`; empty means the repository is not set up, so run the fuseki skill first. The document belongs to one subsystem: the one the person named, else ask which. Its folder is `<docsRoot>/wiki/subsystems/<subsystem>/`, the name lowercase with hyphens. Read `fuseki state get wiki.subsystems` before writing anything. **A subsystem with no entry is not mapped:** say so, and offer to map it first with the fuseki-map-subsystem skill. On a yes, map it that way, then come back to this document. On a no, or when the person said not to ask, go on without mapping it. Write the document at `<docsRoot>/wiki/subsystems/<subsystem>/<folder>/<document>.md` — the folder this skill's mechanics name, `<document>` as they name it, else lowercase with hyphens — reading it first when it exists and changing what the definition says to change. Then record its path, relative to the repository's root, in that subsystem's entry, under the key this skill's mechanics name. When the subsystem has an entry, set that one list with this path added and every path already in it kept: `fuseki state set wiki.subsystems.<subsystem>.<key> '["<path>", …]'`. When it has none, create it: set the whole entry, with `root` the subsystem's folder, this path in this skill's list and every other value empty: `fuseki state set wiki.subsystems.<subsystem> '{"root":"<docsRoot>/wiki/subsystems/<subsystem>","architecture":"","structure":"","systems":[],"crossCutting":[],"guides":[],"patterns":[],"walkthroughs":[],"decisions":[]}'`. A path already listed is not added twice; a document updated in place keeps its one entry. No other key is written.

**The record's name.** `<document>` is `ADR-<number>-<the decision, lowercase with hyphens>`: one past
the highest number already in the target `decisions/` folder, at the width that folder already uses
(after `ADR-0001` comes `ADR-0002`), and `ADR-001` when the folder is empty. The decision is the
record's title as a sentence, so the name says what was decided:
`ADR-004-webhooks-are-the-truth-not-the-checkout-redirect.md`.

**An accepted record is never edited.** A decision that reverses or significantly changes an earlier
one is a new record, with a new number, that supersedes it; the only change to the earlier record is
its Status line, set to `Superseded by [ADR-<number>](./ADR-<number>-<slug>.md)`. A record that
already holds this decision is named, and nothing is written. The superseded record keeps its path and
its one entry in the state.

Before following the definition, read every record already in the target `decisions/` folder. When
the decision came from a story, `get_work_item` reads it; `git log` and `git show` find its commits,
and the record names them. Follow the definition, reading the code for every class, path and number
the record names. The summary row the definition adds goes in the decisions table of the matching
architecture document — the subsystem's `architecture` or `wiki.systemWide.architecture` — which is
already recorded and keeps its entry. Answers the person already gave are answers: do not ask them
again. `wiki.*` belongs to the mapping skills, and this one writes only the decisions list of its
scope (and, for a subsystem not mapped yet, that subsystem's new entry).

This skill writes nothing on the server while it works, so it opens no change set. An insight is recorded inside one, so when the person says yes to recording an insight, open one then — `start_change_set` with the bound project's key and a one-line summary naming this skill and the moment from `date -u "+%Y-%m-%d %H:%M:%S"`, so a second insight opens its own change set — call `record_skill_definition_insight` with its `changeSetId`, and complete it with `complete_change_set`, outcome `Completed` and a one-line summary.

Report the record by path, the decision in one line, any record it superseded, the row added, and the
definition's level and version.
