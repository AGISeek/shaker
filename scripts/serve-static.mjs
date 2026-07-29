import { createServer } from "node:http"
import { realpath, stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
}

function isContained(root, target) {
  return target === root || target.startsWith(`${root}${sep}`)
}

export async function startStaticServer({ root, port }) {
  const staticRoot = await realpath(root)

  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)
      const target = resolve(staticRoot, `.${pathname}`)

      if (!isContained(staticRoot, target)) {
        response.writeHead(403).end("Forbidden")
        return
      }

      const file = (await stat(target)).isDirectory() ? resolve(target, "index.html") : target
      if (!isContained(staticRoot, file)) {
        response.writeHead(403).end("Forbidden")
        return
      }

      const resolvedFile = await realpath(file)
      if (!isContained(staticRoot, resolvedFile)) {
        response.writeHead(403).end("Forbidden")
        return
      }

      const fileStat = await stat(resolvedFile)
      if (!fileStat.isFile()) {
        response.writeHead(404).end("Not found")
        return
      }

      response.writeHead(200, { "content-type": contentTypes[extname(resolvedFile)] ?? "application/octet-stream" })
      const { createReadStream } = await import("node:fs")
      createReadStream(resolvedFile).pipe(response)
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined
      response.writeHead(code === "ENOENT" || code === "ENOTDIR" ? 404 : 400).end(code === "ENOENT" ? "Not found" : "Bad request")
    }
  })

  await new Promise((resolveServer, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", resolveServer)
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    await new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())))
    throw new Error("Static server did not expose a TCP address")
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose()))),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, ...args] = process.argv.slice(2)
  const portIndex = args.indexOf("--port")
  const port = portIndex === -1 ? 3000 : Number(args[portIndex + 1])

  if (!root || !Number.isInteger(port) || port < 0 || port > 65535) {
    console.error("Usage: node scripts/serve-static.mjs <root> [--port <port>]")
    process.exitCode = 1
  } else {
    const server = await startStaticServer({ root, port })
    console.log(`Serving ${root} at ${server.origin}`)
  }
}
