/**
 * Indirection over node:fs/promises. Tests inject filesystem failures through
 * this module because node builtins cannot be mocked for source modules.
 */
export { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
