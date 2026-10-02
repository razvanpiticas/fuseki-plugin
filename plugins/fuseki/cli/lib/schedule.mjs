import { existsSync } from "node:fs"

import {
  addCronEntry,
  listCronEntries,
  quoteForShell,
  removeCronEntry,
} from "./schedule-cron.mjs"
import {
  addTasks,
  listTasks,
  quoteForCommandPrompt,
  removeTasks,
} from "./schedule-task-scheduler.mjs"
import { bundledDirectoryOfThisTool } from "./bundled.mjs"
import { readState, readTemplate, statePathOf, writeStateWhenChanged } from "./state-document.mjs"

/**
 * `fuseki schedule` — the half of switching a routine on that lives on this machine.
 *
 * <p>A routine is a row on the Fuseki server: a name, a five-field cron line, the zone it is read
 * in and the instructions its run follows. <b>The server never fires one.</b> This machine does,
 * and only if an entry for it exists in a scheduler here. So switching a routine on is two writes,
 * and this command is the second: it installs one entry that starts the harness non-interactively
 * in the project's own directory with the prompt the skill composed (D12), and records the entry
 * under `routines.<routine id>` in that directory's `.fuseki/state.json`. Removing the entry takes
 * the record away with it.</p>
 *
 * <p>Three things it refuses rather than guesses, each because guessing produces a routine that
 * fires at a time nobody chose or does not fire at all: a harness with no verified way of running
 * one prompt on its own, a zone that is not this machine's, and a cron line the machine's own
 * scheduler cannot express.</p>
 */

/** The command this module answers to, as `fuseki.mjs` dispatches it. */
export const SCHEDULE_COMMAND = "schedule"

/** What `schedule` can be asked to do. */
export const ACTIONS = Object.freeze({ ADD: "add", REMOVE: "remove", LIST: "list" })

/**
 * The harnesses that have a documented way of running one prompt with nobody watching.
 *
 * <p>Two, and every other harness is refused by name. The plugin's own rule is that a value not
 * verified against that harness's own documentation does not belong in the build, and a command
 * that starts the wrong thing at two in the morning is the worst possible place to break it.</p>
 */
export const HARNESSES = Object.freeze({
  "claude-code": {
    displayName: "Claude Code",
    program: "claude",
    // Verified against Claude Code's headless documentation, "Start faster with bare mode": without
    // --bare a -p session loads the same context an interactive one would — the project's plugins,
    // its skills, the servers in its .mcp.json and the OAuth credentials the interactive session
    // cached — while --bare "never reads OAuth credentials". "--permission-mode auto
    // --permission-prompts none" is that document's own pair for "when nobody is available to
    // answer permission prompts, for example in a scheduled job".
    buildArguments: (prompt, quote) => `-p ${quote(prompt)} --permission-mode auto --permission-prompts none`,
  },
  codex: {
    displayName: "Codex",
    program: "codex",
    // Verified against OpenAI Codex's non-interactive-mode documentation: `codex exec "<prompt>"`
    // runs one task and exits, `--sandbox workspace-write` is what new scripts use, `--full-auto` is
    // a deprecated compatibility flag, and authentication reuses the CLI credentials saved on this
    // machine. Whether those credentials reach a run nobody started by hand is proved by running the
    // routine once by hand, not promised here.
    buildArguments: (prompt, quote) => `exec ${quote(prompt)} --sandbox workspace-write`,
  },
})

/** Every flag, with the actions that require it. */
const FLAGS = Object.freeze({
  "--harness": { key: "harness", requiredBy: [ACTIONS.ADD] },
  "--routine": { key: "routineId", requiredBy: [ACTIONS.ADD, ACTIONS.REMOVE] },
  "--name": { key: "name", requiredBy: [ACTIONS.ADD] },
  "--cron": { key: "cron", requiredBy: [ACTIONS.ADD] },
  "--zone": { key: "zone", requiredBy: [ACTIONS.ADD] },
  "--project-dir": { key: "projectDirectory", requiredBy: [ACTIONS.ADD] },
  "--prompt": { key: "prompt", requiredBy: [ACTIONS.ADD] },
})

/** The five fields of a cron line, in the order they are written, with the numbers each takes. */
const CRON_FIELDS = Object.freeze([
  { name: "minute", key: "minute", min: 0, max: 59 },
  { name: "hour", key: "hour", min: 0, max: 23 },
  { name: "day-of-month", key: "dayOfMonth", min: 1, max: 31 },
  { name: "month", key: "month", min: 1, max: 12 },
  // Sunday is zero and Saturday is six. Seven is not a second spelling of Sunday: the server's own
  // CronSchedule refuses it, because harnesses disagree about it, and a line this command accepted
  // and the server refused would be an entry pointing at a routine nobody could save.
  { name: "day-of-week", key: "dayOfWeek", min: 0, max: 6 },
])

/** The smallest step that means anything, as the server's grammar has it. */
const STEP_MIN = 2

/** How far ahead the next fire time is looked for before the line is called unreachable. */
const SEARCH_DAYS = 366 * 8

/** The platform whose scheduler is Task Scheduler rather than cron. */
const WINDOWS = "win32"

/**
 * Reads the arguments of one `schedule` call, and refuses anything it cannot act on.
 *
 * @param {string[]} argv everything after the word `schedule`
 * @returns {{action: string, harness: string|undefined, routineId: string|undefined, name: string|undefined, cron: string|undefined, zone: string|undefined, projectDirectory: string|undefined, prompt: string|undefined}}
 * @throws when the action is unknown, a flag is unknown, a flag carries no value, a required flag is
 *         missing, or the harness has no verified non-interactive command
 */
export const parseArguments = (argv) => {
  if (!Array.isArray(argv)) throw new Error("parseArguments requires the arguments after the word schedule.")

  const action = argv[0]
  if (!Object.values(ACTIONS).includes(action)) {
    throw new Error(`schedule does not know the action "${action ?? ""}". It is one of ${Object.values(ACTIONS).join(", ")}.`)
  }

  const request = { action }

  for (let index = 1; index < argv.length; index += 1) {
    const flag = FLAGS[argv[index]]
    if (!flag) throw new Error(`schedule does not know the flag "${argv[index]}". It takes ${Object.keys(FLAGS).join(", ")}.`)

    const value = argv[index + 1]
    if (value === undefined || value.startsWith("--")) throw new Error(`${argv[index]} needs a value.`)

    request[flag.key] = value
    index += 1
  }

  for (const [flag, { key, requiredBy }] of Object.entries(FLAGS)) {
    if (requiredBy.includes(action) && !request[key]) throw new Error(`schedule ${action} needs ${flag}.`)
  }

  if (request.harness !== undefined && !HARNESSES[request.harness]) {
    throw new Error(`"${request.harness}" has no verified non-interactive command, so nothing can be installed for it. Only ${Object.keys(HARNESSES).join(" and ")} do. Print the schedule line and the prompt and install it yourself.`)
  }

  return request
}

/**
 * Reads a five-field cron line into the values each field names.
 *
 * The grammar is the server's own (`CronSchedule`): five fields, each a number, `*`, a list, a
 * range, or a step on `*` or a range. Names, seconds and the `@` shortcuts are out, because a line
 * this command accepted and the server refused would install an entry for a routine nobody could
 * save.
 *
 * @param {string} line the line as the routine carries it
 * @returns {{raw: string, fields: Array<{name: string, raw: string, values: number[], isEvery: boolean, hasStep: boolean}>, minute: object, hour: object, dayOfMonth: object, month: object, dayOfWeek: object}}
 * @throws when the line is not five fields, or a field says something no scheduler reads
 */
export const parseCronLine = (line) => {
  if (typeof line !== "string" || line.trim().length === 0) {
    throw new Error("A cron line is required and none was given. It is five fields — minute hour day-of-month month day-of-week — such as '0 8,16 * * *'.")
  }

  const raw = line.trim().replace(/\s+/g, " ")
  const written = raw.split(" ")

  if (written.length !== CRON_FIELDS.length) {
    throw new Error(`The cron line '${raw}' has ${written.length} field(s) and a cron line has ${CRON_FIELDS.length}: minute, hour, day-of-month, month, day-of-week. Seconds, names and the @ shortcuts are not read here.`)
  }

  const parsed = { raw, fields: [] }

  CRON_FIELDS.forEach((field, index) => {
    const read = parseField(field, written[index], raw)
    parsed.fields.push(read)
    parsed[field.key] = read
  })

  return parsed
}

/**
 * The next time a line fires, read in the clock of whoever calls this.
 *
 * Local time throughout, because `add` refuses a zone that is not the machine's: the line is read by
 * cron or by Task Scheduler against this machine's own clock, so the answer has to be computed
 * against the same one.
 *
 * @param {object} cronLine as `parseCronLine` returned it
 * @param {Date} now the moment to look forward from
 * @returns {Date} the first minute at or after `now` that the line names
 * @throws when the line names no minute within the next eight years
 */
export const nextFireTime = (cronLine, now) => {
  if (!cronLine) throw new Error("nextFireTime requires a parsed cron line.")
  if (!(now instanceof Date)) throw new Error("nextFireTime requires the moment to look forward from.")

  const from = new Date(now.getTime())
  from.setSeconds(0, 0)
  from.setMinutes(from.getMinutes() + 1)

  for (let offset = 0; offset <= SEARCH_DAYS; offset += 1) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset)
    if (!dayMatches(cronLine, day)) continue

    for (const hour of cronLine.hour.values) {
      for (const minute of cronLine.minute.values) {
        const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
        if (candidate >= from) return candidate
      }
    }
  }

  throw new Error(`The cron line '${cronLine.raw}' names no time within the next eight years, so nothing would ever fire.`)
}

/**
 * Refuses a routine whose zone is not the one this machine reads its clock in.
 *
 * Cron and Task Scheduler both read the machine's zone and neither takes one of its own, and a
 * five-field line cannot be moved between zones honestly — the offset between two zones changes
 * twice a year. So the routine's zone is changed on the server, or the entry is not installed.
 *
 * @param {string} zone the routine's zone, as the row carries it
 * @param {string} machineZone the zone this machine reads its clock in
 * @throws when they differ, naming both
 */
export const requireMachineZone = (zone, machineZone) => {
  if (!zone) throw new Error("The routine's zone is required and none was given.")
  if (!machineZone) throw new Error("This machine's own zone could not be read, so nothing can be checked against it.")

  if (zone !== machineZone) {
    throw new Error(`The routine is read in ${zone} and this machine reads its clock in ${machineZone}. Set the routine's zone to ${machineZone} on the project's Routines tab and install again, or install it on a machine in ${zone}.`)
  }
}

/** The zone this machine reads its clock in. */
export const machineTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * The command one scheduled entry runs: the harness, started on one prompt, with nobody watching.
 *
 * @param {string} harnessId one of HARNESSES
 * @param {string} prompt the prompt the skill composed
 * @param {function} quote how one argument is quoted for the shell the entry is read by
 * @returns {string} the command, ready to be written into a crontab line or a task's action
 */
export const buildHarnessCommand = (harnessId, prompt, quote) => {
  const harness = HARNESSES[harnessId]
  if (!harness) throw new Error(`"${harnessId}" has no verified non-interactive command. Only ${Object.keys(HARNESSES).join(" and ")} do.`)
  if (!prompt) throw new Error("A scheduled entry needs the prompt the harness is started on.")
  if (typeof quote !== "function") throw new Error("buildHarnessCommand requires the quoting this machine's scheduler reads.")

  return `${harness.program} ${harness.buildArguments(prompt, quote)}`
}

/**
 * Runs one `schedule` call and prints what it did.
 *
 * @param {string[]} argv everything after the word `schedule`
 * @param {object} [machine] the machine this is installing on — its platform, its zone, its clock,
 *        and, for the tests, the scheduler and the bundled template the state is held to
 */
export const runSchedule = (argv, machine = {}) => {
  const platform = machine.platform ?? process.platform
  const now = machine.now ?? new Date()
  const scheduler = machine.scheduler ?? (platform === WINDOWS ? WINDOWS_SCHEDULER : CRON_SCHEDULER)

  const request = parseArguments(argv)

  if (request.action === ACTIONS.LIST) return reportList(scheduler, request)

  const template = readTemplate(machine.bundledDirectory ?? bundledDirectoryOfThisTool())
  if (request.action === ACTIONS.REMOVE) return reportRemoval(scheduler, request, template)

  return reportInstall(scheduler, request, machine.zone ?? machineTimeZone(), now, template)
}

/** What each platform's scheduler is called and how it is written to. */
const CRON_SCHEDULER = Object.freeze({
  displayName: "crontab",
  quote: quoteForShell,
  add: addCronEntry,
  remove: removeCronEntry,
  list: listCronEntries,
})

const WINDOWS_SCHEDULER = Object.freeze({
  displayName: "Task Scheduler",
  quote: quoteForCommandPrompt,
  add: addTasks,
  remove: removeTasks,
  list: listTasks,
})

/**
 * Installs the entry and records it in the project's state.
 *
 * The state is read before anything is installed, so a project with no `.fuseki/state.json` — or
 * one that cannot be read — gets no entry that nothing records.
 */
const reportInstall = (scheduler, request, machineZone, now, template) => {
  requireMachineZone(request.zone, machineZone)

  const cronLine = parseCronLine(request.cron)
  const command = buildHarnessCommand(request.harness, request.prompt, scheduler.quote)
  const before = readState(request.projectDirectory, template)

  const written = [scheduler.add({ routineId: request.routineId, cronLine, projectDirectory: request.projectDirectory, command })].flat()

  const document = structuredClone(before)
  document.routines[request.routineId] = {
    name: request.name,
    installedAtUtc: now.toISOString(),
    harness: request.harness,
    entry: written.map((entry) => entry.installedAs).join("; "),
  }
  writeStateWhenChanged(request.projectDirectory, before, document)

  console.log(`Installed "${request.name}" in this machine's ${scheduler.displayName}, for ${HARNESSES[request.harness].displayName}.`)
  for (const entry of written) console.log(`  ${entry.installedAs}`)
  console.log(`  next fires ${formatMoment(nextFireTime(cronLine, now))} (${machineZone})`)
  console.log(`  recorded as routines.${request.routineId} in ${statePathOf(request.projectDirectory)}`)
}

/**
 * Removes the routine's entries, and the record of them from the state of every project they ran in.
 *
 * The project is read off the entries before they go, so `remove` needs nothing but the routine.
 */
const reportRemoval = (scheduler, request, template) => {
  const owned = scheduler.list({}).filter((entry) => entry.routineId === request.routineId)
  const projectDirectories = [...new Set(owned.map((entry) => entry.projectDirectory))]
  const { removed } = scheduler.remove({ routineId: request.routineId })

  if (removed.length === 0) {
    console.log(`Nothing installed here for routine ${request.routineId}.`)
    return
  }

  console.log(`Removed ${removed.length} entr${removed.length === 1 ? "y" : "ies"} from this machine's ${scheduler.displayName}:`)
  for (const entry of removed) console.log(`  ${entry}`)

  for (const projectDirectory of projectDirectories) {
    if (projectDirectory === "" || !existsSync(statePathOf(projectDirectory))) continue

    const before = readState(projectDirectory, template)
    if (!Object.hasOwn(before.routines, request.routineId)) continue

    const document = structuredClone(before)
    delete document.routines[request.routineId]
    writeStateWhenChanged(projectDirectory, before, document)
    console.log(`  removed routines.${request.routineId} from ${statePathOf(projectDirectory)}`)
  }
}

const reportList = (scheduler, request) => {
  const entries = scheduler
    .list({})
    .filter((entry) => request.projectDirectory === undefined || entry.projectDirectory === request.projectDirectory)

  if (entries.length === 0) {
    console.log(`Nothing installed in this machine's ${scheduler.displayName}.`)
    return
  }

  for (const entry of entries) {
    console.log(`${entry.routineId}  ${harnessOf(entry.command)}  ${entry.cronLine ?? entry.line}  ${entry.projectDirectory}  ${entry.command}`)
  }
}

/** Which harness an installed entry starts, read back from the command it runs. */
const harnessOf = (command) => {
  const program = command.trim().split(/\s+/)[0]
  const found = Object.entries(HARNESSES).find(([, harness]) => harness.program === program)

  return found === undefined ? program : found[0]
}

/** One moment, written the way a person reads it back off a schedule. */
const formatMoment = (moment) =>
  `${moment.getFullYear()}-${twoDigits(moment.getMonth() + 1)}-${twoDigits(moment.getDate())} ${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`

const twoDigits = (value) => String(value).padStart(2, "0")

/** Whether a day of the calendar is one this line fires on. */
const dayMatches = (cronLine, day) => {
  const dayOfMonthRestricted = !cronLine.dayOfMonth.isEvery
  const dayOfWeekRestricted = !cronLine.dayOfWeek.isEvery
  const onDayOfMonth = cronLine.dayOfMonth.values.includes(day.getDate())
  const onDayOfWeek = cronLine.dayOfWeek.values.includes(day.getDay())

  // Cron's own rule: two restricted day fields are read as either, not as both. A line naming the
  // first of the month and Mondays fires on every first and on every Monday.
  if (dayOfMonthRestricted && dayOfWeekRestricted) return onDayOfMonth || onDayOfWeek
  if (dayOfMonthRestricted) return onDayOfMonth
  if (dayOfWeekRestricted) return onDayOfWeek

  return true
}

/** One field: a comma-separated list of terms, and a list of one term is the ordinary case. */
const parseField = (field, written, raw) => {
  const values = new Set()
  let hasStep = false

  for (const term of written.split(",")) {
    const read = parseTerm(field, term, written, raw)
    for (const value of read.values) values.add(value)
    hasStep = hasStep || read.hasStep
  }

  return {
    name: field.name,
    raw: written,
    values: [...values].sort((first, second) => first - second),
    isEvery: written === "*",
    hasStep,
  }
}

/** One term: `*`, a number, or a range, each of which may carry a step on it. */
const parseTerm = (field, term, written, raw) => {
  const parts = term.split("/")
  if (parts.length > 2) throw cronRefusal(field, written, raw)

  const step = parts.length === 2 ? readStep(field, parts[1], written, raw) : 1
  const base = parts[0]

  if (base === "*") return { values: everyNth(field.min, field.max, step), hasStep: parts.length === 2 }

  const range = base.split("-")
  if (range.length === 2) {
    const from = readNumber(field, range[0], written, raw)
    const to = readNumber(field, range[1], written, raw)
    if (from > to) throw cronRefusal(field, written, raw)

    return { values: everyNth(from, to, step), hasStep: parts.length === 2 }
  }

  // A number with a step — `5/15` — is refused with the rest: some schedulers read it as "from five
  // onwards" and others do not read it at all, and the server refuses it for the same reason.
  if (parts.length === 2) throw cronRefusal(field, written, raw)

  return { values: [readNumber(field, base, written, raw)], hasStep: false }
}

const readStep = (field, written, fieldText, raw) => {
  const step = Number(written)
  if (!/^\d+$/.test(written) || step < STEP_MIN || step > field.max) throw cronRefusal(field, fieldText, raw)

  return step
}

const readNumber = (field, written, fieldText, raw) => {
  const value = Number(written)
  if (!/^\d+$/.test(written) || value < field.min || value > field.max) throw cronRefusal(field, fieldText, raw)

  return value
}

const everyNth = (from, to, step) => {
  const values = []
  for (let value = from; value <= to; value += step) values.push(value)

  return values
}

const cronRefusal = (field, fieldText, raw) =>
  new Error(`The ${field.name} field of the cron line '${raw}' is '${fieldText}', which is not something a scheduler reads. It takes a number from ${field.min} to ${field.max}, '*' for every one of them, a list such as '${field.min},${field.max}', a range such as '${field.min}-${field.max}', or a step such as '*/${STEP_MIN}'. Names and the @ shortcuts are not read here.`)
