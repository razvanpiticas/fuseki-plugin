# The front door, field by field

Load this when writing the status, printing the menu, or deciding who may write a key of
`.fuseki/state.json`. The skill carries the eight steps; this carries what each line is read from.

## The status lines

Seven lines, in this order. Each is read from a tool or from the state, never invented, and a line
whose read was refused says so rather than guessing.

| Line | Read from | Say |
| --- | --- | --- |
| The project | `pnpm dlx github:razvanpiticas/fuseki-plugin state get project`; `get_project`: `name`, `key`, `methodology`, `archivedAtUtc` | "This repository is bound to Fuseki Platform (FUS), Scrum." Add "It is archived." when `archivedAtUtc` is set |
| The open sprint | `list_sprints(projectKey)`: the sprint whose state is `Active` — its name, start and end | "Sprint 14 is open, 1 to 14 October." When none is active: "No sprint is open." For a Kanban project: "Kanban: no sprints." |
| Untyped links | `list_untyped_links(projectKey, pageSize: 100)`: how many links the page holds, and `nextCursor` | "12 inferred links have no word yet; type the links to give them one." When `nextCursor` is set: "100 or more …". When none: "Every inferred link has its word." |
| Pending proposals | `list_insights(projectKey, pendingProposals: true)`: the insights answered plus `notReturnedCount` | "2 proposals wait for a person on the skill definitions' Guidance tab." When none: "No proposal waits." |
| Routines on | `list_routines(projectKey)`: the routines whose `isEnabled` is true; `pnpm dlx github:razvanpiticas/fuseki-plugin state get routines`: which of them this machine carries an entry for | "Weekly linker is on and fires from this machine; Weekly distiller is off." A routine on with no entry here: "… is on, and no machine entry here fires it." |
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
| `wiki.*` | the map skills |
| `planning` | the three plan skills |
| `uiTesting` | the front door (through `tooling check`, `env init` and `env check`) |
| `repository` | the front door (through `tooling check`) |
| `routines` | `schedule add` and `schedule remove` |

The state never holds a secret, a token or a key. The one credential the plugin handles, the test
account for browser checks, is in `.fuseki/.env`, which the person fills by hand; the tool reports
only which of its keys are filled.

## The menu

Twenty lines, grouped the way a person meets the work. Each line names the skill it goes to; the
build refuses a line whose skill directory does not exist unless the line says so, and refuses a line
whose words the named skill's own description does not use. A skill not yet in this version carries
the suffix; picking it answers "That part of Fuseki is not installed yet; the plugin update will
bring it." and shows the menu again.

```
What else I can do:
Plan
 1. Plan the product vision           — the fuseki-plan-product-vision — not in this version yet
 2. Plan an epic                      — the fuseki-plan-epic — not in this version yet
 3. Plan a feature                    — the fuseki-plan-feature — not in this version yet
 4. Plan a story                      — the fuseki-plan-story — not in this version yet
Map the code
 5. Map the system                    — the fuseki-map-system — not in this version yet
 6. Map a subsystem                   — the fuseki-map-subsystem — not in this version yet
 7. Map a story                       — the fuseki-map-story — not in this version yet
 8. Write a system document           — the fuseki-map-sys-doc — not in this version yet
 9. Write a guide                     — the fuseki-map-guide — not in this version yet
10. Write a pattern                   — the fuseki-map-pattern — not in this version yet
11. Write a cross-cutting document    — the fuseki-map-cross-cutting — not in this version yet
12. Write a walkthrough               — the fuseki-map-walkthrough — not in this version yet
13. Write the coding standards        — the fuseki-coding-standards — not in this version yet
Work and keep it in shape
14. Search the work                   — the fuseki-search
15. Type the links                    — the fuseki-linker
16. Distil the insights               — the fuseki-distiller
17. Routines: switch on, run now      — the fuseki-routines
18. Set up GitHub                     — the fuseki
19. Set up browser testing            — the fuseki
20. Update the plugin                 — the fuseki-update
Or just say what you want read or written in Fuseki.
```

On Codex the prefix renders `$`; on Claude Code it carries the plugin's namespace, `/fuseki:`; on
harnesses with no command the line names the skill in words. A line carrying the suffix still names
its skill, so a person knows what is coming and the build can tell when it has arrived: when a
skill's story lands, its author deletes the suffix from that line, and the build refuses a stale one
the same day.
