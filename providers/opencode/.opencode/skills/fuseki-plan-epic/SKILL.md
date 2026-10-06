---
name: fuseki-plan-epic
description: Plan an epic in a Fuseki project and break it into its features, by the method the server holds as the skill definition plan-epic — the epic and its features written as work items in one change set, acceptance criteria, estimate and priority in the cards' own fields, their links typed before it completes, the epic recorded in .fuseki/state.json. Use when the person asks to plan, write or break down an epic, to turn part of the product vision into an epic, to split a large piece of work into features, or picks "Plan an epic" from the Fuseki menu.
---

# Plan an epic

The method — what to read first, what to ask, how an epic is cut into features and when the plan is
done — is not in this file. It is the skill definition `plan-epic`, which the server holds and a person
customises for the organisation or for one project, so the method changes without a new plugin. This
file is the mechanics: which kinds the work items are, how they are written, and what
`.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` and `fuseki activity …` in this file mean that. Every read and write of work goes through the `fuseki-work`
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
   again. The reads it asks for are `get_product_vision`, `get_backlog` and the repository's wiki at
   its high level only: `fuseki state get wiki`, then the documents its paths name for
   `wiki.systemWide.architecture`, `wiki.systemWide.decisions` and `wiki.systemWide.otherDocs`, and,
   for each subsystem the epic touches, `wiki.subsystems.<name>.architecture` and its `decisions` —
   never the rest of the wiki. Research outside the repository, when the definition calls for it, is
   `WebSearch` and `WebFetch`. The estimate is in the project's own scale, which `get_project`
   answers. Nothing is written until the person approved the epic, its acceptance criteria, its
   estimate and priority, and its features.
3. **Write, in one change set.** `start_change_set` with the project's key and the summary
   "Plan an epic: <the epic's title>, <moment> UTC" (the moment from `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set). Then `create_work_item` for the epic (`itemTypeName` the Epic
   kind, `descriptionMarkdown` its description, `acceptanceCriteriaMarkdown` its acceptance criteria,
   `estimate` and `priority`) and `create_work_items` for its features (`itemTypeName` the Feature kind,
   `parentReferenceCode` the epic's code, each with its `descriptionMarkdown`, `estimate` and
   `priority`), every call carrying `changeSetId`. Acceptance criteria, estimate and priority go in
   those fields and never inside a description. An epic the backlog already holds is edited with
   `update_work_item` against the version `get_work_item` answered, the same fields, never created
   twice.
4. **Type the links.** Load the `fuseki-linker` skill and follow it, with the project's key and
   the change set's id, before completing the change set; keep the lines it hands back for the report.
   Its calls are its own: this skill never calls `list_untyped_links` or `type_link` itself, even when
   there may be no link to type.
5. **The state.** `fuseki activity record --skill plan-epic --item <the epic's code> --note "<note>"`,
   such as "Planned Team invitations: 4 features". It points the front door at this epic, and only
   this command writes `activity`.
   The note is one line of at most 120 characters saying what the run did; the tool refuses a longer
   one.
6. **End the run.** **The insight question comes first**, before `complete_change_set` and inside this change set. Read back what you wrote and what the person answered. Something blocked you when an answer the definition asks for is one the person said they did not know or could not give, when you wrote a default, a guess or a placeholder in its place, or when your report will list it as still open. "Work with what you have", "write it now" and "go ahead" are not that answer: what they leave open still blocked you. When something did, say what, ask whether to record an insight, and stop there with the change set running; after the person answers, record the insight on a yes, then complete it. A yes or a no the person already gave in this session is that answer, so do not ask again. When nothing did, complete it. A report never says nothing blocked you beside an answer it lists as open. Completing it is
   `complete_change_set` with outcome `Completed` and a summary naming the epic and its features by
   code. A run that wrote nothing it meant to — refused before the first create — completes with
   outcome `Failed` and the refusal as the reason.
7. **Report** by reference code what the tools answered: the epic, each feature under it, the linker's
   lines, and the definition's level and version.
