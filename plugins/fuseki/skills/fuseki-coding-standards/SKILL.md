---
name: fuseki-coding-standards
description: Write the coding standards of this repository — the rules every change follows, drawn from what the code already does and what the team says it wants — by the method the server holds as the skill definition coding-standards, at the documentation root's wiki/system-wide/coding-standards.md, never over an existing file without the person's yes, and record it in .fuseki/state.json. Use when the person asks to write, refresh or start the coding standards, the coding conventions or the rules for this codebase, or picks "Write the coding standards" from the Fuseki menu.
argument-hint: [what the team wants kept or changed]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" *), Bash(date *), Bash(mkdir *), Bash(git ls-files *), Bash(git log *), Read, Write, Edit, Glob, Grep, mcp__fuseki__get_skill_definition, mcp__fuseki__list_insights, mcp__fuseki__get_insight, mcp__fuseki__start_change_set, mcp__fuseki__complete_change_set, mcp__fuseki__record_skill_definition_insight, mcp__fuseki__get_project, mcp__fuseki__list_projects, mcp__fuseki__list_portfolios, mcp__fuseki__server_info
---

# Write the coding standards

The method — how the repository's conventions are found, what to ask the team, how a rule is written
and when the document is done — is not in this file. It is the skill definition `coding-standards`,
which the server holds and a person customises for the organisation or for one project, so the method
changes without a new plugin. This file is the mechanics: where the document goes, the one file it
never overwrites unasked, and what `.fuseki/state.json` records.

Before anything else, read `.fuseki/state.json` through `fuseki state get project` (run the fuseki skill first if it is missing). Call `get_skill_definition` with this skill's code and the bound project key. Read the instructions whole: they are the method, and this file is only the mechanics. Do what they say, in their order, asking the person where they say to ask. Never read insights unless the person asks. When you finish, if anything blocked you, say what, and ask whether to record an insight; record it only on a yes, with `record_skill_definition_insight` inside the change set you used.

## The mechanics

The command-line tool runs as `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs" <command>`, from the repository's root; every
`fuseki state …` in this file means that.

1. **Where.** `fuseki state get docsRoot`; empty means the repository is not set up, so run
   `/fuseki:fuseki` first and write nothing until it answers. The document is
   `<docsRoot>/wiki/system-wide/coding-standards.md` (`mkdir -p` the folder first). Keep the
   `version` `get_skill_definition` answered: the state records which version of the method wrote it.
2. **An existing file is the person's.** When the file exists, read it whole before anything else,
   and never replace or rewrite it without the person's yes to exactly that. STOP and call the AskUserQuestion tool to clarify. The
   question, word for word: "<path> already holds coding standards. Replace it with the new text?"
   An earlier "yes" to writing standards in general is not a yes to replacing this file. On no, write
   nothing and say so; the state is not touched.
3. **Follow the definition**, reading the repository for every rule it proposes. Answers the person
   already gave are answers: do not ask them again.
4. **The state.** `fuseki state set codingStandards '{"path":"<docsRoot>/wiki/system-wide/coding-standards.md","definitionVersion":<version>}'`,
   the path relative to the repository's root. `codingStandards` is this skill's key, and the only one
   it writes; `fuseki-map-system` never records this file.
5. **The insight question**, as above:

   This skill writes nothing on the server while it works, so it opens no change set. An insight is recorded inside one, so when the person says yes to recording an insight, open one then — `start_change_set` with the bound project's key and a one-line summary naming this skill and the moment from `date -u "+%Y-%m-%d %H:%M:%S"`, so a second insight opens its own change set — call `record_skill_definition_insight` with its `changeSetId`, and complete it with `complete_change_set`, outcome `Completed` and a one-line summary.
6. **Report** the file by path, whether it was written new or replaced on the person's yes, how many
   rules it holds, and the definition's level and version.
