---
name: fuseki-map-system
description: Map the system-wide wiki of this repository — its structure, architecture and testing documents under the documentation root's wiki/system-wide — by the method the server holds as the skill definition map-system, and record every document written in .fuseki/state.json. Use when the person asks to map the system, document the whole codebase, write or refresh the architecture, structure or testing documents, start the repository's wiki, or picks "Map the system" from the Fuseki menu.
---

# Map the system

The method — what to read in the repository, what each system-wide document says and when the map is
done — is not in this file. It is the skill definition `map-system`, which the server holds and a
person customises for the organisation or for one project, so the method changes without a new plugin.
This file is the mechanics: where the documents go and what `.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that.

1. **Where.** `fuseki state get docsRoot`; empty means the repository is not set up, so run
   `the fuseki skill` first and write nothing until it answers. The system-wide documents go in
   `<docsRoot>/wiki/system-wide/` (`mkdir -p` it first): `architecture.md`, `structure.md`,
   `testing.md`, and any other document the definition asks for, each named lowercase with hyphens.
   `coding-standards.md` sits in the same folder and is not this skill's: it belongs to
   `fuseki-coding-standards`, and this skill neither writes nor records it.
2. **What is there.** `fuseki state get wiki.systemWide`, and read every document it names before
   writing: a document that exists is brought up to date, not started again, and what the definition
   does not ask to change stays as it was.
3. **Follow the definition**, reading the repository itself — its files, its tests, its history — for
   every statement the documents make. Answers the person already gave are answers: do not ask them
   again. When the definition asks for the agent's instructions, they are a short section in
   `.cursorrules` at the repository's root pointing at the wiki: read the file first, change only
   that section, and record nothing for it.
4. **The state.** Once every document is written, set the whole key in one call, every path relative
   to the repository's root and every path already recorded kept:
   `fuseki state set wiki.systemWide '{"architecture":"<docsRoot>/wiki/system-wide/architecture.md","structure":"<docsRoot>/wiki/system-wide/structure.md","testing":"<docsRoot>/wiki/system-wide/testing.md","otherDocs":["<docsRoot>/wiki/system-wide/<other>.md"]}'`.
   A document the run did not write keeps the value it had (empty when it never existed). `wiki.*`
   belongs to the mapping skills, and this one writes only `wiki.systemWide`.
5. **The insight question**, as above:

   This skill writes nothing on the server while it works, so it opens no change set. An insight is recorded inside one, so when the person says yes to recording an insight, open one then — `start_change_set` with the bound project's key and a one-line summary naming this skill and the moment from `date -u "+%Y-%m-%d %H:%M:%S"`, so a second insight opens its own change set — call `record_skill_definition_insight` with its `changeSetId`, and complete it with `complete_change_set`, outcome `Completed` and a one-line summary.
6. **Report** every document written or updated, by path, what each now covers in one line, and the
   definition's level and version.
