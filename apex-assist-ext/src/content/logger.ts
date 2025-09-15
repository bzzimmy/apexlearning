const PREFIX = '[Apex Assist]'
const DEBUG = false

export const logger = {
  info(message: string, ...args: any[]) {
    // Compact, consistent prefix
    console.log(`${PREFIX} ${message}`, ...args)
  },
  warn(message: string, ...args: any[]) {
    console.warn(`${PREFIX} ${message}`, ...args)
  },
  error(message: string, ...args: any[]) {
    console.error(`${PREFIX} ${message}`, ...args)
  },
  debug(message: string, ...args: any[]) {
    if (DEBUG) console.debug(`${PREFIX} ${message}`, ...args)
  },
}

