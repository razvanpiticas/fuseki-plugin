import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { STATE_TEMPLATE_FILE_NAME, readBundledFile } from "./bundled.mjs"

/**
 * `.fuseki/state.json` as a document: where it lives, how it is read and written, and the shape every
 * value in it must have.
 *
 * <p>The document is the plugin's memory of one repository (D15): the bound project and the path of every
 * local file a skill wrote. It is kept in two files. `.fuseki/state.json` holds what is true of the
 * repository and is committed with it; `.fuseki/local.json` holds the keys `MACHINE_KEY_PATHS` names,
 * which are true of one machine only, and is gitignored. Every command reads the two as one document
 * and writes it back split, so a skill never knows there are two.</p>
 *
 * <p>The files are written only through this tool, each in one step, and never replaced when they
 * cannot be read: a person's state is worth more than a fresh template, so a file that is not JSON, or
 * whose values are not the shape the template gives them, stops every command with the reason and is
 * left for the person to fix.</p>
 */

/** The directory the plugin keeps everything of a repository's in. */
export const STATE_DIRECTORY_NAME = ".fuseki"

/** The state file, inside that directory. Committed with the repository. */
export const STATE_FILE_NAME = "state.json"

/** This machine's part of the state, inside that directory. Gitignored. */
export const LOCAL_FILE_NAME = "local.json"

/** The test account's sign-in, inside that directory. Written by the person, never by this tool. Gitignored. */
export const ENV_FILE_NAME = ".env"

/** The state file as a person reads its name: relative to the repository, forward slashes. */
export const STATE_FILE_LABEL = `${STATE_DIRECTORY_NAME}/${STATE_FILE_NAME}`

/** The local file as a person reads its name. */
export const LOCAL_FILE_LABEL = `${STATE_DIRECTORY_NAME}/${LOCAL_FILE_NAME}`

/** The env file as the state records it and a person reads it. */
export const ENV_FILE_LABEL = `${STATE_DIRECTORY_NAME}/${ENV_FILE_NAME}`

/**
 * The keys that describe this machine rather than the repository, kept in `.fuseki/local.json`: the
 * plugin installed here, the routines this machine's scheduler fires, the tools found on it, and the
 * env file, which is never committed, with the key names read from it.
 */
export const MACHINE_KEY_PATHS = Object.freeze([
  "uiTesting.playwrightCli",
  "uiTesting.envFile",
  "uiTesting.envKeysPresent",
  "repository.github.ghCli",
  "routines",
  "plugin",
])

/** What the file is written to first, beside itself, so the rename that replaces it is one step. */
const TEMPORARY_SUFFIX = ".tmp"

/** Two spaces and a trailing newline: the boilerplate scaffold's rule for its own state file. */
const JSON_INDENT = 2

/**
 * Maps whose keys are names a skill chooses, with the shape every value under them takes.
 *
 * The template holds them empty, so the template alone cannot say what a value under them looks
 * like. The story that defines the file says it, and it is restated here once.
 */
export const OPEN_MAP_ENTRY_SHAPES = Object.freeze({
  "wiki.subsystems": Object.freeze({ root: "", architecture: "", structure: "", systems: [], crossCutting: [], guides: [], patterns: [], walkthroughs: [], decisions: [] }),
  routines: Object.freeze({ name: "", installedAtUtc: "", harness: "", entry: "" }),
})

/**
 * Lists whose items are objects rather than strings, with the shape every item takes. The template
 * holds them empty, so, as for the open maps, the shape is restated here once.
 */
export const LIST_ENTRY_SHAPES = Object.freeze({
  "activity.recent": Object.freeze({ atUtc: "", skill: "", item: "", note: "" }),
})

/** Keys the template holds as null — not asked or not written yet — and the type each takes once it is. */
export const NULLABLE_KEY_TYPES = Object.freeze({
  "productVision.definitionVersion": "number",
  "codingStandards.definitionVersion": "number",
  "uiTesting.requiresSignIn": "boolean",
})

/** The state file of one repository. */
export const statePathOf = (repositoryDirectory) => join(repositoryDirectory, STATE_DIRECTORY_NAME, STATE_FILE_NAME)

/** The local file of one repository. */
export const localPathOf = (repositoryDirectory) => join(repositoryDirectory, STATE_DIRECTORY_NAME, LOCAL_FILE_NAME)

/** The env file of one repository. */
export const envPathOf = (repositoryDirectory) => join(repositoryDirectory, STATE_DIRECTORY_NAME, ENV_FILE_NAME)

/** The template, parsed, as the build bundled it beside this tool. */
export const readTemplate = (bundledDirectory) => parseDocument(readBundledFile(bundledDirectory, STATE_TEMPLATE_FILE_NAME), STATE_TEMPLATE_FILE_NAME)

/**
 * Reads the state file, refusing a missing one, one that is not JSON, and one that is not the
 * template's shape.
 *
 * @param {string} repositoryDirectory the repository the file belongs to
 * @param {object} template the parsed template, which every value is held to
 * @returns {object} the document
 */
export const readState = (repositoryDirectory, template) => {
  const document = readStateUnchecked(repositoryDirectory)

  const absent = MACHINE_KEY_PATHS.filter((keyPath) => !valueAt(document, splitKeyPath(keyPath)).found)
  if (absent.length > 0 && !existsSync(localPathOf(repositoryDirectory))) {
    throw new Error(`There is no ${LOCAL_FILE_LABEL} in ${repositoryDirectory}, so this machine's keys (${absent.join(", ")}) are missing. Run fuseki state init there first.`)
  }

  requireConformance(template, document, "")

  return document
}

/**
 * Reads the state file with the local file laid over it, refusing a missing state file and either
 * file when it is not JSON, without holding the values to the template. Only `fuseki state init` reads
 * this way, because it fills the keys an older file lacks before anything is held to anything.
 */
export const readStateUnchecked = (repositoryDirectory) => {
  const path = statePathOf(repositoryDirectory)
  if (!existsSync(path)) throw new Error(`There is no ${STATE_FILE_LABEL} in ${repositoryDirectory}. Run fuseki state init there first.`)

  return overlayLocalState(repositoryDirectory, parseDocument(readFileSync(path, "utf8"), STATE_FILE_LABEL))
}

/**
 * Lays this machine's keys from `.fuseki/local.json` over a document, when the file exists. A key the
 * local file holds wins over the same key in the state file, which an older plugin wrote there.
 *
 * @returns {object} the document it was given, changed in place
 */
export const overlayLocalState = (repositoryDirectory, document) => {
  const path = localPathOf(repositoryDirectory)
  if (!existsSync(path)) return document

  const local = parseDocument(readFileSync(path, "utf8"), LOCAL_FILE_LABEL)
  requireMachineKeysOnly(local, "")

  for (const keyPath of MACHINE_KEY_PATHS) {
    const segments = splitKeyPath(keyPath)
    const { found, value } = valueAt(local, segments)
    if (found) placeAt(document, segments, value)
  }

  return document
}

/**
 * Writes the document split in two — this machine's keys to `.fuseki/local.json`, the rest to
 * `.fuseki/state.json` — and writes each file only when its text differs from what is on disk, so a
 * run that finds nothing new leaves both byte for byte as they were. A state file an older plugin
 * wrote with this machine's keys in it loses them here, to the local file.
 *
 * The local file goes first: a failure between the two leaves the state file as it was, and its
 * stale machine keys are overlaid by the local file's on the next read.
 *
 * @param {string} repositoryDirectory the repository the files belong to
 * @param {object} document the whole document, every machine key in it
 * @param {{rename?: function}} [ports] the rename, injected so a failing one can be proved harmless
 * @returns {boolean} whether either file was written
 */
export const writeStateWhenChanged = (repositoryDirectory, document, { rename = renameSync } = {}) => {
  const { shared, local } = splitDocument(document)

  const wroteLocal = writeFileWhenChanged(localPathOf(repositoryDirectory), LOCAL_FILE_LABEL, serialise(local), rename)
  const wroteShared = writeFileWhenChanged(statePathOf(repositoryDirectory), STATE_FILE_LABEL, serialise(shared), rename)

  return wroteLocal || wroteShared
}

/**
 * Writes one file in one step, when its text differs: to a temporary file beside it, then a rename
 * over it. A crash between the two leaves the file as it was. A rename that fails takes the temporary
 * file away and says so; the file as it was is untouched either way.
 */
const writeFileWhenChanged = (path, label, text, rename) => {
  if (existsSync(path) && readFileSync(path, "utf8") === text) return false

  const temporary = `${path}${TEMPORARY_SUFFIX}`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(temporary, text, "utf8")

  try {
    rename(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw new Error(`${label} was not written, and the file as it was is untouched: ${error.message}`)
  }

  return true
}

/** The document as its two files: this machine's keys, and everything else. */
const splitDocument = (document) => {
  const shared = structuredClone(document)
  const local = {}

  for (const keyPath of MACHINE_KEY_PATHS) {
    const segments = splitKeyPath(keyPath)
    const parent = valueAt(shared, segments.slice(0, -1))
    const key = segments.at(-1)
    if (!parent.found || !Object.hasOwn(parent.value, key)) throw new Error(`The document to write has no ${keyPath}, which ${LOCAL_FILE_LABEL} keeps. Nothing was written.`)

    placeAt(local, segments, parent.value[key])
    delete parent.value[key]
  }

  return { shared, local }
}

/** Sets a value at a key path, making the objects on the way to it when they are absent. */
const placeAt = (document, segments, value) => {
  let parent = document

  segments.slice(0, -1).forEach((segment, index) => {
    if (!Object.hasOwn(parent, segment)) parent[segment] = {}
    if (!isPlainObject(parent[segment])) throw new Error(`${segments.slice(0, index + 1).join(".")} is ${describe(parent[segment])}, not an object, so ${segments.join(".")} cannot be kept in it.`)

    parent = parent[segment]
  })

  parent[segments.at(-1)] = value
}

/** Refuses a local file holding any key that is not this machine's, or not on the way to one. */
const requireMachineKeysOnly = (local, keyPath) => {
  for (const [key, value] of Object.entries(local)) {
    const childPath = joinKey(keyPath, key)
    if (MACHINE_KEY_PATHS.includes(childPath)) continue

    if (!isPlainObject(value) || !MACHINE_KEY_PATHS.some((machineKeyPath) => machineKeyPath.startsWith(`${childPath}.`))) {
      throw new Error(`${LOCAL_FILE_LABEL} holds ${childPath}, which is not a key of this machine; it belongs in ${STATE_FILE_LABEL}. It is never replaced: fix it by hand, then run the command again.`)
    }

    requireMachineKeysOnly(value, childPath)
  }
}

/** The file's text for a document. */
const serialise = (document) => `${JSON.stringify(document, null, JSON_INDENT)}\n`

/** A key path, `a.b.c`, as its segments; refused when it is empty or has an empty segment. */
export const splitKeyPath = (keyPath) => {
  if (typeof keyPath !== "string" || keyPath.length === 0) throw new Error("A key path is required, such as project or uiTesting.baseUrl.")

  const segments = keyPath.split(".")
  if (segments.some((segment) => segment.length === 0)) throw new Error(`"${keyPath}" is not a key path: it has an empty segment.`)

  return segments
}

/**
 * The shape the template gives a key, read through the open maps.
 *
 * @throws when the template has no such key, naming the keys that exist at that level
 */
export const shapeAt = (template, segments) => {
  let shape = template

  segments.forEach((segment, index) => {
    const parentPath = segments.slice(0, index).join(".")
    const entryShape = OPEN_MAP_ENTRY_SHAPES[parentPath]

    if (entryShape !== undefined) {
      shape = entryShape
      return
    }

    if (!isPlainObject(shape) || !Object.hasOwn(shape, segment)) {
      const known = isPlainObject(shape) ? ` The keys there are: ${Object.keys(shape).join(", ")}.` : ""
      throw new Error(`${STATE_FILE_LABEL} has no key "${segments.slice(0, index + 1).join(".")}".${known}`)
    }

    shape = shape[segment]
  })

  return shape
}

/**
 * The value at a key path, or `found: false` when some segment of it is absent.
 *
 * @returns {{found: boolean, value: *}}
 */
export const valueAt = (document, segments) => {
  let value = document

  for (const segment of segments) {
    if (!isPlainObject(value) || !Object.hasOwn(value, segment)) return { found: false, value: undefined }
    value = value[segment]
  }

  return { found: true, value }
}

/**
 * Holds a value to the shape the template gives its key, and throws on the first difference.
 *
 * A string key takes a string, a list takes a list of strings (or of objects in the shape
 * `LIST_ENTRY_SHAPES` names), an object takes exactly the
 * template's keys, an open map takes any names with every value in the entry shape, and a key the
 * template holds as null takes null or the type `NULLABLE_KEY_TYPES` names.
 *
 * @param {*} shape the template's value for the key
 * @param {*} value the value to hold to it
 * @param {string} keyPath the key, for the message; empty for the whole document
 */
export const requireConformance = (shape, value, keyPath) => {
  const label = keyPath === "" ? STATE_FILE_LABEL : keyPath

  if (shape === null) {
    const type = NULLABLE_KEY_TYPES[keyPath]
    if (type === undefined) throw new Error(`The template holds ${label} as null and no type is declared for it.`)
    if (value !== null && typeof value !== type) throw new Error(`${label} takes a ${type} or null, and ${describe(value)} was given.`)

    return
  }

  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) throw new Error(`${label} takes a list, and ${describe(value)} was given.`)

    const itemShape = LIST_ENTRY_SHAPES[keyPath]
    if (itemShape !== undefined) {
      value.forEach((item, index) => requireConformance(itemShape, item, `${label}[${index}]`))

      return
    }

    value.forEach((item, index) => {
      if (typeof item !== "string") throw new Error(`${label}[${index}] takes a string, and ${describe(item)} was given.`)
    })

    return
  }

  if (isPlainObject(shape)) {
    if (!isPlainObject(value)) throw new Error(`${label} takes an object, and ${describe(value)} was given.`)

    const entryShape = OPEN_MAP_ENTRY_SHAPES[keyPath]
    if (entryShape !== undefined) {
      for (const [name, entry] of Object.entries(value)) requireConformance(entryShape, entry, joinKey(keyPath, name))

      return
    }

    const missing = Object.keys(shape).filter((key) => !Object.hasOwn(value, key))
    if (missing.length > 0) throw new Error(`${label} lacks ${missing.join(", ")}. It takes exactly: ${Object.keys(shape).join(", ")}.`)

    const unknown = Object.keys(value).filter((key) => !Object.hasOwn(shape, key))
    if (unknown.length > 0) throw new Error(`${label} has no key ${unknown.join(", ")}. It takes exactly: ${Object.keys(shape).join(", ")}.`)

    for (const key of Object.keys(shape)) requireConformance(shape[key], value[key], joinKey(keyPath, key))

    return
  }

  if (typeof value !== typeof shape) throw new Error(`${label} takes a ${typeof shape}, and ${describe(value)} was given.`)
}

/**
 * Adds every key the template has and the document lacks, the template's value for it, without
 * touching a key that is present. Reaches into the entries of an open map too.
 *
 * @returns {string[]} the key paths that were added
 */
export const fillMissingKeys = (shape, document, keyPath = "") => {
  const added = []
  const entryShape = OPEN_MAP_ENTRY_SHAPES[keyPath]

  if (entryShape !== undefined) {
    for (const [name, entry] of Object.entries(document)) {
      if (isPlainObject(entry)) added.push(...fillMissingKeys(entryShape, entry, joinKey(keyPath, name)))
    }

    return added
  }

  for (const [key, value] of Object.entries(shape)) {
    const childPath = joinKey(keyPath, key)

    if (!Object.hasOwn(document, key)) {
      document[key] = structuredClone(value)
      added.push(childPath)
    } else if (isPlainObject(value) && isPlainObject(document[key])) {
      added.push(...fillMissingKeys(value, document[key], childPath))
    }
  }

  return added
}

/** Whether a value is a JSON object rather than a list, null or a scalar. */
export const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)

const joinKey = (keyPath, key) => (keyPath === "" ? key : `${keyPath}.${key}`)

const parseDocument = (text, label) => {
  let document

  try {
    document = JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}. It is never replaced: fix it by hand, then run the command again.`)
  }

  if (!isPlainObject(document)) throw new Error(`${label} holds ${describe(document)}, not an object. It is never replaced: fix it by hand, then run the command again.`)

  return document
}

const describe = (value) => {
  if (value === null) return "null"
  if (Array.isArray(value)) return "a list"
  if (typeof value === "object") return "an object"

  return `the ${typeof value} ${JSON.stringify(value)}`
}
