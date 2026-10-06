---
name: fuseki-map-guide
description: Write a guide in this repository's wiki — a step-by-step recipe for a task developers do again and again, such as adding an endpoint or a migration — by the method the server holds as the skill definition map-guide, under the documentation root's wiki/subsystems/<name>/guides, and, after each run, update and maintain the wiki mapping in .fuseki/state.json. Use when the person asks to write or refresh a guide, a how-to or a recipe for a common implementation task, or picks "Write a guide" from the Fuseki menu.
argument-hint: <subsystem> <the task the guide teaches>
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" *), Bash(date *), Bash(mkdir *), Bash(git ls-files *), Bash(git log *), Bash(git diff *), Bash(git show *), Read, Write, Edit, Glob, Grep, mcp__fuseki__get_work_item, mcp__fuseki__list_comments, mcp__fuseki__get_skill_definition, mcp__fuseki__list_insights, mcp__fuseki__get_insight, mcp__fuseki__start_change_set, mcp__fuseki__complete_change_set, mcp__fuseki__record_skill_definition_insight, mcp__fuseki__get_project, mcp__fuseki__list_projects, mcp__fuseki__list_portfolios, mcp__fuseki__server_info
---

# Write a guide

The method — what a guide covers, how its steps are drawn from the code that already does the task and when the guide is done — is not in this file. It is the skill definition `map-guide`, which the server
holds and a person customises for the organisation or for one project, so the method changes without
a new plugin. This file is the mechanics: where the document goes and what `.fuseki/state.json`
records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" <command>`, from the repository's root; every
`fuseki state …` in this file means that. This skill's folder is `guides/` and its key in a
subsystem's entry is `guides`.

**Where the document goes, and how it is recorded.** Read the documentation root with `fuseki state get docsRoot`; empty means the repository is not set up, so run the fuseki skill first. The document belongs to one subsystem: the one the person named, else ask which. Its folder is `<docsRoot>/wiki/subsystems/<subsystem>/`, the name lowercase with hyphens. Read `fuseki state get wiki.subsystems` before writing anything. **A subsystem with no entry is not mapped:** say so, and offer to map it first with the fuseki-map-subsystem skill. On a yes, map it that way, then come back to this document. On a no, or when the person said not to ask, go on without mapping it. Write the document at `<docsRoot>/wiki/subsystems/<subsystem>/<folder>/<document>.md` — the folder this skill's mechanics name, `<document>` as they name it, else lowercase with hyphens — reading it first when it exists and changing what the definition says to change. Then record its path, relative to the repository's root, in that subsystem's entry, under the key this skill's mechanics name. When the subsystem has an entry, set that one list with this path added and every path already in it kept: `fuseki state set wiki.subsystems.<subsystem>.<key> '["<path>", …]'`. When it has none, create it: set the whole entry, with `root` the subsystem's folder, this path in this skill's list and every other value empty: `fuseki state set wiki.subsystems.<subsystem> '{"root":"<docsRoot>/wiki/subsystems/<subsystem>","architecture":"","structure":"","systems":[],"crossCutting":[],"guides":[],"patterns":[],"walkthroughs":[],"decisions":[]}'`. A path already listed is not added twice; a document updated in place keeps its one entry. No other key is written.

When the person names a work item, `get_work_item` and `list_comments` read it; when they name commits, `git show` and `git diff` give what each changed. Follow the definition, reading the code for every statement the document makes; the documents
already recorded for the subsystem and in `fuseki state get wiki.systemWide` are read first, so the
new one links to them rather than repeating them. Answers the person already gave are answers: do not
ask them again. `wiki.*` belongs to the mapping skills, and this one writes only its own list.

This skill writes nothing on the server while it works, so it opens no change set. An insight is recorded inside one, so when the person says yes to recording an insight, open one then — `start_change_set` with the bound project's key and a one-line summary naming this skill and the moment from `date -u "+%Y-%m-%d %H:%M:%S"`, so a second insight opens its own change set — call `record_skill_definition_insight` with its `changeSetId`, and complete it with `complete_change_set`, outcome `Completed` and a one-line summary.

Report the document by path, what it covers in one line, and the definition's level and version.
