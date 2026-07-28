import type { SearchDocument } from "./search-index"

export type SearchFilters = {
  type?: string
  category?: string
  status?: SearchDocument["status"]
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase()
}

function matchesFilters(document: SearchDocument, filters: SearchFilters) {
  return (!filters.type || document.type === filters.type)
    && (!filters.category || document.categories.includes(filters.category))
    && (!filters.status || document.status === filters.status)
}

function relevance(query: string, document: SearchDocument) {
  const name = normalize(document.name)
  const title = normalize(document.title)
  const description = normalize(document.description)
  const categories = document.categories.map(normalize)

  if (name === query) return 0
  if (title.startsWith(query)) return 1
  if (name.startsWith(query)) return 2
  if (categories.some((category) => category.includes(query))) return 3
  if (description.includes(query)) return 4
  if (title.includes(query)) return 5
  return Number.POSITIVE_INFINITY
}

/** Ranks static registry search documents without any network or service dependency. */
export function rankSearch(query: string, documents: SearchDocument[], filters: SearchFilters = {}) {
  const normalizedQuery = normalize(query)

  return documents
    .filter((document) => matchesFilters(document, filters))
    .map((document) => ({ document, rank: normalizedQuery ? relevance(normalizedQuery, document) : 0 }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((left, right) => left.rank - right.rank || left.document.name.localeCompare(right.document.name))
    .map(({ document }) => document)
}
