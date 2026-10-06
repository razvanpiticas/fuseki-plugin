import { existsSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

import { OPEN_MAP_ENTRY_SHAPES, readState, readTemplate, splitKeyPath, valueAt, writeStateWhenChanged } from "./state-document.mjs"

/**
 * `fuseki state discover` — finds the documents a repository already has where the skills would have
 * written them, records the ones whose key is still empty, and names the rest for a person to place.
 *
 * <p>A repository mapped before the plugin was installed, or by hand, holds its vision, its coding
 * standards and its wiki at the paths the skills write to, and the state knows none of them. A skill
 * that reads only what the state records would then write a second document beside the first. This
 * reads the layout the skills write and fills the keys from it.</p>
 *
 * <p><b>Only an empty key is filled.</b> A recorded path, and a list that holds anything, is a skill's
 * own record and is never replaced. A document whose place in the layout is not certain — a
 * system-wide document other than the ones the state names, a file loose in a subsystem's folder, a
 * folder the state has no key for — is named as a candidate and written nowhere: the front door asks
 * the person, and records the answer itself. A candidate the person chose not to record is in
 * `discovery.ignored` and is not named again.</p>
 */

/**
 * The documents a key records by itself, relative to the documentation root, the name the skills write
 * first. A system-wide document may also carry the name the map-system definition's templates give it
 * (`system-architecture.md`), which is the same document: it is recorded when the first name is absent,
 * and is a candidate like any other system-wide document when both are there.
 */
const SINGLE_DOCUMENTS = Object.freeze([
  { keyPath: "productVision.path", relativePaths: ["product/product-vision.md"] },
  { keyPath: "codingStandards.path", relativePaths: ["wiki/system-wide/coding-standards.md"] },
  { keyPath: "wiki.systemWide.architecture", relativePaths: ["wiki/system-wide/architecture.md", "wiki/system-wide/system-architecture.md"] },
  { keyPath: "wiki.systemWide.structure", relativePaths: ["wiki/system-wide/structure.md", "wiki/system-wide/system-structure.md"] },
  { keyPath: "wiki.systemWide.testing", relativePaths: ["wiki/system-wide/testing.md", "wiki/system-wide/testing-framework.md"] },
])

const SYSTEM_WIDE_FOLDER = "wiki/system-wide"
const SYSTEM_WIDE_DECISIONS_FOLDER = "wiki/system-wide/decisions"
const SUBSYSTEMS_FOLDER = "wiki/subsystems"
const WIKI_README = "wiki/wiki-readme.md"
const OTHER_DOCS_KEY = "wiki.systemWide.otherDocs"
const SYSTEM_WIDE_DECISIONS_KEY = "wiki.systemWide.decisions"
const SUBSYSTEMS_KEY = "wiki.subsystems"

/** A subsystem's two documents of its own, at the root of its folder, by key. */
const SUBSYSTEM_DOCUMENTS = Object.freeze({ architecture: "architecture.md", structure: "structure.md" })

/** A subsystem's folders of documents, by the key of the list each fills. */
const SUBSYSTEM_FOLDERS = Object.freeze({
  systems: "systems",
  crossCutting: "cross-cutting",
  guides: "guides",
  patterns: "patterns",
  walkthroughs: "walkthroughs",
  decisions: "decisions",
})

const MARKDOWN_EXTENSION = ".md"
const PATH_SEPARATOR = "/"

/**
 * Runs one discovery over the repository's documentation root.
 *
 * @param {{repositoryDirectory: string, bundledDirectory: string}} context
 * @returns {string[]} the lines to print: what was recorded, each candidate, and the keys still empty
 */
export const discoverDocuments = ({ repositoryDirectory, bundledDirectory }) => {
  const before = readState(repositoryDirectory, readTemplate(bundledDirectory))
  if (before.docsRoot === "") throw new Error("docsRoot is empty, so there is nowhere to look. Record the documentation root first: fuseki state set docsRoot '\"<directory>\"'.")

  const document = structuredClone(before)
  const docsRoot = trimSeparators(before.docsRoot)
  const recorded = []
  const candidates = []

  for (const { keyPath, relativePaths } of SINGLE_DOCUMENTS) fillSingle(document, keyPath, relativePaths.map((relativePath) => `${docsRoot}/${relativePath}`), repositoryDirectory, recorded)

  const decisionsFolder = `${docsRoot}/${SYSTEM_WIDE_DECISIONS_FOLDER}`
  const systemWideDecisions = listMarkdown(repositoryDirectory, decisionsFolder).filter((path) => isDirectlyIn(path, decisionsFolder))
  const readme = [`${docsRoot}/${WIKI_README}`].filter((path) => existsSync(join(repositoryDirectory, path)))

  candidates.push(...fillList(document, SYSTEM_WIDE_DECISIONS_KEY, systemWideDecisions, recorded))
  candidates.push(...fillList(document, OTHER_DOCS_KEY, readme, recorded))
  candidates.push(...systemWideCandidates(document, docsRoot, repositoryDirectory, new Set(systemWideDecisions)))
  for (const name of listDirectories(join(repositoryDirectory, docsRoot, SUBSYSTEMS_FOLDER))) {
    candidates.push(...discoverSubsystem(document, docsRoot, name, repositoryDirectory, recorded))
  }

  writeStateWhenChanged(repositoryDirectory, before, document)

  const known = new Set([...recordedPaths(document), ...document.discovery.ignored])
  const lines = [...recorded, ...candidates.filter(({ path }) => !known.has(path)).map(({ keyPath, path }) => `Candidate for ${keyPath}: ${path}`)]
  const empty = emptyKeys(document)

  if (lines.length === 0) lines.push("Nothing new found.")
  if (empty.length > 0) lines.push(`Still empty: ${empty.join(", ")}.`)

  return lines
}

/** Records one document under its key when the key is empty, the first of its names whose file is there. */
const fillSingle = (document, keyPath, paths, repositoryDirectory, recorded) => {
  const segments = splitKeyPath(keyPath)
  const parent = valueAt(document, segments.slice(0, -1)).value
  const key = segments.at(-1)
  const path = paths.find((candidate) => existsSync(join(repositoryDirectory, candidate)))

  if (parent[key] !== "" || path === undefined) return

  parent[key] = path
  recorded.push(`Recorded ${keyPath}: ${path}`)
}

/**
 * Fills a system-wide list with the documents found for it while it is empty; once it holds anything,
 * answers each document it lacks as a candidate for it instead, so a list a skill wrote keeps exactly
 * what that skill put in it.
 *
 * @returns {{keyPath: string, path: string}[]} the candidates
 */
const fillList = (document, keyPath, paths, recorded) => {
  const segments = splitKeyPath(keyPath)
  const parent = valueAt(document, segments.slice(0, -1)).value
  const key = segments.at(-1)

  if (paths.length === 0) return []
  if (parent[key].length > 0) return paths.filter((path) => !parent[key].includes(path)).map((path) => ({ keyPath, path }))

  parent[key] = paths
  recorded.push(`Recorded ${keyPath}: ${paths.join(", ")}`)

  return []
}

/**
 * Every system-wide document the state does not name, other than the system-wide decision records:
 * each is a candidate for the other documents. A single document's first name is the skills' own and
 * never a candidate; its other name is one when the state records something else for that key.
 */
const systemWideCandidates = (document, docsRoot, repositoryDirectory, decisions) => {
  const folder = `${docsRoot}/${SYSTEM_WIDE_FOLDER}`
  const named = new Set(SINGLE_DOCUMENTS.map(({ relativePaths }) => `${docsRoot}/${relativePaths[0]}`))

  return listMarkdown(repositoryDirectory, folder)
    .filter((path) => !named.has(path) && !decisions.has(path) && !document.wiki.systemWide.otherDocs.includes(path))
    .map((path) => ({ keyPath: OTHER_DOCS_KEY, path }))
}

/**
 * Fills one subsystem's entry from its folder, and answers the documents in it the entry does not hold.
 *
 * A subsystem with no entry gets a whole one; a subsystem with an entry gets only its empty values
 * filled, so a list a skill wrote keeps exactly what that skill put in it. A document in one of the
 * entry's folders that a filled list lacks is a candidate for that list; a document anywhere else in
 * the subsystem's folder is a candidate for the subsystem, for the person to place.
 */
const discoverSubsystem = (document, docsRoot, name, repositoryDirectory, recorded) => {
  const root = `${docsRoot}/${SUBSYSTEMS_FOLDER}/${name}`
  const subsystems = document.wiki.subsystems
  const isNew = !Object.hasOwn(subsystems, name)
  const entry = isNew ? { ...structuredClone(OPEN_MAP_ENTRY_SHAPES[SUBSYSTEMS_KEY]), root } : subsystems[name]
  const filled = []
  const placed = new Set()
  const candidates = []

  for (const [key, fileName] of Object.entries(SUBSYSTEM_DOCUMENTS)) {
    const path = `${root}/${fileName}`
    if (!existsSync(join(repositoryDirectory, path))) continue

    placed.add(path)
    if (entry[key] !== "") continue

    entry[key] = path
    filled.push(key)
  }

  for (const [key, folderName] of Object.entries(SUBSYSTEM_FOLDERS)) {
    const paths = listMarkdown(repositoryDirectory, `${root}/${folderName}`).filter((path) => isDirectlyIn(path, `${root}/${folderName}`))
    for (const path of paths) placed.add(path)
    if (paths.length === 0) continue

    if (entry[key].length > 0) {
      candidates.push(...paths.filter((path) => !entry[key].includes(path)).map((path) => ({ keyPath: `${SUBSYSTEMS_KEY}.${name}.${key}`, path })))
      continue
    }

    entry[key] = paths
    filled.push(`${paths.length} ${key}`)
  }

  if (filled.length > 0) {
    subsystems[name] = entry
    recorded.push(`Recorded ${SUBSYSTEMS_KEY}.${name}: ${filled.join(", ")}`)
  }

  const unplaced = listMarkdown(repositoryDirectory, root).filter((path) => !placed.has(path))

  return [...candidates, ...unplaced.map((path) => ({ keyPath: `${SUBSYSTEMS_KEY}.${name}`, path }))]
}

/** Every path the state records, so a document recorded anywhere is never named as a candidate. */
const recordedPaths = (document) => [
  ...SINGLE_DOCUMENTS.map(({ keyPath }) => valueAt(document, splitKeyPath(keyPath)).value),
  ...document.wiki.systemWide.decisions,
  ...document.wiki.systemWide.otherDocs,
  ...Object.values(document.wiki.subsystems).flatMap((entry) => [entry.architecture, entry.structure, ...Object.keys(SUBSYSTEM_FOLDERS).flatMap((key) => entry[key])]),
]

/** The single-document keys still empty after discovery, which the front door's status names. */
const emptyKeys = (document) => SINGLE_DOCUMENTS.map(({ keyPath }) => keyPath).filter((keyPath) => valueAt(document, splitKeyPath(keyPath)).value === "")

/** Every markdown file under a folder, at any depth, relative to the repository, sorted; none when the folder is absent. */
const listMarkdown = (repositoryDirectory, folder) => {
  const absolute = join(repositoryDirectory, folder)
  if (!existsSync(absolute)) return []

  return readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(MARKDOWN_EXTENSION))
    .map((entry) => toRepositoryPath(repositoryDirectory, join(entry.parentPath, entry.name)))
    .sort()
}

/** The directories directly inside a folder, sorted; none when the folder is absent. */
const listDirectories = (absolute) => {
  if (!existsSync(absolute)) return []

  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** Whether a path is a file directly inside a folder rather than deeper. */
const isDirectlyIn = (path, folder) => path.startsWith(`${folder}/`) && !path.slice(folder.length + 1).includes(PATH_SEPARATOR)

/** A path relative to the repository, with forward slashes, as the state records every path. */
const toRepositoryPath = (repositoryDirectory, absolute) => relative(repositoryDirectory, absolute).replaceAll("\\", PATH_SEPARATOR)

/** The documentation root as recorded, without a leading `./` or a trailing slash. */
const trimSeparators = (docsRoot) => docsRoot.replace(/^\.\//, "").replace(/\/+$/, "")
