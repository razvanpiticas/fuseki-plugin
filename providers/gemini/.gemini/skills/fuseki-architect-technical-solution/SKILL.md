---
name: fuseki-architect-technical-solution
description: Architect a technical solution for one story of a Fuseki project, by the method the server holds as the skill definition architect-technical-solution — the code read as it is, every part the story touches checked for the refactoring it needs so the new code fits instead of stacking on top, what the story replaces, the build order with the test that proves each step, and mermaid diagrams of the architecture, the types and every flow — written to the story's technical-solution field and nothing else. plan-story's technical solution agent runs it and it answers only "done" or "blocked: <the question>"; run on its own, it asks the person instead. Use when the person asks to architect, design, plan or redo the technical solution of a story, or picks "Architect a technical solution" from the Fuseki menu.
---

# Architect a technical solution

The method — what to read, how every part the story touches is checked for refactoring, what the
solution holds, its diagrams and when it is done — is not in this file. It is the skill definition
`architect-technical-solution`, which the server holds and a person customises for the organisation
or for one project, so the method changes without a new plugin. This file is the mechanics: who
called it, the one field it writes, what it answers, and the change set it writes in.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `pnpm dlx github:razvanpiticas/fuseki-plugin <command>`, from the repository's root; every
`fuseki state …` in this file means that. Every read and write of work goes through the `fuseki-work`
skill's rules: names in, identifiers out, a version for every edit.

1. **Who called it.** Two ways in, told apart by what the request hands over:
   - **plan-story's technical solution agent** hands over the project's key, the story's reference
     code and a change set's id. This run asks the person nothing, opens no change set, replaces any
     technical solution the story already holds, and answers only "done" or "blocked: …", as step 5
     says. Nothing it read goes into the answer, and it never asks the insight question: plan-story
     asks it once, for the whole run.
   - **The person**, naming a story: everything below, plus the change set of step 4, the question of
     step 2 and the end of step 6.
2. **Read the story** with `get_work_item`: its user story, description, acceptance criteria,
   Relevant Wiki section, technical solution and version. Read its feature the same way, and
   `fuseki state get docsRoot` and `fuseki state get codingStandards` for where the wiki and the coding
   standards are. Run by the person on a story whose technical solution is already filled: ask whether
   to refine it or replace it. Ask the user directly to clarify what you cannot infer.
3. **Follow the definition.** A story touching several subsystems gets one analysis agent per
   subsystem, in parallel, each handed `docsRoot`, the coding standards' path, the subsystem and the
   story's reference code, and told to return findings with file and line, never a design and never a
   write. Every finding is checked against the code before the solution leans on it.
4. **The change set.** plan-story's run writes in the change set it handed over. The person's run opens
   its own before the write: `start_change_set` with the project's key and the summary "Architect the
   technical solution of <the story's code>, <moment> UTC" (the moment from
   `date -u "+%Y-%m-%d %H:%M:%S"` taken then, so a second run opens its own change set).
5. **Write, or say what blocks it.**
   - **Done:** one `update_work_item` on the story with `technicalSolutionMarkdown` only, against the
     version step 2 read, carrying the change set's id. The description, the acceptance criteria and
     every other field stay as read. A `CONFLICT` naming a version: read the story again and decide
     again from what it now holds. Then plan-story's run answers "done", word for word.
   - **Blocked:** empty acceptance criteria, or a Relevant Wiki section still a placeholder, or a
     question only product behaviour can answer that the acceptance criteria do not settle. Write
     nothing. plan-story's run answers "blocked: <which part is missing>" or "blocked: <the question,
     with the options>", and nothing else. The person's run asks the question instead, carries on
     from the answer, and says in the report that the acceptance criteria should say it too.
     Ask the user directly to clarify what you cannot infer.
6. **End the person's run.** **The insight question comes first**, before `complete_change_set` and inside this change set. Read back what you wrote and what the person answered. Something blocked you when an answer the definition asks for is one the person said they did not know or could not give, when you wrote a default, a guess or a placeholder in its place, or when your report will list it as still open. "Work with what you have", "write it now" and "go ahead" are not that answer: what they leave open still blocked you. When something did, say what, ask whether to record an insight, and stop there with the change set running; after the person answers, record the insight on a yes, then complete it. A yes or a no the person already gave in this session is that answer, so do not ask again. When nothing did, complete it. A report never says nothing blocked you beside an answer it lists as open. Completing it is `complete_change_set` with outcome
   `Completed` and a summary naming the story by code. A refusal from `update_work_item` wrote nothing:
   complete the change set with outcome `Failed` and the refusal's sentence as the reason.
7. **Report** the person's run by reference code: the story, that its technical-solution field was
   written (or what blocked it), how many refactorings, replacements and build steps it holds, and the
   definition's level and version.

This skill writes nothing in `.fuseki/state.json`: it reads `docsRoot` and `codingStandards`, which
other skills own.
