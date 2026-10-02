import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * What the build puts beside the command-line tool: the two templates the front door's commands
 * copy, and the version the tool was built as.
 *
 * <p><b>Written by the build, never authored here.</b> The templates are authored once, in
 * `src/fuseki/reference/` (the state template is the plugin's, D15), and the build copies them into
 * `cli/bundled/` of every copy of the tool it ships — inside the plugin directory and at the
 * mirror's root. The tool runs from either, and in both the templates sit at the same place beside
 * it, which no path into the skill's own directory could promise.</p>
 *
 * <p>The build imports these names from here, so the directory the build writes and the directory
 * the tool reads are one constant.</p>
 */

/** The directory beside `bin/` and `lib/` the build writes the bundled files into. */
export const BUNDLED_DIRECTORY_NAME = "bundled"

/** The empty `.fuseki/state.json`, as `src/fuseki/reference/state.json` authors it. */
export const STATE_TEMPLATE_FILE_NAME = "state.json"

/** The blank `.fuseki/.env`, as `src/fuseki/reference/env.example` authors it. */
export const ENV_TEMPLATE_FILE_NAME = "env.example"

/** `{ "version": "<the stamped plugin version>" }`, written by the build. */
export const VERSION_FILE_NAME = "version.json"

/** Where the bundled files of the running copy of the tool are. */
export const bundledDirectoryOfThisTool = () => fileURLToPath(new URL(`../${BUNDLED_DIRECTORY_NAME}`, import.meta.url))

/**
 * Reads one bundled file as text.
 *
 * @param {string} bundledDirectory the directory the build wrote
 * @param {string} fileName one of the file names above
 * @returns {string} its contents
 * @throws when it is not there, which means this is the source tree's copy of the tool: the build
 *         is what writes the bundled files, so only a built copy carries them
 */
export const readBundledFile = (bundledDirectory, fileName) => {
  if (!bundledDirectory) throw new Error("readBundledFile requires the bundled directory.")

  const path = join(bundledDirectory, fileName)
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist. This copy of the tool was not built: run the copy the build writes (dist/plugins/fuseki/cli/bin/fuseki.mjs), not the source tree's.`)
  }

  return readFileSync(path, "utf8").replace(/\r\n/g, "\n")
}

/** The plugin version this copy of the tool was built as. */
export const readBundledVersion = (bundledDirectory) => {
  const { version } = JSON.parse(readBundledFile(bundledDirectory, VERSION_FILE_NAME))
  if (typeof version !== "string" || version.length === 0) throw new Error(`${VERSION_FILE_NAME} carries no version.`)

  return version
}
