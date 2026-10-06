---
name: fuseki-plan-story
description: Plan a story in a Fuseki project so whoever builds it assumes nothing, by the method the server holds as the skill definition plan-story — offering first to write the system architecture (fuseki-map-system) and the coding standards when the repository has none, then its description opening with the goal execution prompt, its Gherkin acceptance criteria, estimate and priority written onto the work item in one change set, every story it waits on or holds up written as a blocks link, then a wiki curation agent writing its Relevant Wiki section and a technical solution agent running fuseki-architect-technical-solution to write its technical solution (a product question it cannot settle comes back to the person and into the acceptance criteria), and the story moved to the project's ready state. "Continuous integration passes" ends the goal execution prompt and the definition of done as the gh commands that prove it only when the repository runs GitHub Actions and gh here is installed, signed in and not declined (otherwise as a check by hand); the story is recorded in .fuseki/state.json. Use when the person asks to plan, specify, refine or write acceptance criteria for a story, or picks "Plan a story" from the Fuseki menu.
argument-hint: [project key] [the story's reference code, or its subject and the feature it belongs to]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" *), Bash(date *), Bash(mkdir *), Bash(git ls-files *), Bash(git log *), Read, Write, Edit, Glob, Grep, Agent, mcp__fuseki__get_skill_definition, mcp__fuseki__list_insights, mcp__fuseki__get_insight, mcp__fuseki__get_project_vocabulary, mcp__fuseki__get_product_vision, mcp__fuseki__get_backlog, mcp__fuseki__list_work_items, mcp__fuseki__lookup_work_items, mcp__fuseki__search_work_items, mcp__fuseki__get_work_item, mcp__fuseki__list_work_item_links, mcp__fuseki__get_dependencies, mcp__fuseki__link_work_items, mcp__fuseki__create_work_item, mcp__fuseki__create_work_items, mcp__fuseki__update_work_item, mcp__fuseki__transition_work_item, mcp__fuseki__start_change_set, mcp__fuseki__observe_change_set, mcp__fuseki__complete_change_set, mcp__fuseki__record_skill_definition_insight, mcp__fuseki__get_project, mcp__fuseki__list_projects, mcp__fuseki__list_portfolios, mcp__fuseki__server_info
---

# Plan a story

The method — what to read, what to ask, how acceptance criteria are written and when the story is
ready — is not in this file. It is the skill definition `plan-story`, which the server holds and a
person customises for the organisation or for one project, so the method changes without a new
plugin. This file is the mechanics: which kind the work item is, which of its fields this run writes
and which the two agents write, how its links are drawn, how browser testing and continuous
integration enter its goal execution prompt and definition of done, the state it ends in, and what
`.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" <command>`, from the repository's root; every
`fuseki state …` and `fuseki activity …` in this file mean that. Every read and write of work goes through the `fuseki-work`
skill's rules: names in, identifiers out, a version for every edit.

1. **The kind.** Fuseki has no Story entity: a kind of work item is a row the organisation edits. Call
   `get_project_vocabulary(projectKey)` before anything is written, and find the kind named "Story"
   (any letter case). When it is missing, stop before opening a change set and say so in one sentence,
   with every kind the organisation has and its level: "This organisation has no kind of work item
   called Story, so there is no story to plan. Its kinds are: Epic (level 1), Task (level 2)." Use the
   name exactly as the vocabulary answered it. Keep the states the vocabulary answers for that kind:
   step 7 moves the story into one of them.
2. **Read the repository**, before the definition: `fuseki state get uiTesting` for
   [Browser checks](#browser-checks) and `fuseki state get repository` for
   [Continuous integration](#continuous-integration). The goal execution prompt and the definition of
   done depend on both.
   Then the foundations the technical solution stands on, in this order, each asked once.
   STOP and call the AskUserQuestion tool to clarify.
   - `fuseki state get wiki.systemWide.architecture` empty: say in one line that the technical
     solution places the story in the system architecture and this repository has no document of it
     (with no code yet, the first story lays out the code from it), and ask whether to write it first.
     **Yes:** load the `fuseki-map-system` skill and follow it to its end. **No:** say in the report
     that the story was planned without a system architecture.
   - `fuseki state get codingStandards` with `path` empty: say in one line that the technical
     solution and the implementation follow the coding standards and this repository has none, and
     ask whether to write them first. **Yes:** load the `fuseki-coding-standards` skill and follow it
     to its end. **No:** say in the report that the story was planned without coding standards.

   Then go on with step 3.
3. **Follow the definition** to a story the person agreed. Answers the person already gave — in the
   request or earlier in the session — are answers: do not ask them again. The story named by
   reference code is read with `get_work_item`, with its feature, its epic and the product vision.
   The feature's other stories are read for their title, state, user story and Delivers line only —
   never their acceptance criteria or technical solution, which only make this run's context larger.
4. **Write the requirements, in one change set.** `start_change_set` with the project's key and the
   summary "Plan a story: <the story's title>, <moment> UTC" (the moment from
   `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set). Every call
   below, the agents' included, carries its `changeSetId`.
   - The story the backlog already holds is written with one `update_work_item` —
     `descriptionMarkdown` (its Relevant Wiki section still the placeholder), `acceptanceCriteriaMarkdown`,
     `estimate` and `priority` together, against the version `get_work_item` answered. A story that
     does not exist yet is created first with `create_work_items` and one entry (`itemTypeName` the
     Story kind, `parentReferenceCode` its feature): `create_work_item` takes no parent.
   - Every dependency on another work item is a link, never a line of the description:
     `link_work_items` with `linkTypeName` `blocks`, called from the blocking item to the blocked one —
     `referenceCode` the item that must finish first, `toReferenceCode` the item that waits. A link the
     story already has (`list_work_item_links`) is not drawn twice.
5. **The two agents**, one after the other, never together: both write the same work item. Each is
   handed the project's key, the story's reference code and the change set's id, and told to read the
   story with `get_work_item` for its fields and version, write only its own part with one
   `update_work_item` carrying `changeSetId`, and answer only "done". Nothing either one read comes
   back into this run's context.
   - **The wiki curation agent** also gets `fuseki state get docsRoot`, `fuseki state get wiki`,
     `fuseki state get codingStandards` and the definition's wiki curation rules, word for word. It
     replaces the Relevant Wiki placeholder in `descriptionMarkdown` and keeps every other section as
     it read it.
   - **The technical solution agent**, once the first answered, runs the
     `fuseki-architect-technical-solution` skill — the method the server holds as
     `architect-technical-solution` — and writes `technicalSolutionMarkdown` only. It answers "done",
     or "blocked: " and a question only product behaviour can answer. Blocked: put the question to the
     person. STOP and call the AskUserQuestion tool to clarify. Write their answer into the acceptance criteria as a scenario or a
     change to one, read back to them and written only on their yes, with one `update_work_item`
     carrying `changeSetId`; then spin the agent up again. Each blocked answer is a new question, never
     a retry.
   - Then read the story back with `get_work_item`. A Relevant Wiki section still the placeholder, or
     an empty technical solution, sends that agent again, once. Still missing after that: say which,
     move nothing in step 7, and report it.
6. **Type the links.** Load the `fuseki-linker` skill and follow it, with the project's key and
   the change set's id, before completing the change set; keep the lines it hands back for the report.
   Its calls are its own: this skill never calls `list_untyped_links` or `type_link` itself, even when
   there may be no link to type.
7. **The ready state.** When the definition's DoR holds, `transition_work_item` moves the story into
   the state named "Ready" (any letter case) among the states step 1 kept, against the version the
   last write answered. When the kind has no such state, ask which state means ready here.
   STOP and call the AskUserQuestion tool to clarify. Move it only on the person's answer.
8. **The state file.** `fuseki activity record --skill plan-story --item <the story's code> --feature
   <its feature's code> --epic <its epic's code> --note "<note>"`, such as "Planned Invite by email
   link: 6 scenarios, Ready"; leave out a flag whose item the story does not have. Only this command
   writes `activity`.
   The note is one line of at most 120 characters saying what the run did; the tool refuses a longer
   one.
9. **End the run.** **The insight question comes first**, before `complete_change_set` and inside this change set. Read back what you wrote and what the person answered. Something blocked you when an answer the definition asks for is one the person said they did not know or could not give, when you wrote a default, a guess or a placeholder in its place, or when your report will list it as still open. "Work with what you have", "write it now" and "go ahead" are not that answer: what they leave open still blocked you. When something did, say what, ask whether to record an insight, and stop there with the change set running; after the person answers, record the insight on a yes, then complete it. A yes or a no the person already gave in this session is that answer, so do not ask again. When nothing did, complete it. A report never says nothing blocked you beside an answer it lists as open. Completing it is
   `complete_change_set` with outcome `Completed` and a summary naming the story by code.
10. **Report** by reference code what the tools answered: the story and the fields written, the links
    drawn, whether both agents finished, the state it moved to, how continuous integration is checked
    and why, the linker's lines, and the definition's level and version.

## Browser checks

Read `fuseki state get uiTesting` before following the definition. The acceptance criteria stay
Gherkin, and the story holds no `playwright-cli` step: the implementation run walks every scenario
with `playwright-cli`, as the goal execution prompt says.

- **`requiresSignIn` true:** a screen's scenarios begin signed in as the test account, named by its
  keys — `FUSEKI_UI_USERNAME` and `FUSEKI_UI_PASSWORD` — never by value.
- **`baseUrl` empty:** say in the report that the front door's "set up browser testing" records it.
- **`playwrightCli.available` false:** end the report with this line, word for word:
  "playwright-cli is not installed here, so the implementation run cannot walk the scenarios until it is."

This skill never opens, prints or echoes `.fuseki/.env`, and never writes a value from it anywhere.

## Continuous integration

Read `fuseki state get repository` before following the definition. It alone decides the line that
ends the goal execution prompt's commit bullet and the definition of done's pipeline item — never the
acceptance criteria. Ask its questions in this order; the first "yes" decides, and the ones after it
are not asked:

1. **Is there no continuous integration?** `cicd.provider` is `none` or empty. The line reads
   "No continuous integration is set up, so the story's commit is built and tested by hand, and every
   test passes." Why: "this repository has no continuous integration".
2. **Is it not GitHub Actions?** `cicd.provider` is anything but `github-actions`. The line reads
   "Continuous integration passes for the story's commit on <provider>, checked by hand.",
   the provider being the one whose file `cicd.workflows` names (`.gitlab-ci.yml`,
   `azure-pipelines.yml`, `Jenkinsfile`, `.circleci/config.yml`). Why: "continuous integration here
   is not GitHub Actions".
3. **Can `gh` not read it on this machine?** Any one of: `hasGit` false, `github.ghCli.declined`
   true, `github.ghCli.available` false, `github.ghCli.authenticated` false. The line reads
   "Continuous integration passes for the story's commit on GitHub Actions, checked by hand." Why,
   the first that holds: "this repository has no git", "you declined gh", "gh is not installed here",
   "gh is not signed in".
4. **Otherwise**, and only then — `github-actions`, git, and `gh` installed, signed in and not
   declined — the goal execution prompt's commit bullet reads "Commit and push to main to trigger the
   CI/CD. Use `gh` to confirm every workflow run for the commit passes.", followed by the commands
   that prove it, and the definition of done's item reads "Pushed to main; every pipeline run passes,
   checked with `gh`.":

   ```bash
   # Every workflow run for the story's commit: each must read status completed, conclusion success.
   gh run list --commit <sha> --json name,status,conclusion
   # One still running: waits for it, and exits non-zero when it fails.
   gh run watch <run id> --exit-status
   ```

   `<sha>` is the story's commit and `<run id>` comes from the first command; the implementation run
   fills them in.

Under questions 1 to 3 the prompt's commit bullet and the definition of done's item are the one sentence
above, and the story holds **no `gh` command at all**; the report says why in its one line. The front
door's "set up GitHub" changes the answer for the next story.

Nothing here runs `gh`: the line is written, and the implementation run checks it once the story's
commit exists.
