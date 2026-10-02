# Where a proposal goes: the project's level or the organisation's

Load this when choosing a proposal's level, reading the text it is written against, or telling the
person where to rule on it.

A skill definition is in force at the first level that holds one: **the project's copy, then the
organisation's copy, then the one the product ships**. A proposal names the level it is meant for,
and is applied there — to the copy at that level, made first when there is none yet.

| Level | When | Read the text in force with | Record with | The person rules on |
| --- | --- | --- | --- | --- |
| `Project` | every insight the proposal folds came from this one project | `get_skill_definition(code, projectKey)` — the project's copy, else the organisation's, else the shipped text; note `version` and `level` | `record_skill_definition_insight(code, projectKey, title, body, proposedText, proposalScope: Project, changeSetId)` | the project's skill definition, Guidance tab: `https://fuseki.dev/dashboard/projects/<project key>/settings/skills/<code>` |
| `Organisation` | the insights came from more than one project, or from none | `get_skill_definition(code)` — the organisation's copy, else the shipped text | `record_skill_definition_insight(code, projectKey?, title, body, proposedText, proposalScope: Organisation, changeSetId)` — `projectKey` only when the insights came from one project | the organisation's skill definition, Guidance tab: `https://fuseki.dev/dashboard/organisation/skill-definitions/<code>` |

Every proposal waiting for a person is also listed at `https://fuseki.dev/dashboard/organisation/proposals`.

The pass that runs on a project reads that project's insights, so its proposals are `Project`.
`Organisation` is for a pass the person asked to run across the organisation, reading
`list_insights(since)` with no project.

A proposal is stamped with the version in force at its level when it is recorded. If the person edits
the text before ruling, Apply refuses the proposal as written against an older version and says so;
the next pass writes a new one against the new text. Do not pre-empt it.

`supersede_insight` takes the same `code` as the drafts and the proposal, and the proposal as the
newer insight.
