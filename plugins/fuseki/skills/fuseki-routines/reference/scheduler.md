# The scheduler on this machine

Load this when installing, removing or listing a routine's entry, or when a routine that is on never
seems to run.

## The command

`fuseki schedule` lives in the plugin's command-line tool, run as `node "${CLAUDE_PLUGIN_ROOT}/cli/bin/fuseki.mjs"`:

```
fuseki schedule add --harness <claude-code|codex> --routine <id> --name "<name>" --cron "<m h dom mon dow>" --zone "<IANA zone>" --project-dir "<path>" --prompt "<text>"
fuseki schedule remove --routine <id>
fuseki schedule list [--project-dir "<path>"]
```

Node 22.12 or later is needed, which the plugin already needs.

`add` refuses: a harness other than the two above ("no verified non-interactive command"); a zone
that is not the machine's; a line Task Scheduler cannot express (Windows only); a second entry for
the same routine (remove first); a project directory whose `.fuseki/state.json` is missing or cannot
be read. It prints the entry it wrote and when it next fires, and records the entry under
`routines.<routine id>` in that directory's `.fuseki/state.json` — `name`, `installedAtUtc`, `harness`
and `entry`. `remove` finds the entries by the routine id it stamped, prints what it removed or
"Nothing installed here", and deletes `routines.<routine id>` from the state of the directory the
entries ran in. `list` prints every entry the command made, one line each: routine id, harness, line,
project directory, what runs.

## What is installed

| Machine | Entry |
| --- | --- |
| macOS, Linux | one crontab line: `<m h dom mon dow> cd "<project-dir>" && <command> # fuseki:<routine id>`, appended with `crontab -l` / `crontab -` so the person's other lines stay |
| Windows | one Task Scheduler task per time of day in the line, named `Fuseki <routine id>` or `Fuseki <routine id> <n>`: `/SC DAILY /ST HH:MM`, or `/SC WEEKLY /D <days>` for a weekday list. It runs `cmd /c <script>`, where the script is one `.cmd` file per routine under `%LOCALAPPDATA%\Fuseki\schedule\`, holding the directory change and the harness command; `remove` deletes it with the tasks. Task Scheduler takes at most 261 characters for what a task runs, which a project path plus the prompt is past, so the task runs the script and the script carries the rest |

The command per harness, started on the firing prompt:

| Harness | Command the entry runs |
| --- | --- |
| Claude Code | `claude -p "<prompt>" --permission-mode auto --permission-prompts none` |
| Codex | `codex exec "<prompt>" --sandbox workspace-write` |

The firing prompt, always exactly:

```
Use the fuseki-routines skill: run the routine "<routine name>" on the project "<project key>".
```

Task Scheduler limits: minutes and hours must be numbers or lists; day of week `*` or a list of
days; day of month and month must be `*`. Steps (`*/2`), day-of-month lists and month values are
refused: simplify the line on the Routines tab, or run it by hand.

A Task Scheduler task holds a frequency and one time of day, not a cron line, so `list` on Windows
prints the task's own schedule — `WEEKLY MON 01:00` — where a crontab prints the five fields back.
The routine's line as the server holds it is in `list_routines`.

To see a task with the operating system's own eyes: `schtasks /Query /TN "Fuseki <routine id>"` on
Windows, `crontab -l` elsewhere.

## What must already be true

- The harness has signed in to Fuseki once on this machine, in an interactive session: the plugin's
  sign-in flow. A scheduled run that finds no token fails without saying so.
- On Claude Code, the plugin is enabled where the entry starts, and the routine was run once by hand,
  so the tool approvals are saved; `--permission-prompts none` denies anything that would have
  prompted. **That flag needs Claude Code 2.1.259 or later**; an earlier one rejects the whole command
  with `error: unknown option '--permission-prompts'` and the routine fires into nothing.
  `claude --version` says which this machine has.
- The repository has its `.fuseki/state.json` (`/fuseki:fuseki` creates it): the entry runs in
  that directory, and the run reads the bound project there.
- The machine is on and awake at the time. A cron or Task Scheduler entry does not catch up a missed
  run.

## Symptoms

| Symptom | Cause | Do |
| --- | --- | --- |
| The routine is on, the run report never comes | no entry on this machine, or the machine slept | `schedule list`; install; keep the machine awake |
| The run report says it could not sign in | no cached token for a run nobody started | run it once by hand in the harness, then let the schedule fire |
| The run stalls, then the runs screen shows it failed after two hours | a tool prompted and nobody answered | the `--permission-prompts none` flag is missing from the entry; reinstall it |
| Fires at the wrong hour | the routine's zone is not the machine's | set the zone on the Routines tab to the machine's and reinstall |
| `schedule add` refuses the line on Windows | Task Scheduler cannot express it | simplify the line on the Routines tab, or run by hand |
| The routine is off on the screen and still runs | the entry here was never removed | `schedule remove --routine <id>` |
| `error: unknown option '--permission-prompts'` | Claude Code is older than 2.1.259 | update Claude Code; the entry needs no change |
