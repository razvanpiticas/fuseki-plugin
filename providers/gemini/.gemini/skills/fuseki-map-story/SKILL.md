---
name: fuseki-map-story
description: Map a story into the wiki once it is built — read the Fuseki story by its reference code, find what its change touched in this repository, and update or write the wiki documents that describe it, by the method the server holds as the skill definition map-story, recording any new document in .fuseki/state.json. Use when the person asks to map a story, update the wiki after a story, document what FUS-12 changed, bring the docs in line with a finished piece of work, or picks "Map a story" from the Fuseki menu.
---

# Map a story

The method — how to find what a story changed, which documents describe it and how each is brought up
to date — is not in this file. It is the skill definition `map-story`, which the server holds and a
person customises for the organisation or for one project, so the method changes without a new plugin.
This file is the mechanics: how the story is read, where the documents are, and what
`.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that.

1. **The story.** `get_work_item(referenceCode)` answers its description, acceptance criteria and
   technical solution; `list_comments` and `list_work_item_links` what was said and what it relates
   to. A code that answers nothing is said, and nothing is written. The change itself is in this
   repository: `git log --grep <reference code>` finds the commits that name it; when none does, ask
   the person which commits or files are the story's.
2. **The wiki.** `fuseki state get docsRoot` (empty: run `the fuseki skill` first) and
   `fuseki state get wiki`: every document the mapping skills recorded, system-wide and per subsystem.
   Read each one the story's change touches before changing it.
3. **Follow the definition**: update what the change made untrue, write what it added. Nothing is
   written on the server.
4. **The state.** A document the run only updated is already recorded. A document it created is
   recorded where the mapping skill of its kind records one, every path relative to the repository's
   root and every path already listed kept:
   - under `<docsRoot>/wiki/system-wide/`: `wiki.systemWide.otherDocs`
     (`fuseki state set wiki.systemWide.otherDocs '["…", "<new path>"]'`);
   - under `<docsRoot>/wiki/subsystems/<name>/`: that subsystem's list named after the folder —
     `systems/` → `systems`, `cross-cutting/` → `crossCutting`, `guides/` → `guides`, `patterns/` →
     `patterns`, `walkthroughs/` → `walkthroughs`
     (`fuseki state set wiki.subsystems.<name>.<list> '["…", "<new path>"]'`); a subsystem with no
     entry yet gets its whole entry, `root` its folder and every other value empty but this path.
   `wiki.*` belongs to the mapping skills; this one writes only the lists its new documents belong in.
5. **The insight question**, as above:

   This skill writes nothing on the server while it works, so it opens no change set. An insight is recorded inside one, so when the person says yes to recording an insight, open one then — `start_change_set` with the bound project's key and a one-line summary naming this skill and the moment from `date -u "+%Y-%m-%d %H:%M:%S"`, so a second insight opens its own change set — call `record_skill_definition_insight` with its `changeSetId`, and complete it with `complete_change_set`, outcome `Completed` and a one-line summary.
6. **Report** the story by code, every document updated or written by path with one line on what
   changed in it, and the definition's level and version.
