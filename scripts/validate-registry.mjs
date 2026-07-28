import { loadCatalog } from "../src/registry/catalog.ts"
import { RegistryValidationError, assertValidCatalog } from "../src/registry/validate.ts"

try {
  const items = await loadCatalog()
  await assertValidCatalog(items)
  console.log(`Validated ${items.length} registry items.`)
} catch (error) {
  if (error instanceof RegistryValidationError) {
    console.error(error.message)
  } else {
    console.error(error)
  }
  process.exitCode = 1
}
