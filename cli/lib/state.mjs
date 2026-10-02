import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { readBundledVersion } from "./bundled.mjs"
import { answeredYes } from "./run-program.mjs"
import {
  ENV_FILE_LABEL,
  OPEN_MAP_ENTRY_SHAPES,
  STATE_DIRECTORY_NAME,
  STATE_FILE_LABEL,
  fillMissingKeys,
  readState,
  readStateUnchecked,
  readTemplate,
  requireConformance,
  shapeAt,
  splitKeyPath,
  statePathOf,
  valueAt,
  writeStateWhenChanged,
} from "./state-document.mjs"

/**
 * `fuseki state` — creates, reads, writes and reconciles `.fuseki/state.json`.
 *
 * <p>The front door runs `init` and `reconcile` on every run, and every skill writes its own key
 * through `set`. Nothing else writes the file (D15). Each action answers the lines it prints, so
 * what a person reads is what the tests read.</p>
 */

/** The command this module answers to, as `fuseki.mjs` dispatches it. */
export const STATE_COMMAND = "state"

/** What `state` can be asked to do, with the arguments each takes. */
export const STATE_ACTIONS = Object.freeze({
  init: { usage: "fuseki state init", argumentCount: 0 },
  get: { usage: "fuseki state get <key path>", argumentCount: 1 },
  set: { usage: "fuseki state set <key path> <json>", argumentCount: 2 },
  reconcile: { usage: "fuseki state reconcile", argumentCount: 0 },
})

/** The line `.gitignore` must carry, so nothing under `.fuseki/` is ever committed. */
export const GITIGNORE_LINE = `${STATE_DIRECTORY_NAME}/`

const GITIGNORE_FILE_NAME = ".gitignore"

/** `git check-ignore` exits 1 for a path that is not ignored; any other failure is git's own. */
const NOT_IGNORED_STATUS = 1

/** Keys that record one file or directory, cleared when it is gone. */
const RECORDED_PATH_KEYS = Object.freeze([
  "docsRoot",
  "productVision.path",
  "codingStandards.path",
  "wiki.systemWide.architecture",
  "wiki.systemWide.structure",
  "wiki.systemWide.testing",
  "wiki.systemWide.otherDocs",
  "uiTesting.envFile",
  "repository.cicd.workflows",
])

/** The open map whose entries record paths, and the keys of an entry that do. */
const SUBSYSTEMS_KEY = "wiki.subsystems"
const SUBSYSTEM_PATH_KEYS = Object.freeze(Object.keys(OPEN_MAP_ENTRY_SHAPES[SUBSYSTEMS_KEY]))

/** The keys found filled in the env file: a fact about the file, so it goes when the file does. */
const ENV_KEYS_PRESENT_KEY = "uiTesting.envKeysPresent"

/**
 * Runs one `state` call.
 *
 * @param {string[]} argv everything after the word `state`
 * @param {{repositoryDirectory: string, bundledDirectory: string, run: function}} context
 * @returns {string[]} the lines to print
 */
export const runState = (argv, context) => {
  const action = STATE_ACTIONS[argv[0]]
  if (action === undefined) {
    throw new Error(`state does not know the action "${argv[0] ?? ""}". It is one of: ${Object.values(STATE_ACTIONS).map((known) => known.usage).join(" | ")}.`)
  }

  const args = argv.slice(1)
  if (args.length !== action.argumentCount) throw new Error(`${action.usage} takes ${action.argumentCount} argument(s), and ${args.length} were given.`)

  if (argv[0] === "init") return initState(context)
  if (argv[0] === "get") return getState(context, args[0])
  if (argv[0] === "set") return setState(context, args[0], args[1])

  return reconcileState(context)
}

/**
 * Makes sure the repository has a state file that git ignores, and that it carries every key.
 *
 * In this order, so a repository where `.fuseki/.env` would be committed gets nothing written into
 * `.fuseki/` at all: `.gitignore` gains `.fuseki/` when it lacks it; git, when this is a git
 * repository, is asked whether `.fuseki/.env` is ignored, and a no stops here; then the file is
 * copied from the template when missing, or given the template's keys it lacks; and the plugin's
 * version is recorded.
 */
export const initState = ({ repositoryDirectory, bundledDirectory, run }) => {
  const lines = [ensureGitignored(repositoryDirectory), confirmEnvIgnored(repositoryDirectory, run)]

  const template = readTemplate(bundledDirectory)
  const version = readBundledVersion(bundledDirectory)
  const existed = existsSync(statePathOf(repositoryDirectory))

  const before = existed ? readStateUnchecked(repositoryDirectory) : null
  const document = existed ? structuredClone(before) : structuredClone(template)
  const added = existed ? fillMissingKeys(template, document) : []

  requireConformance(template, document, "")

  if (!existed) lines.push(`Created ${STATE_FILE_LABEL} from the template.`)
  else if (added.length > 0) lines.push(`Added to ${STATE_FILE_LABEL} the keys it lacked: ${added.join(", ")}.`)
  else lines.push(`${STATE_FILE_LABEL} carries every key.`)

  if (document.plugin.version !== version) {
    document.plugin.version = version
    lines.push(`Recorded plugin version ${version}.`)
  }

  writeStateWhenChanged(repositoryDirectory, before, document)

  return lines
}

/** Prints the value at a key path as JSON. */
export const getState = ({ repositoryDirectory, bundledDirectory }, keyPath) => {
  const segments = splitKeyPath(keyPath)
  const document = readState(repositoryDirectory, readTemplate(bundledDirectory))
  const { found, value } = valueAt(document, segments)

  if (!found) throw new Error(`${STATE_FILE_LABEL} has no value at "${keyPath}".`)

  return JSON.stringify(value, null, 2).split("\n")
}

/**
 * Writes one key, holding the value to the shape the template gives it, and writes the whole file in
 * one step.
 */
export const setState = ({ repositoryDirectory, bundledDirectory }, keyPath, json) => {
  const segments = splitKeyPath(keyPath)
  const template = readTemplate(bundledDirectory)
  const before = readState(repositoryDirectory, template)

  let value
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw new Error(`The value for ${keyPath} is not JSON: ${error.message}. Pass it as one argument, quoted for the shell.`)
  }

  requireConformance(shapeAt(template, segments), value, keyPath)

  const document = structuredClone(before)
  const parent = valueAt(document, segments.slice(0, -1))
  if (!parent.found) throw new Error(`${STATE_FILE_LABEL} has nothing at "${segments.slice(0, -1).join(".")}" to set ${keyPath} in. Set that whole entry instead.`)

  parent.value[segments.at(-1)] = value

  return [writeStateWhenChanged(repositoryDirectory, before, document) ? `Set ${keyPath}.` : `${keyPath} already holds that value.`]
}

/**
 * Clears every recorded path whose file or directory is gone, and says what it cleared.
 *
 * The files on disk win over the state: a path is the record of a file a skill wrote, and a record of
 * a file nobody can open is a wrong answer waiting to be read.
 */
export const reconcileState = ({ repositoryDirectory, bundledDirectory }) => {
  const before = readState(repositoryDirectory, readTemplate(bundledDirectory))
  const document = structuredClone(before)
  const cleared = []

  for (const keyPath of RECORDED_PATH_KEYS) clearGonePaths(document, splitKeyPath(keyPath), repositoryDirectory, cleared)

  const subsystems = valueAt(document, splitKeyPath(SUBSYSTEMS_KEY)).value
  for (const name of Object.keys(subsystems)) {
    for (const key of SUBSYSTEM_PATH_KEYS) clearGonePaths(document, [...splitKeyPath(SUBSYSTEMS_KEY), name, key], repositoryDirectory, cleared)
  }

  if (document.uiTesting.envFile === "" && document.uiTesting.envKeysPresent.length > 0) {
    document.uiTesting.envKeysPresent = []
    cleared.push(`${ENV_KEYS_PRESENT_KEY} (the file it was read from is gone)`)
  }

  writeStateWhenChanged(repositoryDirectory, before, document)

  if (cleared.length === 0) return ["Nothing to clear: every recorded path exists."]

  return cleared.map((entry) => `Cleared ${entry}.`)
}

/** Clears one key's path, or the gone entries of one key's list of paths. */
const clearGonePaths = (document, segments, repositoryDirectory, cleared) => {
  const keyPath = segments.join(".")
  const parent = valueAt(document, segments.slice(0, -1)).value
  const key = segments.at(-1)
  const recorded = parent[key]

  if (Array.isArray(recorded)) {
    const gone = recorded.filter((path) => !existsSync(resolve(repositoryDirectory, path)))
    if (gone.length === 0) return

    parent[key] = recorded.filter((path) => !gone.includes(path))
    for (const path of gone) cleared.push(`${path} from ${keyPath} (it is gone)`)

    return
  }

  if (recorded === "" || existsSync(resolve(repositoryDirectory, recorded))) return

  parent[key] = ""
  cleared.push(`${keyPath} (${recorded} is gone)`)
}

/** Adds `.fuseki/` to `.gitignore`, creating the file when it is missing and never adding it twice. */
const ensureGitignored = (repositoryDirectory) => {
  const path = join(repositoryDirectory, GITIGNORE_FILE_NAME)

  if (!existsSync(path)) {
    writeFileSync(path, `${GITIGNORE_LINE}\n`, "utf8")

    return `Created ${GITIGNORE_FILE_NAME} with ${GITIGNORE_LINE}.`
  }

  const contents = readFileSync(path, "utf8")
  if (contents.split(/\r?\n/).some((line) => line.trim() === GITIGNORE_LINE)) return `${GITIGNORE_FILE_NAME} already carries ${GITIGNORE_LINE}.`

  const lineEnding = contents.includes("\r\n") ? "\r\n" : "\n"
  const separator = contents.length === 0 || contents.endsWith("\n") ? "" : lineEnding
  writeFileSync(path, `${contents}${separator}${GITIGNORE_LINE}${lineEnding}`, "utf8")

  return `Added ${GITIGNORE_LINE} to ${GITIGNORE_FILE_NAME}.`
}

/**
 * Asks git whether `.fuseki/.env` is ignored, and stops when it is not.
 *
 * A later rule such as `!.fuseki/.env` un-ignores it in spite of the line, and the file holds a test
 * account's password. Outside a git repository there is nothing to commit it to, so nothing is asked.
 */
const confirmEnvIgnored = (repositoryDirectory, run) => {
  const insideWorkTree = run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repositoryDirectory })
  if (!answeredYes(insideWorkTree) || insideWorkTree.stdout.trim() !== "true") {
    return `No git repository here, so git was not asked whether ${ENV_FILE_LABEL} is ignored.`
  }

  const ignored = run("git", ["check-ignore", "-q", ENV_FILE_LABEL], { cwd: repositoryDirectory })
  if (answeredYes(ignored)) return `git ignores ${ENV_FILE_LABEL}.`

  if (ignored.started && ignored.status === NOT_IGNORED_STATUS) {
    throw new Error(`git does not ignore ${ENV_FILE_LABEL}, although ${GITIGNORE_FILE_NAME} carries ${GITIGNORE_LINE}: a later rule un-ignores it (git check-ignore -v --no-index ${ENV_FILE_LABEL} names it). Nothing was written into ${STATE_DIRECTORY_NAME}/. Remove that rule, then run fuseki state init again.`)
  }

  throw new Error(`git check-ignore could not answer whether ${ENV_FILE_LABEL} is ignored: ${ignored.stderr.trim()}`)
}
