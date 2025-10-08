const PREFIX = '[Apex Assist]'
const DEBUG = false

export const logger = {
  info(message: string, ...args: unknown[]) {
    // Compact, consistent prefix
    console.log(`${PREFIX} ${message}`, ...args)
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(`${PREFIX} ${message}`, ...args)
  },
  error(message: string, ...args: unknown[]) {
    console.error(`${PREFIX} ${message}`, ...args)
  },
  debug(message: string, ...args: unknown[]) {
    if (DEBUG) console.debug(`${PREFIX} ${message}`, ...args)
  },
}
