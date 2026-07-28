# Lightweight Internal shadcn Registry Design

Date: 2026-07-29
Status: Approved design

## 1. Summary

Build a lightweight, Git-managed internal UI asset registry that is compatible
with the official shadcn CLI. The project distributes three asset classes:

- UI components
- Business blocks
- Page templates

The same repository also builds a shadcn-inspired website for discovery,
documentation, source inspection, and interactive previews.

The first release is intentionally static. Git is the source of truth, pull
requests are the publishing workflow, CI validates and builds the registry, and
one static artifact contains both the website and the registry JSON endpoints.
There is no application database, write API, authentication layer, or runtime
upstream proxy.

## 2. Goals

1. Let internal developers discover, assess, and install approved UI assets.
2. Support the official shadcn CLI without introducing a private installation
   protocol.
3. Make adding an asset a small, reviewable Git change.
4. Offer real interactive previews for components, blocks, and templates.
5. Allow selected official or third-party registry items to be mirrored through
   an auditable pull-request workflow.
6. Keep the repository understandable to a maintainer without knowledge of the
   official shadcn monorepo.
7. Produce a static artifact suitable for an internal CDN, object store, or
   static web server.

## 3. Non-goals

The first release will not include:

- A login system, SSO integration, application database, or administrative UI
- Favorites, ratings, comments, analytics, or usage telemetry
- Browser-based source editing or publishing
- Multiple namespaces, team spaces, or independently branded registries
- Per-item published version histories
- Runtime proxying to an upstream registry
- General project scaffolding, an MCP service, or AI component generation
- A full copy of the official shadcn documentation and ecosystem directory
- The official repository's monorepo and workspace orchestration

Network or VPN access controls provide the security boundary. npm dependency
mirroring is outside this project's scope and remains governed by the
organization's package-manager configuration.

## 4. Key Decisions

### 4.1 Publishing model

Use Git and pull requests as the only authoring and publishing workflow. The
website is read-only.

### 4.2 Deployment model

Generate one static deployment artifact. The website and `/r/*.json` endpoints
are deployed atomically.

### 4.3 Application stack

Use one Next.js application with static export. Next.js is used as a static site
generator and React preview host; no runtime route handlers or server-only
application features are required.

### 4.4 Registry scope

Expose one `@internal` namespace with a unified design system. The supported
top-level asset types are:

- `registry:ui` and `registry:component` for reusable components
- `registry:block` for business blocks
- `registry:page` for full page templates

Assets may include hooks, utility files, styles, npm dependencies, and registry
dependencies when those are required by the top-level item.

### 4.5 Versioning

Version the registry as one repository release. The website displays the
deployed Git commit or tag. Git history and atomic deployment provide audit and
rollback. The first release does not serve parallel historical versions of an
individual item.

## 5. Architecture

The system has four independently understandable units.

### 5.1 Registry source

Owns registry metadata, installable source files, documentation, and preview
entry points. It is the source of truth for both CLI output and website content.

### 5.2 Build and validation tooling

Loads included registry files, validates official and internal rules, generates
preview/search data, builds shadcn JSON, performs CLI contract tests, and builds
the static website.

### 5.3 Discovery website

Reads the validated registry catalog and renders search, navigation,
documentation, source views, and interactive previews. It does not own a second
copy of asset metadata.

### 5.4 Upstream synchronizer

Fetches only configured upstream items, validates and normalizes them into local
source files, records provenance, and produces normal Git changes for review. It
does not participate in website or CLI requests at runtime.

The publication flow is:

```text
Git source
  -> schema and internal validation
  -> preview/search generation
  -> shadcn registry build
  -> Next.js static export
  -> CLI smoke tests against the static output
  -> atomic internal deployment
```

## 6. Proposed Repository Structure

```text
app/                              # Static site routes
components/
  site/                           # UI used by the registry website
registry/
  registry.json                   # Root catalog using include
  ui/
    registry.json
    button/
      button.tsx                  # Installable source
      preview.tsx                 # Website-only preview
  blocks/
    registry.json
  templates/
    registry.json
scripts/
  validate-registry.mjs
  sync-upstream.mjs
  generate-preview-map.mjs
upstreams.json                    # Allowlisted sources and pinned references
generated/
  preview-map.ts                  # Generated preview imports
public/
  r/                              # Generated registry JSON; never hand-edited
  search-index.json               # Generated client-side search data
docs/
  contributing.md
```

`public/r`, `generated/preview-map.ts`, and `public/search-index.json` are build
products. They are ignored by Git and never treated as author-maintained source.

This is a single application rather than a monorepo. Asset definitions use
shadcn's `include` support so definitions remain close to their source files
without introducing package boundaries.

## 7. Registry Data Model

The implementation must use the current official shadcn registry and
registry-item schemas as the external contract:

- [Registry documentation](https://ui.shadcn.com/docs/registry)
- [Getting started](https://ui.shadcn.com/docs/registry/getting-started)
- [Registry item schema](https://ui.shadcn.com/schema/registry-item.json)

Use official fields for information shared by the CLI and website:

- `name`
- `type`
- `title`
- `description`
- `author`
- `files`
- `dependencies`
- `devDependencies`
- `registryDependencies`
- `docs`
- `categories`

Use the schema-supported `meta` object for internal presentation and provenance:

```json
{
  "meta": {
    "status": "stable",
    "preview": "registry/ui/button/preview.tsx",
    "featured": false,
    "origin": "internal",
    "sourceRef": "main",
    "sourceDigest": "sha256:..."
  }
}
```

Allowed lifecycle states are:

- `experimental`
- `stable`
- `deprecated`

A deprecated item remains installable to avoid breaking existing instructions.
Its page and search result must name a replacement when one exists. The
replacement item name is recorded as `meta.replacedBy`.

The preview file is never installed merely because it sits next to an asset. An
asset's `files` array is the authoritative installation payload.

## 8. Website Information Architecture

The visual and interaction model should reference the official shadcn site
without copying its public marketing and ecosystem scope.

Primary references:

- [shadcn homepage](https://ui.shadcn.com/)
- [Components directory](https://ui.shadcn.com/docs/components)
- [Button documentation](https://ui.shadcn.com/docs/components/button)
- [Blocks](https://ui.shadcn.com/blocks)

### 8.1 Global shell

Use a restrained top navigation with:

- Internal registry identity
- Docs
- Components
- Blocks
- Templates
- Global search trigger with `Command/Ctrl+K`
- Theme toggle

Documentation-oriented pages use the shadcn pattern of:

- Left navigation
- Center content
- Right "On This Page" navigation where the document is long enough

Do not include public-site features such as GitHub star counts, product
announcements, Create, Charts, Directory, advertising, or ecosystem promotion.

### 8.2 Homepage

The homepage introduces the internal design foundation and leads with two
actions:

- Browse assets
- Configure the CLI

It may show representative live assets, but it should remain a practical entry
point rather than a marketing showcase. It also surfaces recently added and
featured assets using catalog metadata.

### 8.3 Asset directories

Components follow the official documentation-directory model:

- Recently added section
- Complete alphabetical index
- Fast left-side navigation

Blocks and templates use category navigation and larger previews rather than
small marketplace cards. Global search handles fuzzy lookup and filters for
type, category, and lifecycle state.

All search data is generated at build time and searched in the browser; there
is no search service.

### 8.4 Component detail

The content order follows official component documentation:

1. Title, description, status, and provenance
2. Interactive Preview and Code views
3. Installation
4. Usage
5. Examples
6. Dependencies and related assets
7. Additional documentation

### 8.5 Block and template detail

Use a large preview canvas inspired by the official Blocks page. The preview
toolbar provides:

- Preview/Code switching
- Desktop, tablet, and mobile widths
- Refresh
- Open in a new tab
- Copy installation command

Full-page templates may open a dedicated static preview route.

### 8.6 Preview isolation

Every preview renders through a dedicated static `/preview/{name}` route inside
an iframe, so asset layout and styles cannot damage the host documentation page.
The shared preview shell controls theme, viewport sizing, refresh, and error
display consistently for all asset types.

Each preview has its own error boundary. Preview failure shows a local error
panel while preserving documentation, source, and installation instructions.

## 9. CLI Contract

The registry is configured in a consuming project's `components.json`:

```json
{
  "registries": {
    "@internal": "https://internal.example/r/{name}.json"
  }
}
```

Expected commands include:

```bash
pnpm dlx shadcn@latest list @internal
pnpm dlx shadcn@latest search @internal --query button
pnpm dlx shadcn@latest view @internal/button
pnpm dlx shadcn@latest add @internal/button
```

The deployment must expose:

```text
/r/registry.json
/r/{name}.json
```

The catalog supports discovery commands, and item JSON supports view and
installation commands. The project must not depend on undocumented shadcn CLI
internals.

## 10. Contribution Workflow

An internal contributor:

1. Creates an asset directory in the relevant registry category.
2. Adds installable source files.
3. Adds a preview entry.
4. Adds one registry item definition with documentation and categories.
5. Runs the local validation and build command.
6. Opens a pull request.

CI reports actionable errors against the item definition or source path. Once
the pull request merges, the complete registry is rebuilt and deployed.

The repository must include a small asset template and contribution guide so a
maintainer can add an item without understanding the website internals.

## 11. Upstream Synchronization

### 11.1 Configuration

`upstreams.json` contains only allowlisted sources and items. Each source entry
records:

- Registry catalog or item URL
- Requested item names
- Pinned tag, commit, release, or other reproducible reference when the source
  supports one
- Whether registry dependencies should be mirrored recursively

If an upstream cannot expose a stable version reference, the synchronizer pins
the fetched content using its digest and records the source URL.

### 11.2 Synchronization behavior

The synchronizer:

1. Fetches the configured catalog and items.
2. Validates each response against the official schema.
3. Computes a content digest.
4. Converts inlined item contents into local, reviewable source files.
5. Adds provenance metadata.
6. Recursively mirrors the registry dependency closure when configured.
7. Rewrites mirrored dependencies to `@internal/{name}`.
8. Fails without writing changes if the dependency closure contains an external
   registry item that is not explicitly allowlisted for mirroring.
9. Produces a normal Git diff without publishing.

For the official shadcn registry, recursive mirroring is the default. This
prevents installation of an internal mirrored item from silently fetching
additional UI assets from the public registry.

The synchronizer never silently deletes the last known-good local item after a
fetch or validation failure. A failed synchronization exits unsuccessfully and
leaves the current source intact.

### 11.3 Review requirements

A synchronization pull request must make changes visible at source level and
identify:

- Added, changed, and removed files
- Changed npm dependencies
- Changed registry dependencies
- Changed provenance or digest
- New lifecycle or compatibility concerns

## 12. Build and Release Pipeline

Pull requests and the main branch run the same validation sequence:

1. Load the root registry and resolve includes.
2. Validate every item with official shadcn schemas.
3. Run internal consistency validation.
4. Generate preview and search manifests.
5. Run `shadcn build` into `public/r`.
6. Build and statically export the Next.js website.
7. Serve the static output temporarily.
8. Run shadcn CLI list, view, and add smoke tests against that server.
9. Run website end-to-end and accessibility checks.

Internal validation includes:

- Unique item names
- Existing source and preview files
- Valid file targets
- Resolvable registry dependencies
- An acyclic internal dependency graph
- Valid lifecycle and replacement metadata
- No preview file accidentally included in the install payload unless declared
  intentionally

The final static directory is the only deployable artifact. Deployment is
atomic. A failed build or upload leaves the previous complete release in place.

## 13. Error Handling

### 13.1 Build-time errors

Schema mismatches, duplicate names, missing files, invalid paths, dependency
cycles, compilation failures, and failed CLI contract tests block publication.

Errors should name the item, source definition, offending field or path, and
recommended correction when one can be determined.

### 13.2 Runtime website errors

- A preview error is contained within that preview.
- Missing optional documentation renders a concise empty state.
- A missing required generated item is treated as a build error, not handled as
  a partially broken production page.
- Copy actions provide visible success or failure feedback.

### 13.3 Upstream errors

Network errors, invalid schemas, unexpected dependency expansion, and changed
digests fail the synchronization command. They do not modify or remove the
currently published item.

## 14. Testing Strategy

### 14.1 Unit tests

Cover:

- Registry include expansion
- Internal path rules
- Dependency graph construction and cycle detection
- Lifecycle metadata validation
- Upstream normalization
- Dependency closure and namespace rewriting

### 14.2 Schema and contract tests

- Validate catalogs and items using current official shadcn schemas.
- Run the official build command.
- Test `list`, `view`, and `add` using the real shadcn CLI against a temporary
  static server and disposable consumer project.

### 14.3 Compilation and preview tests

- Compile every installable source file.
- Compile every preview entry.
- Render representative component, block, and template previews.
- Verify preview errors remain isolated.

### 14.4 Website end-to-end tests

Cover:

- Global search and keyboard access
- Directory navigation
- Detail-page anchors
- Preview/Code switching
- Theme selection
- Responsive preview controls
- New-tab preview route
- Installation-command copying

### 14.5 Accessibility and visual testing

Run automated accessibility checks on the global shell, asset directories,
detail pages, and preview toolbar. Use visual regression only for a small number
of structural layouts; avoid a large brittle screenshot suite.

## 15. Acceptance Criteria

The first release is acceptable when:

1. Adding an asset requires only source, preview, and one registry definition.
2. A documented build command produces one directly hostable static directory.
3. `shadcn list @internal`, `view @internal/button`, and
   `add @internal/button` succeed against that output.
4. Components, blocks, and templates can be searched, browsed, interactively
   previewed, and inspected as source.
5. An allowlisted upstream sync creates a clear source-level Git diff and keeps
   the current version intact on failure.
6. Invalid registry content is rejected before deployment.
7. A new maintainer can add an asset by following the contribution guide without
   reading website internals.
8. The repository remains a single static application with no database,
   persistent server, or unnecessary workspace orchestration.

## 16. Future Extension Points

The following may be added later without changing the first-release contract:

- CLI token authentication
- SSO for website access
- Multiple registries or brands
- Per-item version history
- Adoption telemetry
- A visual contribution flow that creates pull requests

These are extension points, not implied implementation work.
