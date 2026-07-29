import { access, cp, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

const requiredFiles = ["index.html", "r/registry.json", "r/button.json", "r/approval-card.json", "r/admin-dashboard.json"]
const ref = process.argv[2] === "--ref" ? process.argv[3] : undefined

if (!ref || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(ref)) {
  console.error("Usage: node scripts/package-release.mjs --ref <git-sha-or-tag>")
  process.exitCode = 1
} else {
  const root = process.cwd()
  const output = join(root, "out")
  const destination = join(root, "dist", ref)
  let destinationExists = false
  try {
    await access(destination)
    destinationExists = true
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error
  }
  if (destinationExists) {
    console.error(`Release directory already exists: dist/${ref}`)
    process.exitCode = 1
  }
  try {
    for (const file of requiredFiles) await access(join(output, file))
  } catch {
    console.error("Missing required output; build the complete static site before packaging.")
    process.exitCode = 1
  }
  if (!process.exitCode) {
    await mkdir(join(root, "dist"), { recursive: true })
    const staging = join(root, "dist", `.${ref}.tmp-${process.pid}`)
    try {
      await cp(output, staging, { recursive: true, errorOnExist: true })
      await writeFile(join(staging, "release.json"), `${JSON.stringify({ ref, createdAt: new Date().toISOString() }, null, 2)}\n`)
      await rename(staging, destination)
      console.log(`Packaged release ${ref}`)
    } catch (error) {
      await rm(staging, { recursive: true, force: true })
      throw error
    }
  }
}
