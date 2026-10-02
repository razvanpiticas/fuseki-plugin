---
name: fuseki-plan-epic
description: Plan an epic in a Fuseki project and break it into its features, by the method the server holds as the skill definition plan-epic — the epic and its features written as work items in one change set, their links typed before it completes, the epic recorded in .fuseki/state.json. Use when the person asks to plan, write or break down an epic, to turn part of the product vision into an epic, to split a large piece of work into features, or picks "Plan an epic" from the Fuseki menu.
argument-hint: [project key] [the epic's subject, or what the person already knows]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" *), Bash(date *), Read, Glob, Grep, mcp__fuseki__get_skill_definition, mcp__fuseki__list_insights, mcp__fuseki__get_insight, mcp__fuseki__get_project_vocabulary, mcp__fuseki__get_product_vision, mcp__fuseki__get_backlog, mcp__fuseki__list_work_items, mcp__fuseki__lookup_work_items, mcp__fuseki__search_work_items, mcp__fuseki__get_work_item, mcp__fuseki__create_work_item, mcp__fuseki__create_work_items, mcp__fuseki__update_work_item, mcp__fuseki__start_change_set, mcp__fuseki__observe_change_set, mcp__fuseki__complete_change_set, mcp__fuseki__record_skill_definition_insight, mcp__fuseki__get_project, mcp__fuseki__list_projects, mcp__fuseki__list_portfolios, mcp__fuseki__server_info
---

# Plan an epic

The method — what to read first, what to ask, how an epic is cut into features and when the plan is
done — is not in this file. It is the skill definition `plan-epic`, which the server holds and a person
customises for the organisation or for one project, so the method changes without a new plugin. This
file is the mechanics: which kinds the work items are, how they are written, and what
`.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" <command>`, from the repository's root; every
`fuseki state …` in this file means that. Every read and write of work goes through the `fuseki-work`
skill's rules: names in, identifiers out, a version for every edit.

1. **The kinds.** Fuseki has no Epic entity: a kind of work item is a row the organisation edits. Call
   `get_project_vocabulary(projectKey)` before anything is written, and find the kind named "Epic" and
   the kind named "Feature" (any letter case) whose `hierarchyLevel` is one more than Epic's. When
   either is missing, stop before opening a change set and say so in one sentence naming what is
   missing, with every kind the organisation has and its level: "This organisation has no kind of work
   item called Epic, so there is no epic to plan. Its kinds are: Initiative (level 1), Story (level 2)."
   Use the names exactly as the vocabulary answered them.
2. **Follow the definition** to a plan the person agreed: the epic and its features. Answers the
   person already gave — in the request or earlier in the session — are answers: do not ask them
   again. The reads it asks for are `get_product_vision`, `get_backlog` and the repository's wiki
   (`fuseki state get wiki`, then the files it lists).
3. **Write, in one change set.** `start_change_set` with the project's key and the summary
   "Plan an epic: <the epic's title>, <moment> UTC" (the moment from `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set). Then `create_work_item` for the epic (`itemTypeName` the Epic
   kind, its description) and `create_work_items` for its features (`itemTypeName` the Feature kind,
   `parentReferenceCode` the epic's code), every call carrying `changeSetId`. An epic the backlog
   already holds is edited with `update_work_item` against the version `get_work_item` answered, never
   created twice.
4. **Type the links.** Load the `fuseki-linker` skill and follow it, with the project's key and
   the change set's id, before completing the change set; keep the lines it hands back for the report.
   Its calls are its own: this skill never calls `list_untyped_links` or `type_link` itself, even when
   there may be no link to type.
5. **The state.** `fuseki state set planning.lastEpic '"<the epic's code>"'`. `planning` belongs to the
   three plan skills, and this one writes only `lastEpic`.
6. **End the run.** The insight question comes first, as above, inside this change set: an answer
   the definition asks for that the person could not give, left open in the plan, is something that
   blocked you. Then
   `complete_change_set` with outcome `Completed` and a summary naming the epic and its features by
   code. A run that wrote nothing it meant to — refused before the first create — completes with
   outcome `Failed` and the refusal as the reason.
7. **Report** by reference code what the tools answered: the epic, each feature under it, the linker's
   lines, and the definition's level and version.
