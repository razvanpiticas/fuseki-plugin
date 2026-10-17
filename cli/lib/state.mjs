import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { ACTIVITY_KEY, carryRetiredPlanning } from "./activity.mjs"
import { readBundledVersion } from "./bundled.mjs"
import { discoverDocuments } from "./discover.mjs"
import { answeredYes } from "./run-program.mjs"
import {
  ENV_FILE_LABEL,
  LOCAL_FILE_LABEL,
  OPEN_MAP_ENTRY_SHAPES,
  STATE_DIRECTORY_NAME,
  STATE_FILE_LABEL,
  fillMissingKeys,
  overlayLocalState,
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
 * `fuseki state` — creates, reads, writes and reconciles `.fuseki/state.json` and this machine's
 * `.fuseki/local.json`, as one document.
 *
 * <p>The front door runs `init`, `reconcile` and `discover` on every run, and every skill writes its own
 * key through `set`. Nothing else writes the files (D15). Each action answers the lines it prints, so
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
  discover: { usage: "fuseki state discover", argumentCount: 0 },
})

/**
 * The files git must never see: the test account's password, and this machine's keys. Each is also
 * the line `.gitignore` gains when git does not already ignore it. `.fuseki/state.json` is not one of
 * them: it is the repository's, and is committed.
 */
export const IGNORED_FILE_LABELS = Object.freeze([ENV_FILE_LABEL, LOCAL_FILE_LABEL])

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
  "wiki.systemWide.decisions",
  "wiki.systemWide.otherDocs",
  "discovery.ignored",
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
  if (argv[0] === "discover") return discoverDocuments(context)

  return reconcileState(context)
}

/**
 * Makes sure the repository has a state file carrying every key, and that git ignores the files
 * that must never be committed.
 *
 * In this order, so a repository where `.fuseki/.env` or `.fuseki/local.json` would be committed gets
 * nothing written into `.fuseki/` at all: each is made ignored, and a file git still does not ignore
 * stops here; then the state is copied from the template when missing, or given the template's keys
 * it lacks (an older `planning` key moved into `activity` first); the plugin's version is recorded;
 * and the document is written split, which moves the machine keys an older plugin kept in
 * `.fuseki/state.json` into `.fuseki/local.json`.
 */
export const initState = ({ repositoryDirectory, bundledDirectory, run }) => {
  const lines = ensureIgnored(repositoryDirectory, run)

  const template = readTemplate(bundledDirectory)
  const version = readBundledVersion(bundledDirectory)
  const existed = existsSync(statePathOf(repositoryDirectory))

  const document = existed ? readStateUnchecked(repositoryDirectory) : overlayLocalState(repositoryDirectory, structuredClone(template))
  const carried = existed ? carryRetiredPlanning(document) : []
  const added = existed ? fillMissingKeys(template, document) : []

  requireConformance(template, document, "")

  lines.push(...carried)
  if (!existed) lines.push(`Created ${STATE_FILE_LABEL} from the template.`)
  else if (added.length > 0) lines.push(`Added to ${STATE_FILE_LABEL} the keys it lacked: ${added.join(", ")}.`)
  else lines.push(`${STATE_FILE_LABEL} carries every key.`)

  if (document.plugin.version !== version) {
    document.plugin.version = version
    lines.push(`Recorded plugin version ${version}.`)
  }

  writeStateWhenChanged(repositoryDirectory, document)

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
  if (segments[0] === ACTIVITY_KEY) throw new Error(`${ACTIVITY_KEY} is written only by fuseki activity record, which keeps it short.`)

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

  return [writeStateWhenChanged(repositoryDirectory, document) ? `Set ${keyPath}.` : `${keyPath} already holds that value.`]
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

  writeStateWhenChanged(repositoryDirectory, document)

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

/**
 * Makes git ignore every file `IGNORED_FILE_LABELS` names, adding to `.gitignore` only the ones git
 * does not ignore already, so a repository's own rule — `.fuseki/*`, say — is respected and never
 * duplicated. Git is asked again after the line is added, because a rule in a deeper `.gitignore` can
 * still un-ignore the file, and a file git still does not ignore stops here.
 *
 * Outside a git repository there is nobody to ask and nothing to commit to, so the lines `.gitignore`
 * lacks are added for the day it becomes one.
 */
const ensureIgnored = (repositoryDirectory, run) => {
  const insideWorkTree = run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repositoryDirectory })
  if (!answeredYes(insideWorkTree) || insideWorkTree.stdout.trim() !== "true") {
    const lines = IGNORED_FILE_LABELS.filter((label) => !gitignoreCarries(repositoryDirectory, label)).map((label) => appendToGitignore(repositoryDirectory, label))

    return ["No git repository here, so git was not asked what it ignores.", ...lines]
  }

  const lines = []

  for (const label of IGNORED_FILE_LABELS) {
    if (gitIgnores(repositoryDirectory, run, label)) {
      lines.push(`git ignores ${label}.`)
      continue
    }

    lines.push(appendToGitignore(repositoryDirectory, label))

    if (!gitIgnores(repositoryDirectory, run, label)) {
      throw new Error(`git does not ignore ${label}, although ${GITIGNORE_FILE_NAME} now ends with it: a rule in a deeper .gitignore un-ignores it (git check-ignore -v --no-index ${label} names it). Nothing was written into ${STATE_DIRECTORY_NAME}/. Remove that rule, then run fuseki state init again.`)
    }
  }

  if (gitIgnores(repositoryDirectory, run, STATE_FILE_LABEL)) {
    lines.push(`git ignores ${STATE_FILE_LABEL}, so this repository's state is not committed. To share it, remove the rule that ignores it (git check-ignore -v --no-index ${STATE_FILE_LABEL} names it).`)
  }

  return lines
}

/** Whether git ignores a path; a failure that is not git's "not ignored" is git's own, and stops. */
const gitIgnores = (repositoryDirectory, run, label) => {
  const answer = run("git", ["check-ignore", "-q", label], { cwd: repositoryDirectory })
  if (answeredYes(answer)) return true
  if (answer.started && answer.status === NOT_IGNORED_STATUS) return false

  throw new Error(`git check-ignore could not answer whether ${label} is ignored: ${answer.stderr.trim()}`)
}

/** Whether `.gitignore` has a line that is exactly this one. */
const gitignoreCarries = (repositoryDirectory, line) => {
  const path = join(repositoryDirectory, GITIGNORE_FILE_NAME)

  return existsSync(path) && readFileSync(path, "utf8").split(/\r?\n/).some((existing) => existing.trim() === line)
}

/** Adds one line to the end of `.gitignore` in the file's own line ending, creating the file when it is missing. */
const appendToGitignore = (repositoryDirectory, line) => {
  const path = join(repositoryDirectory, GITIGNORE_FILE_NAME)

  if (!existsSync(path)) {
    writeFileSync(path, `${line}\n`, "utf8")

    return `Created ${GITIGNORE_FILE_NAME} with ${line}.`
  }

  const contents = readFileSync(path, "utf8")
  const lineEnding = contents.includes("\r\n") ? "\r\n" : "\n"
  const separator = contents.length === 0 || contents.endsWith("\n") ? "" : lineEnding
  writeFileSync(path, `${contents}${separator}${line}${lineEnding}`, "utf8")

  return `Added ${line} to ${GITIGNORE_FILE_NAME}.`
}
