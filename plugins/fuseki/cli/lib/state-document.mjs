import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { STATE_TEMPLATE_FILE_NAME, readBundledFile } from "./bundled.mjs"

/**
 * `.fuseki/state.json` as a document: where it lives, how it is read and written, and the shape every
 * value in it must have.
 *
 * <p>The file is the plugin's memory of one repository (D15): the bound project and the path of every
 * local file a skill wrote. It is written only through this tool, the whole file in one step, and
 * never replaced when it cannot be read: a person's state is worth more than a fresh template, so a
 * file that is not JSON, or whose values are not the shape the template gives them, stops every
 * command with the reason and is left for the person to fix.</p>
 */

/** The gitignored directory the plugin keeps everything of a repository's in. */
export const STATE_DIRECTORY_NAME = ".fuseki"

/** The state file, inside that directory. */
export const STATE_FILE_NAME = "state.json"

/** The test account's sign-in, inside that directory. Written by the person, never by this tool. */
export const ENV_FILE_NAME = ".env"

/** The state file as a person reads its name: relative to the repository, forward slashes. */
export const STATE_FILE_LABEL = `${STATE_DIRECTORY_NAME}/${STATE_FILE_NAME}`

/** The env file as the state records it and a person reads it. */
export const ENV_FILE_LABEL = `${STATE_DIRECTORY_NAME}/${ENV_FILE_NAME}`

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

/** Keys the template holds as null — not asked or not written yet — and the type each takes once it is. */
export const NULLABLE_KEY_TYPES = Object.freeze({
  "productVision.definitionVersion": "number",
  "codingStandards.definitionVersion": "number",
  "uiTesting.requiresSignIn": "boolean",
})

/** The state file of one repository. */
export const statePathOf = (repositoryDirectory) => join(repositoryDirectory, STATE_DIRECTORY_NAME, STATE_FILE_NAME)

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
  requireConformance(template, document, "")

  return document
}

/**
 * Reads the state file, refusing a missing one and one that is not JSON, without holding its values
 * to the template. Only `fuseki state init` reads this way, because it fills the keys an older file
 * lacks before anything is held to anything.
 */
export const readStateUnchecked = (repositoryDirectory) => {
  const path = statePathOf(repositoryDirectory)
  if (!existsSync(path)) throw new Error(`There is no ${STATE_FILE_LABEL} in ${repositoryDirectory}. Run fuseki state init there first.`)

  return parseDocument(readFileSync(path, "utf8"), STATE_FILE_LABEL)
}

/**
 * Writes the whole file in one step: to a temporary file beside it, then a rename over it.
 *
 * A crash between the two leaves the file as it was. A rename that fails takes the temporary file
 * away and says so; the file as it was is untouched either way.
 *
 * @param {string} repositoryDirectory the repository the file belongs to
 * @param {object} document the whole document
 * @param {{rename?: function}} [ports] the rename, injected so a failing one can be proved harmless
 */
export const writeState = (repositoryDirectory, document, { rename = renameSync } = {}) => {
  const path = statePathOf(repositoryDirectory)
  const temporary = `${path}${TEMPORARY_SUFFIX}`

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(temporary, serialise(document), "utf8")

  try {
    rename(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw new Error(`${STATE_FILE_LABEL} was not written, and the file as it was is untouched: ${error.message}`)
  }
}

/**
 * Writes the document only when it differs from what was read, so a run that finds nothing new
 * leaves the file byte for byte as it was.
 *
 * @returns {boolean} whether it was written
 */
export const writeStateWhenChanged = (repositoryDirectory, before, after) => {
  if (before !== null && serialise(before) === serialise(after)) return false

  writeState(repositoryDirectory, after)

  return true
}

/** The file's text for a document. */
export const serialise = (document) => `${JSON.stringify(document, null, JSON_INDENT)}\n`

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
 * A string key takes a string, a list takes a list of strings, an object takes exactly the
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
