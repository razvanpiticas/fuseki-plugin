import { readState, readTemplate, writeStateWhenChanged } from "./state-document.mjs"

/**
 * `fuseki activity record` — where this repository's work stands, kept short in `.fuseki/state.json`.
 *
 * <p>The `activity` key holds the epic and the feature being worked on, the last few runs of the plan
 * skills and `map-story`, each as one short note, and the last few stories built. It is a pointer, not
 * a log: the front door reads the rest live from the server. This command is its only writer, so
 * the lists stay capped and every note stays short however a skill words it.</p>
 */

/** The command this module answers to, as `fuseki.mjs` dispatches it. */
export const ACTIVITY_COMMAND = "activity"

/** The key this module owns. `fuseki state set` refuses to write it. */
export const ACTIVITY_KEY = "activity"

/** The one action. */
const RECORD_ACTION = "record"

/** The usage line, as the refusals quote it. */
const USAGE = 'fuseki activity record --skill <skill> --item <reference code> --note "<text>" [--epic <code>] [--feature <code>]'

/** How many runs `recent` keeps, newest first. */
export const RECENT_LIMIT = 3

/** How many built stories `implemented` keeps, newest first. */
export const IMPLEMENTED_LIMIT = 3

/** The longest note, in characters: one line a person reads at a glance. */
export const NOTE_MAX_LENGTH = 120

/** A work item's reference code: the project's key, a hyphen, the number. */
const REFERENCE_CODE_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]+$/

/**
 * The skills that record, and what each says about the pointers. `item` names the pointer the
 * recorded item itself becomes, `clears` the pointers its run makes stale, `takes` the flags it may
 * pass, and `implements` whether its item is a story that was just built.
 */
export const RECORDING_SKILLS = Object.freeze({
  "plan-epic": Object.freeze({ item: "epic", clears: Object.freeze(["feature"]), takes: Object.freeze([]), implements: false }),
  "plan-feature": Object.freeze({ item: "feature", clears: Object.freeze([]), takes: Object.freeze(["epic"]), implements: false }),
  "plan-story": Object.freeze({ item: null, clears: Object.freeze([]), takes: Object.freeze(["epic", "feature"]), implements: false }),
  "map-story": Object.freeze({ item: null, clears: Object.freeze([]), takes: Object.freeze(["epic", "feature"]), implements: true }),
})

/** Every flag, with the request key it fills and whether `record` needs it. */
const FLAGS = Object.freeze({
  "--skill": { key: "skill", required: true },
  "--item": { key: "item", required: true },
  "--note": { key: "note", required: true },
  "--epic": { key: "epic", required: false },
  "--feature": { key: "feature", required: false },
})

/**
 * Runs one `activity` call.
 *
 * @param {string[]} argv everything after the word `activity`
 * @param {{repositoryDirectory: string, bundledDirectory: string, now: Date}} context
 * @returns {string[]} the lines to print
 */
export const runActivity = (argv, context) => {
  if (argv[0] !== RECORD_ACTION) throw new Error(`activity does not know the action "${argv[0] ?? ""}". It takes one: ${USAGE}.`)

  return recordActivity(context, parseArguments(argv.slice(1)))
}

/**
 * Records one run: the note at the head of `recent`, the pointers the skill moves, and a built story
 * at the head of `implemented`. A second record of the same skill on the same item replaces the first.
 */
export const recordActivity = ({ repositoryDirectory, bundledDirectory, now }, request) => {
  if (!(now instanceof Date)) throw new Error("recordActivity requires the moment of the run.")

  const skill = RECORDING_SKILLS[request.skill]
  const before = readState(repositoryDirectory, readTemplate(bundledDirectory))
  const document = structuredClone(before)
  const activity = document[ACTIVITY_KEY]

  if (skill.item !== null) activity[skill.item] = request.item
  for (const pointer of skill.clears) activity[pointer] = ""
  for (const pointer of skill.takes) {
    if (request[pointer] !== undefined) activity[pointer] = request[pointer]
  }

  const entry = { atUtc: now.toISOString(), skill: request.skill, item: request.item, note: request.note }
  activity.recent = [entry, ...activity.recent.filter((earlier) => earlier.skill !== entry.skill || earlier.item !== entry.item)].slice(0, RECENT_LIMIT)

  if (skill.implements) activity.implemented = [request.item, ...activity.implemented.filter((code) => code !== request.item)].slice(0, IMPLEMENTED_LIMIT)

  writeStateWhenChanged(repositoryDirectory, before, document)

  const pointers = [activity.epic === "" ? "no epic" : `epic ${activity.epic}`, activity.feature === "" ? "no feature" : `feature ${activity.feature}`]

  return [`Recorded ${request.skill} on ${request.item}.`, `Working on ${pointers.join(", ")}.`]
}

/**
 * Moves an older file's `planning` key into `activity`: the epic and the feature it named become the
 * pointers, and the story is dropped, because a plan is not a sign the story was built. Only
 * `fuseki state init` calls it, before it fills the keys the file lacks.
 *
 * @returns {string[]} the line saying what moved, or nothing when the file has no `planning`
 */
export const carryRetiredPlanning = (document) => {
  if (!Object.hasOwn(document, "planning")) return []

  const { planning } = document
  const epic = planning?.lastEpic ?? ""
  const feature = planning?.lastFeature ?? ""
  if (typeof epic !== "string" || typeof feature !== "string") {
    throw new Error("planning.lastEpic and planning.lastFeature must be strings. The file is never replaced: fix it by hand, then run fuseki state init again.")
  }

  if (!Object.hasOwn(document, ACTIVITY_KEY)) document[ACTIVITY_KEY] = { epic, feature, recent: [], implemented: [] }
  delete document.planning

  return [`Moved planning into ${ACTIVITY_KEY}: epic "${epic}", feature "${feature}".`]
}

/** Reads the flags of one `record` call, and refuses anything it cannot record. */
const parseArguments = (argv) => {
  const request = {}

  for (let index = 0; index < argv.length; index += 1) {
    const flag = FLAGS[argv[index]]
    if (flag === undefined) throw new Error(`activity record does not know the flag "${argv[index]}". ${USAGE}.`)

    const value = argv[index + 1]
    if (value === undefined || value.startsWith("--")) throw new Error(`${argv[index]} needs a value.`)
    if (Object.hasOwn(request, flag.key)) throw new Error(`${argv[index]} is given twice.`)

    request[flag.key] = value
    index += 1
  }

  for (const [name, { key, required }] of Object.entries(FLAGS)) {
    if (required && request[key] === undefined) throw new Error(`activity record needs ${name}. ${USAGE}.`)
  }

  const skill = RECORDING_SKILLS[request.skill]
  if (skill === undefined) throw new Error(`"${request.skill}" does not record activity. Only ${Object.keys(RECORDING_SKILLS).join(", ")} do.`)

  requireReferenceCode("--item", request.item)
  for (const pointer of ["epic", "feature"]) {
    if (request[pointer] === undefined) continue
    if (!skill.takes.includes(pointer)) throw new Error(`${request.skill} sets the ${pointer} itself, so it takes no --${pointer}.`)
    requireReferenceCode(`--${pointer}`, request[pointer])
  }

  request.note = request.note.trim()
  if (request.note.length === 0) throw new Error("--note needs a sentence saying what the run did.")
  if (request.note.includes("\n")) throw new Error("--note is one line.")
  if (request.note.length > NOTE_MAX_LENGTH) throw new Error(`--note is ${request.note.length} characters; it takes at most ${NOTE_MAX_LENGTH}. Say less.`)

  return request
}

const requireReferenceCode = (flag, value) => {
  if (!REFERENCE_CODE_PATTERN.test(value)) throw new Error(`${flag} takes a reference code such as FUS-12, and "${value}" is not one.`)
}
