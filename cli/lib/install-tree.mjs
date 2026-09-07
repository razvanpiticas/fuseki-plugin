import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const INSTALL_MANIFEST_FILENAME = "install.json"
const USER_SCOPE = "user"
const PROJECT_SCOPE = "project"
const JSON_INDENT = 2

/**
 * Installs one built provider tree into a project.
 *
 * Two kinds of file, handled differently on purpose:
 *
 * - **Skills** are this plugin's own directories. They are replaced outright, because a stale
 *   `SKILL.md` left beside a new one is the drift this whole build exists to prevent.
 * - **The MCP declaration** goes into a file the user may already own, holding servers this
 *   installer knows nothing about. It is merged, never overwritten, and a machine-wide file is not
 *   written at all — the fragment is returned for the user to place themselves.
 *
 * @param {object} options
 * @param {string} options.treeDirectory absolute path to one `providers/<id>` directory
 * @param {string} options.projectDirectory absolute path to install into
 * @returns {{ provider: string, displayName: string, skillPaths: string[], mcpTargetPath: string, mcpWritten: boolean, mcpFragment: string|null, pinning: string }}
 */
export const installTree = ({ treeDirectory, projectDirectory }) => {
  if (!treeDirectory) throw new Error("installTree requires the built tree directory.")
  if (!projectDirectory) throw new Error("installTree requires the project directory.")

  const manifest = readManifest(treeDirectory)

  for (const skillPath of manifest.skillPaths) {
    const source = join(treeDirectory, skillPath)
    if (!existsSync(source)) throw new Error(`${INSTALL_MANIFEST_FILENAME} names a skill at ${skillPath}, which the tree does not carry.`)

    const target = join(projectDirectory, skillPath)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(source, target, { recursive: true, force: true })
  }

  const mcpSource = join(treeDirectory, manifest.mcp.sourcePath)
  const mcpContents = readFileSync(mcpSource, "utf8")

  if (manifest.mcp.scope === USER_SCOPE) {
    return { ...summarise(manifest), mcpWritten: false, mcpFragment: mcpContents }
  }

  if (manifest.mcp.scope !== PROJECT_SCOPE) {
    throw new Error(`${INSTALL_MANIFEST_FILENAME} carries unknown MCP scope "${manifest.mcp.scope}".`)
  }

  const mcpTarget = join(projectDirectory, manifest.mcp.targetPath)
  mkdirSync(dirname(mcpTarget), { recursive: true })
  writeFileSync(mcpTarget, mergeMcpDocument(mcpTarget, mcpContents), "utf8")

  return { ...summarise(manifest), mcpWritten: true, mcpFragment: null }
}

/**
 * Merges this server into an MCP config the project may already have.
 *
 * The incoming document carries exactly one server under exactly one container key. Only that one
 * key is touched: every other server the user configured survives, and so does every unrelated
 * setting in a file — such as Gemini's — that holds more than MCP servers.
 */
const mergeMcpDocument = (targetPath, incomingContents) => {
  const incoming = JSON.parse(incomingContents)

  if (!existsSync(targetPath)) return incomingContents

  let existing
  try {
    existing = JSON.parse(readFileSync(targetPath, "utf8"))
  } catch (error) {
    throw new Error(`${targetPath} exists but is not valid JSON, so it cannot be merged into: ${error.message}`)
  }

  const [containerKey] = Object.keys(incoming)
  const merged = { ...existing }

  if (containerKey === "mcp" && incoming.mcp.servers) {
    // One harness nests its servers a level deeper. Merging at the container key alone would
    // replace every server it already holds.
    merged.mcp = { ...existing.mcp, servers: { ...existing.mcp?.servers, ...incoming.mcp.servers } }
  } else {
    merged[containerKey] = { ...existing[containerKey], ...incoming[containerKey] }
  }

  return `${JSON.stringify(merged, null, JSON_INDENT)}\n`
}

const readManifest = (treeDirectory) => {
  const manifestPath = join(treeDirectory, INSTALL_MANIFEST_FILENAME)
  if (!existsSync(manifestPath)) throw new Error(`${treeDirectory} carries no ${INSTALL_MANIFEST_FILENAME}. It is not a built provider tree.`)

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

  if (!Array.isArray(manifest.skillPaths) || manifest.skillPaths.length === 0) {
    throw new Error(`${manifestPath} names no skills.`)
  }
  if (!manifest.mcp?.sourcePath || !manifest.mcp.targetPath) {
    throw new Error(`${manifestPath} carries an incomplete mcp descriptor.`)
  }

  return manifest
}

const summarise = (manifest) => ({
  provider: manifest.provider,
  displayName: manifest.displayName,
  skillPaths: manifest.skillPaths,
  mcpTargetPath: manifest.mcp.targetPath,
  pinning: manifest.mcp.pinning,
})
