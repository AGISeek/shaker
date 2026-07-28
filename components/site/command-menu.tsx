"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { rankSearch, type SearchFilters } from "@/src/registry/search"
import type { SearchDocument } from "@/src/registry/search-index"

type CommandMenuProps = {
  open: boolean
  onOpenChange(open: boolean): void
}

const initialFilters: SearchFilters = {}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const [documents, setDocuments] = useState<SearchDocument[]>([])
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    inputRef.current?.focus()
    if (hasLoaded) return

    let cancelled = false
    fetch("/search-index.json")
      .then((response) => {
        if (!response.ok) throw new Error("无法加载搜索索引")
        return response.json() as Promise<SearchDocument[]>
      })
      .then((items) => {
        if (!cancelled) {
          setDocuments(items)
          setHasLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => { cancelled = true }
  }, [hasLoaded, open])

  const results = useMemo(() => rankSearch(query, documents, filters), [documents, filters, query])
  const types = useMemo(() => [...new Set(documents.map((item) => item.type))].sort(), [documents])
  const categories = useMemo(() => [...new Set(documents.flatMap((item) => item.categories))].sort(), [documents])
  const statuses = useMemo(() => [...new Set(documents.map((item) => item.status))].sort(), [documents])

  useEffect(() => { setActiveIndex(0) }, [filters, query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
      }
      if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault()
        window.location.assign(results[activeIndex].href)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeIndex, onOpenChange, open, results])

  if (!open) return null

  return (
    <div className="command-menu-backdrop" role="presentation" onMouseDown={() => onOpenChange(false)}>
      <section className="command-menu" role="dialog" aria-modal="true" aria-label="搜索资产" onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-menu__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索组件、区块或模板"
          aria-label="搜索资产"
        />
        <div className="command-menu__filters" aria-label="筛选资产">
          <select aria-label="类型" value={filters.type ?? ""} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value || undefined }))}>
            <option value="">全部类型</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select aria-label="分类" value={filters.category ?? ""} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value || undefined }))}>
            <option value="">全部分类</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select aria-label="状态" value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as SearchDocument["status"] || undefined }))}>
            <option value="">全部状态</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="command-menu__results" role="listbox" aria-label="搜索结果">
          {loadError && <p>搜索索引加载失败，请稍后重试。</p>}
          {!loadError && !hasLoaded && <p>正在加载资产…</p>}
          {hasLoaded && results.length === 0 && <p>没有匹配的资产。</p>}
          {results.map((result, index) => (
            <a
              key={result.name}
              className={index === activeIndex ? "command-menu__result is-active" : "command-menu__result"}
              href={result.href}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span><strong>{result.title}</strong><small>{result.description}</small></span>
              <small>{result.status}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
