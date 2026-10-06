---
name: fuseki-map-subsystem
description: Map a subsystem of this repository into the wiki — its structure and architecture documents and the systems, patterns, cross-cutting documents, guides, walkthroughs and decision records inside it, under the documentation root's wiki/subsystems/<name> — by the method the server holds as the skill definition map-subsystem, and, after each run, update and maintain the wiki mapping in .fuseki/state.json. Use when the person asks to map a subsystem, a service, a module or a client of the codebase into the wiki, to document one part of the system, or picks "Map a subsystem" from the Fuseki menu.
---

# Map a subsystem

The method — how a subsystem's boundary is found, what its structure and architecture documents say,
how it splits into the systems, patterns, shared concerns, recipes, flows and decisions it holds, and when the map is done — is not in this file. It is the skill definition
`map-subsystem`, which the server holds and a person customises for the organisation or for one
project, so the method changes without a new plugin. This file is the mechanics: where the documents
go and what `.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that.

1. **Where.** `fuseki state get docsRoot`; empty means the repository is not set up, so run
   `$fuseki` first and write nothing until it answers. The subsystem is the one the
   person named, else ask which. Its folder is `<docsRoot>/wiki/subsystems/<name>/`, the name
   lowercase with hyphens, holding `architecture.md`, `structure.md` and one folder per kind of
   knowledge document — `systems/`, `patterns/`, `cross-cutting/`, `guides/`, `walkthroughs/`,
   `decisions/` (`mkdir -p` each before writing into it).
2. **What is there.** `fuseki state get wiki.subsystems` and the system-wide documents in
   `fuseki state get wiki.systemWide`. Read every document in the subsystem's folder, recorded or not,
   before writing: a document that covers a topic is brought up to date, not started again. For
   `structure.md` and `architecture.md` that already exist, the definition's Update, Recreate or Skip
   is the person's choice; nothing is overwritten without it.
3. **Follow the definition**, reading the subsystem's own code for every statement the documents make.
   Each knowledge document follows its own skill's definition, fetched with `get_skill_definition` by
   that skill's code; a walkthrough that explains a framework looks it up in the official
   documentation with `WebSearch` and `WebFetch`. Answers the person already gave are answers: do not
   ask them again.
4. **The state.** Once the documents are written, set the subsystem's whole entry in one call, every
   path relative to the repository's root:
   `fuseki state set wiki.subsystems.<name> '{"root":"<docsRoot>/wiki/subsystems/<name>","architecture":"<…>/architecture.md","structure":"<…>/structure.md","systems":[…],"crossCutting":[…],"guides":[…],"patterns":[…],"walkthroughs":[…],"decisions":[…]}'`.
   `architecture` and `structure` are their documents' paths, written, refreshed or skipped (empty
   only when there is none). Every list keeps the paths already in it — other skills' among them —
   and adds this run's documents and any found in its folder unrecorded, none listed twice.
   When the run added the subsystem's row to the system-wide structure or architecture document and
   that key is empty, record it too: `fuseki state set wiki.systemWide.structure '"<path>"'`, the
   same for `wiki.systemWide.architecture`. A recorded value is never replaced. `wiki.*` belongs to
   the mapping skills, and this one writes only this subsystem's entry and those two keys.
5. **The insight question**, as above:

   This skill writes nothing on the server while it works, so it opens no change set. An insight is recorded inside one, so when the person says yes to recording an insight, open one then — `start_change_set` with the bound project's key and a one-line summary naming this skill and the moment from `date -u "+%Y-%m-%d %H:%M:%S"`, so a second insight opens its own change set — call `record_skill_definition_insight` with its `changeSetId`, and complete it with `complete_change_set`, outcome `Completed` and a one-line summary.
6. **Report** every document written, updated or skipped, by path, its action and its line count, and
   the definition's level and version.
