---
name: fuseki-plan-feature
description: Plan a feature in a Fuseki project and break it into stories, by the method the server holds as the skill definition plan-feature — the feature and its stories written as work items in one change set, acceptance criteria, estimate and priority in the cards' own fields, the feature's acceptance criteria for a screen written as playwright-cli browser checks, links typed before the change set completes, the feature recorded in .fuseki/state.json. Use when the person asks to plan, specify or break down a feature, to split a feature into stories, or picks "Plan a feature" from the Fuseki menu.
---

# Plan a feature

The method — what to read, what to ask, how a feature is cut into stories and when the plan is done —
is not in this file. It is the skill definition `plan-feature`, which the server holds and a person
customises for the organisation or for one project, so the method changes without a new plugin. This
file is the mechanics: which kinds the work items are, how they are written, how browser checks are
written and run, and what `.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` and `fuseki activity …` in this file mean that. Every read and write of work goes through the `fuseki-work`
skill's rules: names in, identifiers out, a version for every edit.

1. **The kinds.** Fuseki has no Feature entity: a kind of work item is a row the organisation edits.
   Call `get_project_vocabulary(projectKey)` before anything is written, and find the kind named
   "Feature" and the kind named "Story" (any letter case) whose `hierarchyLevel` is one more than
   Feature's. When either is missing, stop before opening a change set and say so in one sentence
   naming what is missing, with every kind the organisation has and its level: "This organisation has
   no kind of work item called Feature, so there is no feature to plan. Its kinds are: Epic (level 1),
   Story (level 2)." Use the names exactly as the vocabulary answered them.
2. **Read the repository's browser testing**, as [Browser checks](#browser-checks) says, before the
   definition: the feature's acceptance criteria depend on it.
3. **Follow the definition** to a plan the person agreed: the feature and its stories. Answers the
   person already gave — in the request or earlier in the session — are answers: do not ask them
   again. The feature named by reference code is read with `get_work_item`, with its epic and the
   product vision (`get_product_vision`); its sibling features, the epic's other children, from `get_backlog`.
   The wiki is read at its high level only: `fuseki state get wiki`, then the documents its paths name
   for `wiki.systemWide.architecture`, `wiki.systemWide.decisions` and `wiki.systemWide.otherDocs`,
   and, for each subsystem the feature touches, `wiki.subsystems.<name>.architecture` and its
   `decisions` — never the rest of the wiki; the code of those subsystems is read as the definition
   says. The estimate is in the project's own scale, which `get_project` answers. Nothing is written
   until the person approved the feature, its acceptance criteria, its estimate and priority, and its
   stories.
4. **Write, in one change set.** `start_change_set` with the project's key and the summary
   "Plan a feature: <the feature's title>, <moment> UTC" (the moment from `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set). The feature carries `descriptionMarkdown`,
   `acceptanceCriteriaMarkdown` (with its browser checks), `estimate` and `priority`. The feature the
   backlog already holds is edited with `update_work_item` (those fields, against the version
   `get_work_item` answered); a feature that does not exist yet is created with `create_work_items`
   and one entry (`itemTypeName` the Feature kind, `parentReferenceCode` its epic): `create_work_item`
   takes no parent. Then, in a second call with the code the first one answered, `create_work_items`
   for its stories (`itemTypeName` the Story kind, `parentReferenceCode` the feature's code, each with
   its `descriptionMarkdown`, `estimate` and `priority`; a story's acceptance criteria are written
   when the story is planned, not now). Acceptance criteria, estimate and priority go in those fields
   and never inside a description. Every call carries `changeSetId`. **A feature always hangs from its epic
   and a story from its feature**: a call resent after a refusal carries the same `parentReferenceCode`
   as the first.
5. **Type the links.** Load the `fuseki-linker` skill and follow it, with the project's key and
   the change set's id, before completing the change set; keep the lines it hands back for the report.
   Its calls are its own: this skill never calls `list_untyped_links` or `type_link` itself, even when
   there may be no link to type.
6. **The state.** `fuseki activity record --skill plan-feature --item <the feature's code> --epic <its
   epic's code> --note "<note>"`, such as "Planned Invite by email: 5 stories"; leave out `--epic` for
   a feature with no epic. It points the front door at this feature, and only this command writes
   `activity`.
   The note is one line of at most 120 characters saying what the run did; the tool refuses a longer
   one.
7. **End the run.** **The insight question comes first**, before `complete_change_set` and inside this change set. Read back what you wrote and what the person answered. Something blocked you when an answer the definition asks for is one the person said they did not know or could not give, when you wrote a default, a guess or a placeholder in its place, or when your report will list it as still open. "Work with what you have", "write it now" and "go ahead" are not that answer: what they leave open still blocked you. When something did, say what, ask whether to record an insight, and stop there with the change set running; after the person answers, record the insight on a yes, then complete it. A yes or a no the person already gave in this session is that answer, so do not ask again. When nothing did, complete it. A report never says nothing blocked you beside an answer it lists as open. Completing it is
   `complete_change_set` with outcome `Completed` and a summary naming the feature and its stories by
   code.
8. **Report** by reference code what the tools answered: the feature, each story under it, whether
   the feature's acceptance criteria carry browser checks and whether they were run, the linker's lines, and the definition's
   level and version.

## Browser checks

Before following the definition, read `fuseki state get uiTesting` and keep it for the acceptance criteria.
- **A work item that changes a screen** — the one this skill writes acceptance criteria for — gets them written as `playwright-cli` walkthrough steps against `uiTesting.baseUrl`, every command in one browser session of its own, named with `--session=<session>` (`<session>` a short lowercase name for the work item, letters, digits and hyphens), so the walkthrough never uses the person's own browser session. The first two steps are `playwright-cli session-stop <session>` and `playwright-cli session-delete <session>`, so it starts signed out. A page is reached only with `playwright-cli --session=<session> open <url>` — `open` is the one command that navigates, and `playwright-cli` has no `goto` — `<url>` the full address of the screen the work item changes, `uiTesting.baseUrl` followed by that screen's path. Then `snapshot`, act on an element the snapshot names (`fill` and `click` take the `ref` it names), `snapshot` again and read the result back; the last two steps are those two commands word for word, the session named as their argument and never with `--session=`, which close that browser and forget its sign-in (a running session is stopped before its data can be deleted). One step per line, each a command a person can run. A work item that changes no screen gets none. An empty `baseUrl` is written as `<the app's address>`, and the answer says the front door's "set up browser testing" records it.
- **`requiresSignIn` true:** right after the first two steps, the steps sign in with the keys of `.fuseki/.env`, written by name — `FUSEKI_UI_USERNAME` and `FUSEKI_UI_PASSWORD` — never by value. The steps `open` the screen the work item changes while signed out and `snapshot` it, and the fills take the `ref`s of a snapshot that shows the sign-in form, so the next step, written to run only when that snapshot shows no form, is to `click` the control that leads to it, such as a "Log in" button, and `snapshot` again. After the click that signs in, `snapshot`, and a step written to run only when signing in did not land on the screen `open`s it again. When `envKeysPresent` lacks either, say the file still has a blank key, and write the steps anyway.
- **`playwrightCli.available` true:** once the criteria are written, offer to run the walkthrough once against the running app, to prove its steps can be followed. On yes, run the written steps one by one, and only those, none added or changed, and say what each step showed. When one cannot be followed as written, stop there, run the last two steps, and say which step failed and what it showed, so the criteria are corrected. The credentials are read from `.fuseki/.env` only at the moment of signing in, straight into the fill, one command per field: `playwright-cli --session=<session> fill <ref> "$(grep '^FUSEKI_UI_USERNAME=' .fuseki/.env | cut -d= -f2-)"`, and the same with `FUSEKI_UI_PASSWORD`. Never `cat`, print, echo or open `.fuseki/.env` any other way; never put a value in a command, the chat, a work item or the state; and never `snapshot` while the sign-in form holds them, because a snapshot prints every field's value — the command after the last fill is the click that signs in. The run ends with the last two steps, and acts on no session the steps do not name.
- **`playwrightCli.available` false:** write the steps and do not run them, and end the answer with this line, word for word: "playwright-cli is not installed here, so the browser checks are written and not run."
