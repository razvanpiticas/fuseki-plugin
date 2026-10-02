---
name: fuseki-routines
description: Routines: switch on, run now. The routines of a Fuseki project — what it has scheduled, switching a routine on or off in both places it lives (the server row, which the person switches on the project's Routines tab, and this machine's scheduler), rescheduling, editing or adding one, and running one now. It is also what a scheduled entry starts: "run the routine "<name>" on the project "<key>"" fires the routine — the change set naming it, its instructions followed with nobody asked, the change set completed with the digest. Use when the person asks what runs on its own, wants the Weekly linker or the Weekly distiller switched on or off, wants a routine rescheduled, edited or added, wants one run right now, or when a prompt says to run a routine.
---

# Fuseki routines

A routine is a row on the server: a name, a five-field cron line, the zone it is read in, and
instructions written to the agent that runs it. **The server never fires one.** This machine does,
and only if an entry for it exists in a scheduler here. So a routine lives in two places, and
switching it on means both: one without the other is a routine that never fires, or a schedule the
product shows as off.

The two places have two different hands. **Only a person changes the server's row**: switching it on
or off, rescheduling, editing, adding and deleting are done on the project's Routines tab, and no
tool does any of them (the service refuses every routine change made through this plugin). **This
machine's entry is yours**, through the command-line tool. So every change below is the person on
the screen first or last, and you on the machine in the other half, never both at once.

Every project is born with two, both switched off until a person reads them: the **Weekly linker**
(`0 1 * * 1`: gives the week's untyped links their words with `fuseki-linker`) and the **Weekly
distiller** (`0 2 * * 1`: folds the week's insights into proposals with `fuseki-distiller`).

The project is the one named, else the one this repository is bound to
(`pnpm dlx github:razvanpiticas/fuseki-plugin state get project`; run `the fuseki skill` first when it is missing). The
Routines tab is `https://fuseki.dev/dashboard/projects/<project key>/routines`: give the person that
link, with the key filled in, every time you send them there.

## The menu

With no argument: `list_routines(projectKey)`, and what this machine has installed,
`pnpm dlx github:razvanpiticas/fuseki-plugin schedule list --project-dir "<this repository's directory>"`. Show one line per routine —
name · cron line · read in · on or off · last fired · installed here or not — then offer: switch one
on, switch one off, reschedule or edit one, add one, run one now.

A routine that is on with no entry here never fires; one that is off with an entry here still
fires. Say so on its line when you see either.

## Switching a routine on

1. **Read it first.** `get_routine(projectKey, routineId)` — the id from `list_routines` — even when
   the list already carried the routine: every change starts from the one routine read whole, now.
   Then put it in your answer whole: its name, its line, its zone and its instructions, quoted word
   for word. A routine is switched on by somebody who has read it, and they read it in your answer,
   so ask for one yes. Ask the user directly to clarify what you cannot infer.
2. **The server first, by the person.** Unless `get_routine` already answered `isEnabled` true, give
   the Routines tab's link and ask the person to press **On** on the routine's row and say "done".
   Then stop and wait. Ask the user directly to clarify what you cannot infer. When they say it is done — in this message or the next —
   `get_routine` again, never `list_routines`: `isEnabled` true is the server's half done; false means
   it did not take, so say so and ask again. Nothing is installed for a routine the server shows off,
   and nothing is installed before that `get_routine` answered.
3. **Then this machine.** The entry starts the harness on its own, in this repository's directory,
   with the firing prompt — exactly this, with the routine's name and the project's key filled in:

   > Use the fuseki-routines skill: run the routine "<routine name>" on the project "<project key>".

   On a harness with no verified way to run a prompt on its own — Cursor, Gemini CLI, OpenCode,
   OpenClaw, Hermes — print the routine's line, its zone and the firing prompt, and say: "install this
   in a scheduler of your own that starts the harness with that prompt; until then, run it by hand
   with *run now*". Do not guess a command.

   The command writes a crontab line, or a Task Scheduler task on Windows, and records it under
   `routines.<routineId>` in `.fuseki/state.json`. It refuses a zone that is not this machine's, a
   line Task Scheduler cannot express, and a second entry for the same routine; the message says what
   to change, and [reference/scheduler.md](reference/scheduler.md) has the limits.
4. **If step 3 fails**, quote the message, say the routine is on and not installed, and ask the person
   to switch it off on the Routines tab (the link) until it can be installed: a routine that is on and
   fires from nowhere is one nobody notices never runs. When the zone was refused, the person can
   instead set the routine's zone to this machine's on the same tab; then install again.
5. **Offer to run it once now** (below) before trusting the schedule. The first run proves the
   sign-in reaches a run nobody started by hand.

Report: on; installed as `<what the command printed>`; next fires at `<time>` in `<zone>`.

## Switching a routine off

**This machine first**: `pnpm dlx github:razvanpiticas/fuseki-plugin schedule remove --routine <routineId>` (it also deletes
`routines.<routineId>` from the state, and says "Nothing installed here" when there was nothing).
**Then the server**: give the Routines tab's link, ask the person to press **Off** and say "done",
wait, and `get_routine` to see `isEnabled` false. In that order: if the second half never happens,
the routine is on and fires from nowhere, which is silent; the other way round is a schedule the
product shows as off that still runs every week. When the removal fails, stop there and quote it:
the server's half is left as it was.

## Rescheduling, editing or adding a routine

The person does it on the Routines tab; you show what to type, field by field:

- **Name** — one the project has not used.
- **Schedule** — five fields, `minute hour day-of-month month day-of-week`, numbers, `*`, lists,
  ranges and steps only; Sunday is `0`. On Windows a step, a day of the month and a month are refused
  by Task Scheduler, so keep to minutes, hours and weekdays when it is to fire from this machine.
- **Time zone** — this machine's own, if it is to fire from here: the command refuses any other.
- **Instructions** — written to the agent in the second person, every step naming something that
  exists: [reference/writing-a-routine.md](reference/writing-a-routine.md).

When they say it is done, `get_routine` and read it back. **When the routine is installed here**
(`routines.<routineId>` in `pnpm dlx github:razvanpiticas/fuseki-plugin state get routines`) **and its schedule or zone changed**,
reinstall in the same breath: `schedule remove`, then `schedule add` with the new values. A new
routine is born off; offer the switch-on flow.

## Running a routine now, and when it fires

"Run the Weekly linker now" and the firing prompt a scheduled entry types are one thing: **the
routine's run**, in this session. A routine run by hand is still the routine's run, so its change set
names the routine whether or not the routine is switched on, and the runs screen lists it in the
routine's audit.

1. **Read it.** `list_routines(projectKey)` finds the routine by the name given; `get_routine` reads it
   whole. Keep its `lastFiredAtUtc` as it is now: that is the previous firing, and opening the run
   moves it. Keep its `isEnabled` too: the digest's last line depends on it.
2. **Open the run.** The moment: `date -u "+%Y-%m-%d %H:%M"`. Then
   `start_change_set(projectKey, routineId, summary: "<routine name>, fired <moment> UTC")`. The moment
   in the summary is what keeps two firings two runs: the same summary on the same routine is read as
   the same request, and would hand back last week's change set.
3. **Follow the instructions**, in their order, inside that change set. When they name a skill, use it
   and hand it the project key and the change set's id — and, to `fuseki-distiller`, the previous
   firing you kept in step 1, as the moment its window starts. The skill you hand the change set to
   works inside it and never completes it; you do.
4. **Complete it.** `complete_change_set(changeSetId, outcome: Completed, summary: <the digest>)` — the
   digest the skill handed back, or your own when the instructions named none: counts first, then what
   was written, then what needs a person. When the work could not be done — a refusal stopped it, or
   the instructions point at something that does not exist — `outcome: Failed` with the `reason`
   instead. Either way the person reads it as the run report in their inbox and on the runs screen.

   **The digest's last line** is decided by two things only: the words that asked for the run, and
   the `isEnabled` you kept in step 1.

   | The run was asked for | `isEnabled` | The digest's last line |
   | --- | --- | --- |
   | in the firing prompt's words: `run the routine "<name>" on the project "<key>"` | false | exactly: "This routine is switched off on the server and this machine still fires it; switch it off here with fuseki-routines." |
   | in the firing prompt's words | true | nothing added |
   | in any other words: "run it now", "run the Weekly linker now" | either | nothing added |

   The firing prompt is what this machine's entry types, and nothing tells a scheduled firing from
   the same words typed by a person: **those words are a firing, whoever typed them.** Never write
   that a run was run by hand, started by a person or fired by the schedule, and never add a line
   about the routine being on or off other than the one above.
5. **Answer** with the digest, and the change set's id.

**Nobody is asked anything during a run.** A scheduled firing has nobody at the window, and a run by
hand is the same run: whatever needs a person — a possible duplicate, a contradiction, a word nobody
could choose — goes into the digest, and the run goes on. A routine that is switched off on the
server is still run.

A change set left running is ended by the server as failed after two hours without activity, so a
run is always completed before you stop, with the outcome it earned.

## Reading a refusal

- `CONFLICT` saying only a person can change a routine — a routine change was attempted through a
  tool; none exists here, and the person makes it on the Routines tab.
- `NOT_FOUND` or `CONFLICT` on `get_routine` — no such routine on this project; `list_routines` again
  and use the id it answers.
- `CONFLICT` naming the change set — it was completed, cancelled or failed by the server. Nothing was
  written. Open a new run with a new moment in its summary.
- `schedule add` refusing the zone, the line or a second entry — the message says what to change; a
  second entry is removed with `schedule remove` first.
- `schedule add` refusing for a missing or unreadable `.fuseki/state.json` — run `the fuseki skill`
  in this repository first; a file the tool cannot read is the person's to fix.
- `FORBIDDEN` — the person's role cannot read the project's routines or write its work; say so and
  stop.

## Rules that are easy to get wrong

- **Both places or neither.** On: the server (the person), then the machine (you). Off: the machine,
  then the server.
- **Nobody switches on what they have not read.** `get_routine` shown whole, and one yes, always.
- **Never change a routine yourself.** No tool does it, and none should: send the person to the
  Routines tab with its link.
- **Never guess the zone.** The entry is read on this machine's clock; a routine in another zone is
  changed on the tab, or not installed here.
- **The server never fires anything.** A routine that is on and has no entry here is silent.
- **A run is the routine's run** — it names the routine, its summary carries the moment, and it is
  completed by you with the digest, never left open and never completed by the skill you handed it to.
