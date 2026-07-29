import { execFile } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterEach, describe, expect, it } from "vitest"

const run = promisify(execFile)
const script = join(process.cwd(), "scripts/package-release.mjs")
const required = ["index.html", "r/registry.json", "r/button.json", "r/approval-card.json", "r/admin-dashboard.json"]
const temporaryDirectories: string[] = []

async function makeOutput() {
  const directory = await mkdtemp(join(tmpdir(), "registry-release-"))
  temporaryDirectories.push(directory)
  for (const file of required) {
    const path = join(directory, "out", file)
    await mkdir(join(path, ".."), { recursive: true })
    await writeFile(path, `required:${file}`)
  }
  await mkdir(join(directory, "out/assets"), { recursive: true })
  await writeFile(join(directory, "out/assets/brand.txt"), "unchanged static asset")
  return directory
}

afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe("release package", () => {
  it("does not create a version directory when a required output is missing", async () => {
    const directory = await makeOutput()
    await rm(join(directory, "out/r/button.json"))
    await expect(run("node", [script, "--ref", "missing-output"], { cwd: directory })).rejects.toMatchObject({ stderr: expect.stringContaining("Missing required output") })
    await expect(access(join(directory, "dist/missing-output"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("copies complete output exactly once into a version directory", async () => {
    const directory = await makeOutput()
    await run("node", [script, "--ref", "test-release"], { cwd: directory })
    expect(JSON.parse(await readFile(join(directory, "dist/test-release/release.json"), "utf8"))).toMatchObject({ ref: "test-release" })
    await expect(readFile(join(directory, "dist/test-release/r/admin-dashboard.json"), "utf8")).resolves.toBe("required:r/admin-dashboard.json")
    await expect(readFile(join(directory, "dist/test-release/assets/brand.txt"), "utf8")).resolves.toBe("unchanged static asset")
    await expect(run("node", [script, "--ref", "test-release"], { cwd: directory })).rejects.toMatchObject({ stderr: expect.stringContaining("already exists") })
  })
})
