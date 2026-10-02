---
name: fuseki-plan-product-vision
description: Plan the product vision of a Fuseki project — who the product is for, the problem it solves, why now and how success is measured — by the method the server holds as the skill definition plan-product-vision, then save it on the project, keep the same text in the repository's documentation and record both in .fuseki/state.json. Use when the person asks to write, plan, refresh or rewrite the product vision, says the project has no vision yet, or picks "Plan the product vision" from the Fuseki menu.
---

# Plan the product vision

The method — what to ask, in what order, what a vision says and when it is done — is not in this
file. It is the skill definition `plan-product-vision`, which the server holds and a person customises
for the organisation or for one project on the skill definitions screen, so the method changes without
a new plugin. This file is the mechanics: where the vision is saved, the copy in the repository, and
what `.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that.

1. **Before the definition.** `fuseki state get project` answers the bound project's key, and
   `fuseki state get docsRoot` the documentation root (empty: run `$fuseki` first).
   `get_skill_definition("plan-product-vision", projectKey)` answers the method: keep its `version`
   and `level`, because the state records which version of the method wrote the vision.
   `get_product_vision(projectKey)` answers the vision the method starts from, if there is one.
2. **Follow the definition** to a text the person agreed. Answers the person already gave — in the
   request or earlier in the session — are answers: do not ask them again.
3. **Save it on the project**, inside one change set: `start_change_set` with the project's key and
   the summary "Plan the product vision for <key>, <moment> UTC" (the moment from `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set), then `save_product_vision(projectKey,
   bodyMarkdown, changeSetId)` with the whole agreed text. It replaces what was there; the project's
   vision screen shows it from then on.
4. **The copy in the repository.** Write the same text, unchanged, to
   `<docsRoot>/product/product-vision.md` (`mkdir -p <docsRoot>/product` first). The server's text is
   the vision; the file is its copy, so it is overwritten with every save.
5. **The state.** Take the time of the save with `date -u +%Y-%m-%dT%H:%M:%SZ`, then
   `fuseki state set productVision '{"path":"<docsRoot>/product/product-vision.md","definitionVersion":<version>,"savedToServerAtUtc":"<that time>"}'`.
   `productVision` is this skill's key, and the only one it writes.
6. **End the run.** **The insight question comes first**, before `complete_change_set` and inside this change set. Read back what you wrote and what the person answered. Something blocked you when an answer the definition asks for is one the person said they did not know or could not give, when you wrote a default, a guess or a placeholder in its place, or when your report will list it as still open. "Work with what you have", "write it now" and "go ahead" are not that answer: what they leave open still blocked you. When something did, say what, ask whether to record an insight, and stop there with the change set running; after the person answers, record the insight on a yes, then complete it. A yes or a no the person already gave in this session is that answer, so do not ask again. When nothing did, complete it. A report never says nothing blocked you beside an answer it lists as open. Completing it is
   `complete_change_set` with outcome `Completed` and a one-line summary: "Saved the product vision
   of <key>, by plan-product-vision version <n>."
7. **Report** what the tools answered: that the vision was saved (its first heading), the file
   written, and the definition's level and version, such as "Project, version 3".

A refusal from `save_product_vision` saved nothing: write no file, set no state, complete the change
set with outcome `Failed` and the refusal's sentence as the reason, and say what it said.
