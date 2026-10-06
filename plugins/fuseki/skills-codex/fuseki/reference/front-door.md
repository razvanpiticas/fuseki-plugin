# The front door, field by field

Load this when writing the status, printing the menu, or deciding who may write a key of
`.fuseki/state.json`. The skill carries the nine steps; this carries what each line is read from.

## The status lines

Nine lines, in this order. Each is read from a tool or from the state, never invented, and a line
whose read was refused says so rather than guessing.

| Line | Read from | Say |
| --- | --- | --- |
| The project | `pnpm dlx github:razvanpiticas/fuseki-plugin state get project`; `get_project`: `name`, `key`, `methodology`, `archivedAtUtc` | "This repository is bound to Fuseki Platform (FUS), Scrum." Add "It is archived." when `archivedAtUtc` is set |
| The open sprint | `list_sprints(projectKey)`: the sprint whose state is `Active` — its name, start and end | "Sprint 14 is open, 1 to 14 October." When none is active: "No sprint is open." For a Kanban project: "Kanban: no sprints." |
| Untyped links | `list_untyped_links(projectKey, pageSize: 100)`: how many links the page holds, and `nextCursor` | "12 inferred links have no word yet; type the links to give them one." When `nextCursor` is set: "100 or more …". When none: "Every inferred link has its word." |
| Pending proposals | `list_insights(projectKey, pendingProposals: true)`: the insights answered plus `notReturnedCount` | "2 proposals wait for a person on the skill definitions' Guidance tab." When none: "No proposal waits." |
| Routines on | `list_routines(projectKey)`: the routines whose `isEnabled` is true; `pnpm dlx github:razvanpiticas/fuseki-plugin state get routines`: which of them this machine carries an entry for | "Weekly linker is on and fires from this machine; Weekly distiller is off." A routine on with no entry here: "… is on, and no machine entry here fires it." |
| The foundations | `pnpm dlx github:razvanpiticas/fuseki-plugin state get productVision`, `codingStandards` and `wiki`, after step 4 | A checklist, one mark per document, recorded ✓ or empty ✗: "✓ product vision · ✓ coding standards · ✗ system architecture · ✓ structure · ✗ testing", then the counts: "3 system-wide decision records · 6 subsystems with 26 decision records". A count of none is left out |
| Where we are | `pnpm dlx github:razvanpiticas/fuseki-plugin state get activity`; `get_backlog(projectKey)` | As [Where we are and the next step](#where-we-are-and-the-next-step) says |
| The repository | `pnpm dlx github:razvanpiticas/fuseki-plugin state get repository` | "git · GitHub example-owner/example-repo · gh signed in · GitHub Actions, 2 workflows". What is missing is named in its place: "no git", "no GitHub remote", "gh not installed" (and "declined" when it was), "gh not signed in", "no continuous integration found" |
| Browser testing | `pnpm dlx github:razvanpiticas/fuseki-plugin state get uiTesting` | "playwright-cli 0.0.58 · http://localhost:3002 · signs in as the test account in .fuseki/.env". What is missing is named in its place: "playwright-cli not installed" (and "declined" when it was), "no address yet", "no sign-in needed", ".fuseki/.env still has blank keys: FUSEKI_UI_PASSWORD" — the key names `env check` printed, never a value |

## Where we are and the next step

`activity` points at the epic and the feature being worked on, and holds the last three runs of the
plan skills and `fuseki-map-story`, newest first, and the last three stories built. Everything else is
read live with one `get_backlog(projectKey)`: find the epic's node, its features and their stories,
in rank order, each with what its state means.

A story is **built** when its state means Completed or its code is in `activity.implemented`;
**being built** when it means Started; **planned** when it means Unstarted; **not planned** when it
means Backlog. A Cancelled story is left out. A feature is built when it has stories and every one is
built.

**The line.** "Recently we worked on epic FUS-10 Team invitations, feature FUS-20 Invite by email.
Built: FUS-21, FUS-22, FUS-23. Left: FUS-24 (planned), FUS-25 (not planned)." Then the newest run:
"Last: Planned Invite by email link: 6 scenarios, Ready (plan-story, 6 October)." With no feature,
the epic's features stand where the stories do. With neither pointer set: "Nothing planned from this
repository yet." A pointer the backlog no longer answers is named as gone ("FUS-20 is not in the
backlog any more."), and no next step is offered.

**The next step**, the first rule that holds, starting from the feature (from the epic's first
feature not built when no feature is set):

1. The feature has a story not planned: the first in rank. "Should we continue with planning story
   <code> <title>?" → `fuseki-plan-story`.
2. Every story left is planned or being built: no question. Say "<code> is planned and waits to be
   built from its goal execution prompt." for the first in rank.
3. Every story is built: the epic's next feature in rank that is not built. With no stories yet:
   "Should we plan feature <code> <title>?" → `fuseki-plan-feature`. With stories: rules 1 and 2 for
   it, naming it: "Should we continue with planning story <code> <title> of feature <code>?"
4. Every feature of the epic is built: "Epic <code> is done. Should we plan the next epic?" →
   `fuseki-plan-epic`.

## Who writes which key

`.fuseki/state.json` is written only through the command-line tool, and each skill writes only its
own key. A key another skill owns is read, never set.

| Key | Owned by |
| --- | --- |
| `project`, `docsRoot`, `plugin` | the front door |
| `productVision` | `fuseki-plan-product-vision` |
| `codingStandards` | `fuseki-coding-standards` |
| `wiki.systemWide.architecture`, `.structure`, `.testing`, `.otherDocs` | `fuseki-map-system`; `fuseki-map-story` for a document it writes or updates; `fuseki-map-subsystem` sets `.structure` and `.architecture` only while empty, when it adds its row to them |
| `wiki.systemWide.decisions` | `fuseki-map-system` (the records already there), `fuseki-map-decision` and `fuseki-map-story` (a system-wide decision record each writes) |
| `wiki.subsystems.<name>` | `fuseki-map-subsystem` (the whole entry); each one-document map skill its own list, creating the entry when the subsystem is not mapped and the person declined mapping it first; `fuseki-map-story` the keys of the documents it writes or updates |
| `discovery` | the front door (through `state discover` and its question) |
| `onboarding` | the front door (a no to its vision, architecture or coding standards question) |
| `activity` | `fuseki activity record` alone, run by the three plan skills and `fuseki-map-story`; `state set` refuses it |
| `uiTesting` | the front door (through `tooling check`, `env init` and `env check`) |
| `repository` | the front door (through `tooling check`) |
| `routines` | `schedule add` and `schedule remove` |

**One exception, for a repository that was documented before the plugin came.** The front door's
`state discover` records a document already where a skill would write it under that skill's key —
`productVision.path`, `codingStandards.path`, `wiki.*` — but only while the key is empty, and the
front door records the candidates the person places. A recorded path is never replaced: from then
on the owning skill reads the document first and brings it up to date. `definitionVersion` stays
`null` on a found document, because no definition wrote it; the front door sets
`productVision.savedToServerAtUtc` only when it saved a found vision on the person's yes.

The state never holds a secret, a token or a key. The one credential the plugin handles, the test
account for browser checks, is in `.fuseki/.env`, which the person fills by hand; the tool reports
only which of its keys are filled.

## The menu

Twenty-two lines, grouped the way a person meets the work. Each line names the skill it goes to; the
build refuses a line whose skill directory does not exist unless the line says so, and refuses a line
whose words the named skill's own description does not use. A skill not yet in this version carries
the suffix; picking it answers "That part of Fuseki is not installed yet; the plugin update will
bring it." and shows the menu again.

```
What else I can do:
Plan
 1. Plan the product vision           — $fuseki-plan-product-vision
 2. Plan an epic                      — $fuseki-plan-epic
 3. Plan a feature                    — $fuseki-plan-feature
 4. Plan a story                      — $fuseki-plan-story
 5. Architect a technical solution    — $fuseki-architect-technical-solution
Map the code
 6. Map the system                    — $fuseki-map-system
 7. Map a subsystem                   — $fuseki-map-subsystem
 8. Map a story                       — $fuseki-map-story
 9. Write a system document           — $fuseki-map-sys-doc
10. Write a guide                     — $fuseki-map-guide
11. Write a pattern                   — $fuseki-map-pattern
12. Write a cross-cutting document    — $fuseki-map-cross-cutting
13. Write a walkthrough               — $fuseki-map-walkthrough
14. Write a decision record           — $fuseki-map-decision
15. Write the coding standards        — $fuseki-coding-standards
Work and keep it in shape
16. Search the work                   — $fuseki-search
17. Type the links                    — $fuseki-linker
18. Distil the insights               — $fuseki-distiller
19. Routines: switch on, run now      — $fuseki-routines
20. Set up GitHub                     — $fuseki
21. Set up browser testing            — $fuseki
22. Update the plugin                 — $fuseki-update
Or just say what you want read or written in Fuseki.
```

On Codex the prefix renders `$`; on Claude Code it carries the plugin's namespace, `/fuseki:`; on
harnesses with no command the line names the skill in words. A line carrying the suffix still names
its skill, so a person knows what is coming and the build can tell when it has arrived: when a
skill's story lands, its author deletes the suffix from that line, and the build refuses a stale one
the same day.
