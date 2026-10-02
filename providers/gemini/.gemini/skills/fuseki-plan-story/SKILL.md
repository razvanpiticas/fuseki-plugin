---
name: fuseki-plan-story
description: Plan a story in a Fuseki project so whoever builds it assumes nothing, by the method the server holds as the skill definition plan-story — its description, acceptance criteria and technical solution written onto the work item in one change set, a screen's criteria written as playwright-cli browser checks, "continuous integration passes" written as the gh commands that prove it only when the repository runs GitHub Actions and gh here is installed, signed in and not declined (otherwise as a check by hand), the story recorded in .fuseki/state.json. Use when the person asks to plan, specify, refine or write acceptance criteria for a story, or picks "Plan a story" from the Fuseki menu.
---

# Plan a story

The method — what to read, what to ask, how acceptance criteria are written and when the story is
ready — is not in this file. It is the skill definition `plan-story`, which the server holds and a
person customises for the organisation or for one project, so the method changes without a new
plugin. This file is the mechanics: which kind the work item is, how its three bodies are written,
how browser checks and continuous integration enter its "done when", and what `.fuseki/state.json`
records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that. Every read and write of work goes through the `fuseki-work`
skill's rules: names in, identifiers out, a version for every edit.

1. **The kind.** Fuseki has no Story entity: a kind of work item is a row the organisation edits. Call
   `get_project_vocabulary(projectKey)` before anything is written, and find the kind named "Story"
   (any letter case). When it is missing, stop before opening a change set and say so in one sentence,
   with every kind the organisation has and its level: "This organisation has no kind of work item
   called Story, so there is no story to plan. Its kinds are: Epic (level 1), Task (level 2)." Use the
   name exactly as the vocabulary answered it.
2. **Read the repository**, before the definition: `fuseki state get uiTesting` for
   [Browser checks](#browser-checks) and `fuseki state get repository` for
   [Continuous integration](#continuous-integration). The acceptance criteria depend on both.
3. **Follow the definition** to a story the person agreed. Answers the person already gave — in the
   request or earlier in the session — are answers: do not ask them again. The story named by
   reference code is read with `get_work_item`, with its feature, its epic and the product vision; the
   wiki is `fuseki state get wiki`, then the files it lists.
4. **Write, in one change set.** `start_change_set` with the project's key and the summary
   "Plan a story: <the story's title>, <moment> UTC" (the moment from `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set). The story the backlog already holds is written with one
   `update_work_item` — `descriptionMarkdown`, `acceptanceCriteriaMarkdown` and
   `technicalSolutionMarkdown` together, against the version `get_work_item` answered. A story that
   does not exist yet is created first with `create_work_items` and one entry (`itemTypeName` the
   Story kind, `parentReferenceCode` its feature): `create_work_item` takes no parent. Every call carries `changeSetId`.
5. **Type the links.** Load the `fuseki-linker` skill and follow it, with the project's key and
   the change set's id, before completing the change set; keep the lines it hands back for the report.
   Its calls are its own: this skill never calls `list_untyped_links` or `type_link` itself, even when
   there may be no link to type.
6. **The state.** `fuseki state set planning.lastStory '"<the story's code>"'`. `planning` belongs to
   the three plan skills, and this one writes only `lastStory`.
7. **End the run.** The insight question comes first, as above, inside this change set: an answer
   the definition asks for that the person could not give, left open in the plan, is something that
   blocked you. Then
   `complete_change_set` with outcome `Completed` and a summary naming the story by code.
8. **Report** by reference code what the tools answered: the story and its three bodies, whether its
   browser checks were run, how continuous integration is checked and why, the linker's lines, and the
   definition's level and version.

## Browser checks

Before following the definition, read `fuseki state get uiTesting` and keep it for the acceptance criteria.
- **A story that changes a screen** gets acceptance criteria written as `playwright-cli` walkthrough steps against `uiTesting.baseUrl`, every command in one browser session of its own, named with `--session=<session>` (`<session>` a short lowercase name for the story, letters, digits and hyphens), so the walkthrough never uses the person's own browser session. The first two steps are `playwright-cli session-stop <session>` and `playwright-cli session-delete <session>`, so it starts signed out; then open the page, `snapshot`, act on an element the snapshot names (`fill` and `click` take the `ref` it names), `snapshot` again and read the result back; the last two steps are the same two commands, which close that browser and forget its sign-in (a running session is stopped before its data can be deleted). One step per line, each a command a person can run. A story that changes no screen gets none. An empty `baseUrl` is written as `<the app's address>`, and the answer says the front door's "set up browser testing" records it.
- **`requiresSignIn` true:** right after the first two steps, the steps sign in with the keys of `.fuseki/.env`, written by name — `FUSEKI_UI_USERNAME` and `FUSEKI_UI_PASSWORD` — never by value. When `envKeysPresent` lacks either, say the file still has a blank key, and write the steps anyway.
- **`playwrightCli.available` true:** once the criteria are written, offer to run the walkthrough once against the running app, to prove its steps can be followed. On yes, run it step by step and say what each step showed. The credentials are read from `.fuseki/.env` only at the moment of signing in, straight into the fill, one command per field: `playwright-cli --session=<session> fill <ref> "$(grep '^FUSEKI_UI_USERNAME=' .fuseki/.env | cut -d= -f2-)"`, and the same with `FUSEKI_UI_PASSWORD`. Never `cat`, print, echo or open `.fuseki/.env` any other way; never put a value in a command, the chat, a work item or the state; and never `snapshot` while the sign-in form holds them, because a snapshot prints every field's value — the command after the last fill is the click that signs in. The run ends with the last two steps, and acts on no session the steps do not name.
- **`playwrightCli.available` false:** write the steps and do not run them, and end the answer with this line, word for word: "playwright-cli is not installed here, so the browser checks are written and not run."

## Continuous integration

Read `fuseki state get repository` before following the definition. It alone decides which of three
criteria the story's acceptance criteria end with. Ask its questions in this order; the first "yes"
decides, and the ones after it are not asked:

1. **Is there no continuous integration?** `cicd.provider` is `none` or empty. The criterion reads
   "No continuous integration is set up, so the story's commit is built and tested by hand, and every
   test passes." Why: "this repository has no continuous integration".
2. **Is it not GitHub Actions?** `cicd.provider` is anything but `github-actions`. The criterion
   reads "Continuous integration passes for the story's commit on <provider>, checked by hand.",
   the provider being the one whose file `cicd.workflows` names (`.gitlab-ci.yml`,
   `azure-pipelines.yml`, `Jenkinsfile`, `.circleci/config.yml`). Why: "continuous integration here
   is not GitHub Actions".
3. **Can `gh` not read it on this machine?** Any one of: `hasGit` false, `github.ghCli.declined`
   true, `github.ghCli.available` false, `github.ghCli.authenticated` false. The criterion reads
   "Continuous integration passes for the story's commit on GitHub Actions, checked by hand." Why,
   the first that holds: "this repository has no git", "you declined gh", "gh is not installed here",
   "gh is not signed in".
4. **Otherwise**, and only then — `github-actions`, git, and `gh` installed, signed in and not
   declined — the criterion reads "The GitHub Actions workflows run for the story's commit, and
   every one passes.", followed by the commands that prove it:

   ```bash
   # Every workflow run for the story's commit: each must read status completed, conclusion success.
   gh run list --commit <sha> --json name,status,conclusion
   # One still running: waits for it, and exits non-zero when it fails.
   gh run watch <run id> --exit-status
   ```

   `<sha>` is the story's commit and `<run id>` comes from the first command; whoever checks the
   story fills them in.

Under questions 1 to 3 the acceptance criteria hold **no `gh` command at all**, not even one offered
to whoever checks the story elsewhere: the criterion is the one sentence above, and the report says
why in its one line. The front door's "set up GitHub" changes the answer for the next story.

Nothing here runs `gh`: the criterion is written, and checked once the story's commit exists.
