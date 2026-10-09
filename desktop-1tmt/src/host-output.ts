/**
 * Readiness signal of the background `dsh web`: the web-app row prints
 * `dsh web: <authenticated URL>` once every Loader row has mounted.
 */

const READY_LINE = /^dsh web: (https?:\/\/\S+)/u

/**
 * Extract the authenticated local URL from one stdout line.
 * @param line - one line of `dsh web` stdout without its newline.
 * @returns the URL, or `undefined` when the line is not the readiness line.
 */
export function parseReadyUrl(line: string): string | undefined {
  return READY_LINE.exec(line.trim())?.[1]
}

/**
 * Split streamed stdout into complete lines, keeping a partial tail.
 * @param pending - the unterminated tail from the previous chunk.
 * @param chunk - newly received text.
 * @returns complete lines and the new unterminated tail.
 */
export function splitLines(pending: string, chunk: string): { lines: string[]; rest: string } {
  const parts = (pending + chunk).split(/\r?\n/u)
  const rest = parts.pop() ?? ''
  return { lines: parts, rest }
}
