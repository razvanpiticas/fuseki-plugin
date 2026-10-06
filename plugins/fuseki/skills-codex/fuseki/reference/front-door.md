# The front door, field by field

Load this when writing the status, printing the menu, or deciding who may write a key of
`.fuseki/state.json`. The skill carries the eight steps; this carries what each line is read from.

## The status lines

Eight lines, in this order. Each is read from a tool or from the state, never invented, and a line
whose read was refused says so rather than guessing.

| Line | Read from | Say |
| --- | --- | --- |
| The project | `pnpm dlx github:razvanpiticas/fuseki-plugin state get project`; `get_project`: `name`, `key`, `methodology`, `archivedAtUtc` | "This repository is bound to Fuseki Platform (FUS), Scrum." Add "It is archived." when `archivedAtUtc` is set |
| The open sprint | `list_sprints(projectKey)`: the sprint whose state is `Active` — its name, start and end | "Sprint 14 is open, 1 to 14 October." When none is active: "No sprint is open." For a Kanban project: "Kanban: no sprints." |
| Untyped links | `list_untyped_links(projectKey, pageSize: 100)`: how many links the page holds, and `nextCursor` | "12 inferred links have no word yet; type the links to give them one." When `nextCursor` is set: "100 or more …". When none: "Every inferred link has its word." |
| Pending proposals | `list_insights(projectKey, pendingProposals: true)`: the insights answered plus `notReturnedCount` | "2 proposals wait for a person on the skill definitions' Guidance tab." When none: "No proposal waits." |
| Routines on | `list_routines(projectKey)`: the routines whose `isEnabled` is true; `pnpm dlx github:razvanpiticas/fuseki-plugin state get routines`: which of them this machine carries an entry for | "Weekly linker is on and fires from this machine; Weekly distiller is off." A routine on with no entry here: "… is on, and no machine entry here fires it." |
| The documents | `pnpm dlx github:razvanpiticas/fuseki-plugin state get productVision`, `codingStandards` and `wiki`, after step 4 | "The vision, the coding standards, structure, 3 system-wide decision records and 6 subsystems with 26 decision records are recorded; architecture and testing are not written yet." Name what is recorded — the system-wide decision records (`wiki.systemWide.decisions`) apart from the subsystems' — then what is empty. When nothing is: "No documents are recorded yet; mapping the system writes them." |
| The repository | `pnpm dlx github:razvanpiticas/fuseki-plugin state get repository` | "git · GitHub example-owner/example-repo · gh signed in · GitHub Actions, 2 workflows". What is missing is named in its place: "no git", "no GitHub remote", "gh not installed" (and "declined" when it was), "gh not signed in", "no continuous integration found" |
| Browser testing | `pnpm dlx github:razvanpiticas/fuseki-plugin state get uiTesting` | "playwright-cli 0.0.58 · http://localhost:3002 · signs in as the test account in .fuseki/.env". What is missing is named in its place: "playwright-cli not installed" (and "declined" when it was), "no address yet", "no sign-in needed", ".fuseki/.env still has blank keys: FUSEKI_UI_PASSWORD" — the key names `env check` printed, never a value |

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
| `planning` | the three plan skills |
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

Twenty-one lines, grouped the way a person meets the work. Each line names the skill it goes to; the
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
Map the code
 5. Map the system                    — $fuseki-map-system
 6. Map a subsystem                   — $fuseki-map-subsystem
 7. Map a story                       — $fuseki-map-story
 8. Write a system document           — $fuseki-map-sys-doc
 9. Write a guide                     — $fuseki-map-guide
10. Write a pattern                   — $fuseki-map-pattern
11. Write a cross-cutting document    — $fuseki-map-cross-cutting
12. Write a walkthrough               — $fuseki-map-walkthrough
13. Write a decision record           — $fuseki-map-decision
14. Write the coding standards        — $fuseki-coding-standards
Work and keep it in shape
15. Search the work                   — $fuseki-search
16. Type the links                    — $fuseki-linker
17. Distil the insights               — $fuseki-distiller
18. Routines: switch on, run now      — $fuseki-routines
19. Set up GitHub                     — $fuseki
20. Set up browser testing            — $fuseki
21. Update the plugin                 — $fuseki-update
Or just say what you want read or written in Fuseki.
```

On Codex the prefix renders `$`; on Claude Code it carries the plugin's namespace, `/fuseki:`; on
harnesses with no command the line names the skill in words. A line carrying the suffix still names
its skill, so a person knows what is coming and the build can tell when it has arrived: when a
skill's story lands, its author deletes the suffix from that line, and the build refuses a stale one
the same day.
