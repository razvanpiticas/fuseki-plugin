import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/**
 * The Task Scheduler entries that fire a routine on Windows.
 *
 * <p><b>Task Scheduler takes no cron line.</b> It takes a frequency and one time of day, so a line
 * with two hours in it is two tasks, and a line it cannot express at all is refused rather than
 * approximated. An approximation here would fire a routine at an hour nobody chose and nobody could
 * see, which is worse than not installing it.</p>
 *
 * <p><b>And it takes no long command either.</b> `/TR` is capped at 261 characters — the refusal is
 * `ERROR: Value for '/TR' option cannot be more than 261 character(s)`, met live on 2026-09-21 — and
 * a project path plus the prompt plus the flags is comfortably past it. So the task runs a
 * small script this command writes, one per routine, and `/TR` carries only its path. The script is
 * where the directory change and the harness command live, and `remove` deletes it with the tasks.</p>
 *
 * <p>`schtasks` and the script file are both reached through injected ports, so the conversion, the
 * refusals, the removal and the listing are all proved without creating a task or writing a file on
 * the machine running the suite.</p>
 */

/** What every task this command creates is named after, so its own work can be found again. */
const TASK_NAME_PREFIX = "Fuseki "

/** The root folder Task Scheduler reports every task name under. */
const ROOT_FOLDER = "\\"

/** The columns of `schtasks /Query /FO CSV /V` this code reads, by their heading. */
const TASK_NAME_COLUMN = "TaskName"
const TASK_TO_RUN_COLUMN = "Task To Run"
const SCHEDULE_TYPE_COLUMN = "Schedule Type"
const START_TIME_COLUMN = "Start Time"
const DAYS_COLUMN = "Days"

/** The days of the week Task Scheduler spells, Sunday first, as the cron field numbers them. */
const WEEKDAY_NAMES = Object.freeze(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"])

/** What a task fires as, in Task Scheduler's own words. */
const DAILY = "DAILY"
const WEEKLY = "WEEKLY"

/** How `schtasks /FO CSV` wraps a field, and what sits between two of them. */
const CSV_QUOTE = '"'
const CSV_SEPARATOR = '","'

/** The longest command Task Scheduler accepts for one task. Its own limit, and it says so. */
const TASK_TO_RUN_LIMIT = 261

/** Where this command keeps the script each routine's tasks run, and what it is called. */
const SCRIPT_DIRECTORY = ["Fuseki", "schedule"]
const SCRIPT_EXTENSION = ".cmd"

/** How a task's action reaches the script. */
const COMMAND_PROMPT = "cmd /c"

/** The line of the script that says where the harness starts. */
const DIRECTORY_CHANGE = "cd /d"

/** `schtasks` as the operating system holds it. */
export const systemSchtasks = (args) => execFileSync("schtasks", args, { encoding: "utf8" })

/** The script files as the operating system holds them, under this user's own application data. */
export const systemScriptFiles = Object.freeze({
  directory: () => join(process.env.LOCALAPPDATA ?? homedir(), ...SCRIPT_DIRECTORY),
  write: (path, contents) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, contents, "utf8")
  },
  read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : ""),
  remove: (path) => {
    if (existsSync(path)) rmSync(path)
  },
})

/**
 * Quotes one argument for `cmd`, which is what the script is parsed by.
 *
 * Double quotes with the inner ones escaped: `cmd` passes a backslash-escaped quote through to the
 * program it starts, whose own argument parsing turns it back into a quote. The prompt names
 * the routine and the project in quotes, so this is not a corner case.
 *
 * @param {string} text the argument as it should reach the program
 * @returns {string} the argument as it is written into the script
 */
export const quoteForCommandPrompt = (text) => '"' + text.replaceAll('"', '\\"') + '"'

/**
 * Turns one cron line into the tasks Task Scheduler can express, or refuses it.
 *
 * The rule, from Task Scheduler's own grammar: a task fires daily or on named weekdays, at one time
 * of day. So minutes and hours may be numbers or lists; day of week is every day or a list of days;
 * day of month and month have to be every one of them; and a step is not expressible at all.
 *
 * @param {object} cronLine as `parseCronLine` returned it
 * @returns {Array<{scheduleType: string, days: string[]|null, hour: number, minute: number}>}
 * @throws when the line says something Task Scheduler has no way of saying
 */
export const planTasks = (cronLine) => {
  if (!cronLine) throw new Error("planTasks requires a parsed cron line.")

  for (const field of cronLine.fields) {
    if (field.hasStep) {
      throw refusal(cronLine, `it steps the ${field.name} field, and a task fires at a time of day rather than every so often`)
    }
  }

  if (!cronLine.dayOfMonth.isEvery) throw refusal(cronLine, "it names days of the month, and a task fires daily or on weekdays")
  if (!cronLine.month.isEvery) throw refusal(cronLine, "it names months, and a task has no month")

  const days = cronLine.dayOfWeek.isEvery ? null : cronLine.dayOfWeek.values.map((day) => WEEKDAY_NAMES[day])

  const tasks = []
  for (const hour of cronLine.hour.values) {
    for (const minute of cronLine.minute.values) {
      tasks.push({ scheduleType: days === null ? DAILY : WEEKLY, days, hour, minute })
    }
  }

  return tasks
}

/**
 * Writes the routine's script and one task per time of day, and refuses when it already has one.
 *
 * @param {object} options
 * @param {string} options.routineId the routine the tasks belong to
 * @param {object} options.cronLine as `parseCronLine` returned it
 * @param {string} options.projectDirectory where the harness is started
 * @param {string} options.command the harness command, already quoted for `cmd`
 * @param {function} [options.run] the `schtasks` runner
 * @param {object} [options.files] where the script is written
 * @returns {Array<{routineId: string, taskName: string, line: string, projectDirectory: string, command: string, installedAs: string}>}
 */
export const addTasks = ({ routineId, cronLine, projectDirectory, command, run = systemSchtasks, files = systemScriptFiles }) => {
  requireRoutineId(routineId)
  if (!cronLine) throw new Error("A Task Scheduler entry needs the routine's cron line.")
  if (!projectDirectory) throw new Error("A Task Scheduler entry needs the project directory.")
  if (!command) throw new Error("A Task Scheduler entry needs the command to run.")

  const planned = planTasks(cronLine)

  if (listTasks({ routineId, run, files }).length > 0) {
    throw new Error(`This machine already carries a Task Scheduler entry for routine ${routineId}. Remove it first: fuseki schedule remove --routine ${routineId}.`)
  }

  const scriptPath = pathOfScript(routineId, files)
  const action = `${COMMAND_PROMPT} "${scriptPath}"`

  if (action.length > TASK_TO_RUN_LIMIT) {
    throw new Error(`Task Scheduler takes at most ${TASK_TO_RUN_LIMIT} characters for what a task runs, and the path of the script for routine ${routineId} makes ${action.length}. Nothing was installed.`)
  }

  files.write(scriptPath, buildScript(routineId, projectDirectory, command))

  return planned.map((task, index) => {
    const taskName = index === 0 ? `${TASK_NAME_PREFIX}${routineId}` : `${TASK_NAME_PREFIX}${routineId} ${index + 1}`
    const startTime = `${pad(task.hour)}:${pad(task.minute)}`
    const args = ["/Create", "/SC", task.scheduleType]

    if (task.days !== null) args.push("/D", task.days.join(","))
    args.push("/ST", startTime, "/TN", taskName, "/TR", action, "/F")

    run(args)

    return {
      routineId,
      taskName,
      line: task.days === null ? `${DAILY} ${startTime}` : `${WEEKLY} ${task.days.join(",")} ${startTime}`,
      projectDirectory,
      command,
      installedAs: `${taskName}: ${action} → ${DIRECTORY_CHANGE} "${projectDirectory}" && ${command}`,
    }
  })
}

/**
 * Deletes every task this routine owns and the script they ran, and says so when there were none.
 *
 * @returns {{removed: string[]}} the task names that were deleted
 */
export const removeTasks = ({ routineId, run = systemSchtasks, files = systemScriptFiles }) => {
  requireRoutineId(routineId)

  const removed = listTasks({ routineId, run, files }).map((task) => task.taskName)
  for (const taskName of removed) run(["/Delete", "/TN", taskName, "/F"])

  if (removed.length > 0) files.remove(pathOfScript(routineId, files))

  return { removed }
}

/**
 * Every task this command created, or the ones belonging to one routine.
 *
 * @param {object} [options]
 * @param {string} [options.routineId] narrow it to one routine
 * @param {function} [options.run] the `schtasks` runner
 * @param {object} [options.files] where the scripts are read from
 * @returns {Array<{routineId: string, taskName: string, line: string, projectDirectory: string, command: string, installedAs: string}>}
 */
export const listTasks = ({ routineId = null, run = systemSchtasks, files = systemScriptFiles } = {}) => {
  return readRows(run(["/Query", "/FO", "CSV", "/V"]))
    .map((row) => readTask(row, files))
    .filter((task) => task !== null)
    .filter((task) => routineId === null || task.routineId === routineId)
}

/** Where one routine's script lives. */
const pathOfScript = (routineId, files) => join(files.directory(), `${routineId}${SCRIPT_EXTENSION}`)

/**
 * The script one routine's tasks run.
 *
 * The directory is in plain quotes because a Windows path cannot contain one; the command was
 * already quoted for `cmd` by whoever built it.
 */
const buildScript = (routineId, projectDirectory, command) =>
  [
    "@echo off",
    `rem Written by fuseki schedule for routine ${routineId}.`,
    `rem Remove it with: fuseki schedule remove --routine ${routineId}`,
    `${DIRECTORY_CHANGE} "${projectDirectory}"`,
    command,
    "",
  ].join("\r\n")

const refusal = (cronLine, reason) =>
  new Error(`Task Scheduler cannot express '${cronLine.raw}': ${reason}. Simplify the line or run it by hand.`)

/** One task, read back out of its own name and the script it runs, or null when it is not ours. */
const readTask = (row, files) => {
  const name = (row[TASK_NAME_COLUMN] ?? "").replace(ROOT_FOLDER, "")
  if (!name.startsWith(TASK_NAME_PREFIX)) return null

  const action = row[TASK_TO_RUN_COLUMN] ?? ""
  const days = (row[DAYS_COLUMN] ?? "").trim()
  const scheduleType = (row[SCHEDULE_TYPE_COLUMN] ?? "").trim().toUpperCase()
  const startTime = (row[START_TIME_COLUMN] ?? "").trim()
  const routineId = name.slice(TASK_NAME_PREFIX.length).split(" ")[0]
  const script = readScript(files.read(pathOfScript(routineId, files)))

  return {
    routineId,
    taskName: name,
    line: scheduleType.startsWith(WEEKLY) ? `${WEEKLY} ${days} ${startTime}`.trim() : `${scheduleType} ${startTime}`.trim(),
    projectDirectory: script.projectDirectory,
    command: script.command,
    installedAs: `${name}: ${action}`,
  }
}

/** The directory change and the command out of one script, or empties when it is not there. */
const readScript = (contents) => {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("rem ") && line !== "@echo off")

  const directory = lines.find((line) => line.startsWith(DIRECTORY_CHANGE))
  if (directory === undefined) return { projectDirectory: "", command: "" }

  return {
    projectDirectory: directory.slice(DIRECTORY_CHANGE.length).trim().replace(/^"|"$/g, ""),
    command: lines.slice(lines.indexOf(directory) + 1).join(" "),
  }
}

/**
 * Reads `schtasks /FO CSV /V` into one object per task, keyed by the heading row.
 *
 * `schtasks` repeats the heading row once per task folder, so a row whose first value equals the
 * first heading is a heading and not a task.
 */
const readRows = (csv) => {
  const lines = csv
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  const headings = readSchtasksLine(lines[0])

  return lines
    .slice(1)
    .map((line) => readSchtasksLine(line))
    .filter((values) => values[0] !== headings[0])
    .map((values) => Object.fromEntries(headings.map((heading, index) => [heading, values[index] ?? ""])))
}

/**
 * One line of `schtasks /FO CSV`, split on the quote-comma-quote that separates two fields.
 *
 * <p><b>Not a general CSV read, deliberately.</b> `schtasks` does not escape a quote inside a
 * field, so a reader that toggles on every quote eats the ones a field carries of its own. Two
 * fields are always separated by `","`, and nothing this command writes contains that sequence.</p>
 */
const readSchtasksLine = (line) => {
  const trimmed = line.trim()
  const body = trimmed.startsWith(CSV_QUOTE) && trimmed.endsWith(CSV_QUOTE) ? trimmed.slice(1, -1) : trimmed

  return body.split(CSV_SEPARATOR)
}

const pad = (value) => String(value).padStart(2, "0")

const requireRoutineId = (routineId) => {
  if (!routineId) throw new Error("A Task Scheduler entry is found by the routine it belongs to, and no routine was named.")
}
