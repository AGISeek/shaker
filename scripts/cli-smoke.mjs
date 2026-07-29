import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "node:child_process"
import { startStaticServer } from "./serve-static.mjs"

const workspace = resolve(import.meta.dirname, "..")

function run(command, args, cwd) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk
    })
    child.stderr.on("data", (chunk) => {
      output += chunk
    })
    child.once("error", reject)
    child.once("close", (code) => {
      if (code === 0) resolveCommand(output)
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${output}`))
    })
  })
}

async function prepareConsumer(directory, namespaceUrl) {
  const fixture = resolve(workspace, "tests/fixtures/consumer")
  await cp(fixture, directory, { recursive: true })

  const configPath = join(directory, "components.json")
  const config = JSON.parse(await readFile(configPath, "utf8"))
  config.registries["@internal"] = namespaceUrl
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`)
  await writeFile(join(directory, "package.json"), '{"name":"registry-cli-smoke","private":true}\n')
  await writeFile(join(directory, "tsconfig.json"), '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}\n')
}

const server = await startStaticServer({ root: resolve(workspace, "out"), port: 0 })
const consumer = await mkdtemp(join(tmpdir(), "internal-registry-cli-"))

try {
  await prepareConsumer(consumer, `${server.origin}/r/{name}.json`)

  const commands = [
    ["list", "@internal"],
    ["search", "@internal", "--query", "button"],
    ["view", "@internal/button"],
    ["add", "@internal/button", "--yes"],
  ]

  for (const args of commands) {
    const output = await run("pnpm", ["exec", "shadcn", ...args], consumer)
    console.log(output.trim())
    if (!output.toLowerCase().includes("button")) {
      throw new Error(`Expected shadcn ${args[0]} output to contain button\n${output}`)
    }
  }

  await stat(join(consumer, "components/ui/button.tsx"))
  console.log("shadcn CLI registry smoke test passed")
} finally {
  await server.close()
  await rm(consumer, { recursive: true, force: true })
}
