---
name: fuseki-map-pattern
description: Write a pattern document in this repository's wiki — one reusable implementation pattern the code follows, with where it is used and why — by the method the server holds as the skill definition map-pattern, under the documentation root's wiki/subsystems/<name>/patterns, and record it in .fuseki/state.json. Use when the person asks to write or refresh a pattern document, to document a convention the code repeats, or picks "Write a pattern" from the Fuseki menu.
---

# Write a pattern document

The method — what a pattern document covers, how the pattern is found in the code and when the document is done — is not in this file. It is the skill definition `map-pattern`, which the server
holds and a person customises for the organisation or for one project, so the method changes without
a new plugin. This file is the mechanics: where the document goes and what `.fuseki/state.json`
records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that. This skill's folder is `patterns/` and its key in a
subsystem's entry is `patterns`.

**Where the document goes, and how it is recorded.** Read the documentation root with `fuseki state get docsRoot`; empty means the repository is not set up, so run the fuseki skill first. The document belongs to one subsystem: the one the person named, else ask which. Its folder is `<docsRoot>/wiki/subsystems/<subsystem>/`, the name lowercase with hyphens. Write the document at `<docsRoot>/wiki/subsystems/<subsystem>/<folder>/<document>.md` — the folder this skill's mechanics name, `<document>` lowercase with hyphens — reading it first when it exists and changing what the definition says to change. Then record its path, relative to the repository's root, in that subsystem's entry, under the key this skill's mechanics name. Read `fuseki state get wiki.subsystems`. When the subsystem has an entry, set that one list with this path added and every path already in it kept: `fuseki state set wiki.subsystems.<subsystem>.<key> '["<path>", …]'`. When it has none, set the whole entry, with `root` the subsystem's folder, this path in this skill's list and every other value empty: `fuseki state set wiki.subsystems.<subsystem> '{"root":"<docsRoot>/wiki/subsystems/<subsystem>","architecture":"","structure":"","systems":[],"crossCutting":[],"guides":[],"patterns":[],"walkthroughs":[]}'`. A path already listed is not added twice. No other key is written.

Follow the definition, reading the code for every statement the document makes; the documents
already recorded for the subsystem and in `fuseki state get wiki.systemWide` are read first, so the
new one links to them rather than repeating them. Answers the person already gave are answers: do not
ask them again. `wiki.*` belongs to the mapping skills, and this one writes only its own list.

This skill writes nothing on the server while it works, so it opens no change set. An insight is recorded inside one, so when the person says yes to recording an insight, open one then — `start_change_set` with the bound project's key and a one-line summary naming this skill and the moment from `date -u "+%Y-%m-%d %H:%M:%S"`, so a second insight opens its own change set — call `record_skill_definition_insight` with its `changeSetId`, and complete it with `complete_change_set`, outcome `Completed` and a one-line summary.

Report the document by path, what it covers in one line, and the definition's level and version.
