---
name: fuseki-plan-feature
description: Plan a feature in a Fuseki project and break it into stories, by the method the server holds as the skill definition plan-feature — the feature and its stories written as work items in one change set, acceptance criteria for a screen written as playwright-cli browser checks, links typed before the change set completes, the feature recorded in .fuseki/state.json. Use when the person asks to plan, specify or break down a feature, to split a feature into stories, or picks "Plan a feature" from the Fuseki menu.
argument-hint: [project key] [the feature's reference code, or its subject and the epic it belongs to]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" *), Bash(date *), Bash(playwright-cli *), Read, Glob, Grep, mcp__fuseki__get_skill_definition, mcp__fuseki__list_insights, mcp__fuseki__get_insight, mcp__fuseki__get_project_vocabulary, mcp__fuseki__get_product_vision, mcp__fuseki__get_backlog, mcp__fuseki__list_work_items, mcp__fuseki__lookup_work_items, mcp__fuseki__search_work_items, mcp__fuseki__get_work_item, mcp__fuseki__list_work_item_links, mcp__fuseki__create_work_item, mcp__fuseki__create_work_items, mcp__fuseki__update_work_item, mcp__fuseki__start_change_set, mcp__fuseki__observe_change_set, mcp__fuseki__complete_change_set, mcp__fuseki__record_skill_definition_insight, mcp__fuseki__get_project, mcp__fuseki__list_projects, mcp__fuseki__list_portfolios, mcp__fuseki__server_info
---

# Plan a feature

The method — what to read, what to ask, how a feature is cut into stories and when the plan is done —
is not in this file. It is the skill definition `plan-feature`, which the server holds and a person
customises for the organisation or for one project, so the method changes without a new plugin. This
file is the mechanics: which kinds the work items are, how they are written, how browser checks are
written and run, and what `.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" <command>`, from the repository's root; every
`fuseki state …` in this file means that. Every read and write of work goes through the `fuseki-work`
skill's rules: names in, identifiers out, a version for every edit.

1. **The kinds.** Fuseki has no Feature entity: a kind of work item is a row the organisation edits.
   Call `get_project_vocabulary(projectKey)` before anything is written, and find the kind named
   "Feature" and the kind named "Story" (any letter case) whose `hierarchyLevel` is one more than
   Feature's. When either is missing, stop before opening a change set and say so in one sentence
   naming what is missing, with every kind the organisation has and its level: "This organisation has
   no kind of work item called Feature, so there is no feature to plan. Its kinds are: Epic (level 1),
   Story (level 2)." Use the names exactly as the vocabulary answered them.
2. **Read the repository's browser testing**, as [Browser checks](#browser-checks) says, before the
   definition: the stories' acceptance criteria depend on it.
3. **Follow the definition** to a plan the person agreed: the feature and its stories. Answers the
   person already gave — in the request or earlier in the session — are answers: do not ask them
   again. The feature named by reference code is read with `get_work_item`, with its epic and the
   product vision (`get_product_vision`); the wiki is `fuseki state get wiki`, then the files it lists.
4. **Write, in one change set.** `start_change_set` with the project's key and the summary
   "Plan a feature: <the feature's title>, <moment> UTC" (the moment from `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set). The feature the backlog already holds is edited with
   `update_work_item` (its description, against the version `get_work_item` answered); a feature that
   does not exist yet is created with `create_work_items` and one entry (`itemTypeName` the Feature
   kind, `parentReferenceCode` its epic): `create_work_item` takes no parent. Then, in a second call
   with the code the first one answered, `create_work_items` for its stories (`itemTypeName` the Story kind, `parentReferenceCode` the feature's code, each with
   its acceptance criteria). Every call carries `changeSetId`. **A feature always hangs from its epic
   and a story from its feature**: a call resent after a refusal carries the same `parentReferenceCode`
   as the first.
5. **Type the links.** Load the `fuseki-linker` skill and follow it, with the project's key and
   the change set's id, before completing the change set; keep the lines it hands back for the report.
   Its calls are its own: this skill never calls `list_untyped_links` or `type_link` itself, even when
   there may be no link to type.
6. **The state.** `fuseki state set planning.lastFeature '"<the feature's code>"'`. `planning` belongs
   to the three plan skills, and this one writes only `lastFeature`.
7. **End the run.** The insight question comes first, as above, inside this change set: an answer
   the definition asks for that the person could not give, left open in the plan, is something that
   blocked you. Then
   `complete_change_set` with outcome `Completed` and a summary naming the feature and its stories by
   code.
8. **Report** by reference code what the tools answered: the feature, each story under it, which
   stories carry browser checks and whether they were run, the linker's lines, and the definition's
   level and version.

## Browser checks

Before following the definition, read `fuseki state get uiTesting` and keep it for the acceptance criteria.
- **A story that changes a screen** gets acceptance criteria written as `playwright-cli` walkthrough steps against `uiTesting.baseUrl`, every command in one browser session of its own, named with `--session=<session>` (`<session>` a short lowercase name for the story, letters, digits and hyphens), so the walkthrough never uses the person's own browser session. The first two steps are `playwright-cli session-stop <session>` and `playwright-cli session-delete <session>`, so it starts signed out; then open the page, `snapshot`, act on an element the snapshot names (`fill` and `click` take the `ref` it names), `snapshot` again and read the result back; the last two steps are the same two commands, which close that browser and forget its sign-in (a running session is stopped before its data can be deleted). One step per line, each a command a person can run. A story that changes no screen gets none. An empty `baseUrl` is written as `<the app's address>`, and the answer says the front door's "set up browser testing" records it.
- **`requiresSignIn` true:** right after the first two steps, the steps sign in with the keys of `.fuseki/.env`, written by name — `FUSEKI_UI_USERNAME` and `FUSEKI_UI_PASSWORD` — never by value. When `envKeysPresent` lacks either, say the file still has a blank key, and write the steps anyway.
- **`playwrightCli.available` true:** once the criteria are written, offer to run the walkthrough once against the running app, to prove its steps can be followed. On yes, run it step by step and say what each step showed. The credentials are read from `.fuseki/.env` only at the moment of signing in, straight into the fill, one command per field: `playwright-cli --session=<session> fill <ref> "$(grep '^FUSEKI_UI_USERNAME=' .fuseki/.env | cut -d= -f2-)"`, and the same with `FUSEKI_UI_PASSWORD`. Never `cat`, print, echo or open `.fuseki/.env` any other way; never put a value in a command, the chat, a work item or the state; and never `snapshot` while the sign-in form holds them, because a snapshot prints every field's value — the command after the last fill is the click that signs in. The run ends with the last two steps, and acts on no session the steps do not name.
- **`playwrightCli.available` false:** write the steps and do not run them, and end the answer with this line, word for word: "playwright-cli is not installed here, so the browser checks are written and not run."
