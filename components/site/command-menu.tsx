"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command"
import { Dialog, DialogContent, DialogTitle } from "@/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { rankSearch, type SearchFilters } from "@/src/registry/search"
import type { SearchDocument } from "@/src/registry/search-index"
import { withBasePath } from "@/src/base-path"

type CommandMenuProps = {
  open: boolean
  onOpenChange(open: boolean): void
  onNavigate?(href: string): void
}

const ALL = "__all__"

function navigateToAsset(href: string) {
  window.location.assign(href)
}

export function CommandMenu({ open, onOpenChange, onNavigate = navigateToAsset }: CommandMenuProps) {
  const [documents, setDocuments] = useState<SearchDocument[]>([])
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({})
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!open || hasLoaded) return

    let cancelled = false
    setLoadError(false)
    fetch(withBasePath("/search-index.json"))
      .then((response) => {
        if (!response.ok) throw new Error("无法加载搜索索引")
        return response.json() as Promise<SearchDocument[]>
      })
      .then((items) => {
        if (!cancelled) {
          setDocuments(items)
          setHasLoaded(true)
          setLoadError(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">搜索资产</DialogTitle>
        <Command shouldFilter={false} label="搜索资产">
          <CommandInput placeholder="搜索组件、区块或模板" value={query} onValueChange={setQuery} />
          <div className="flex gap-2 border-b px-3 py-2" aria-label="筛选资产">
            <FilterSelect label="类型" placeholder="全部类型" values={types} value={filters.type} onChange={(type) => setFilters((current) => ({ ...current, type }))} />
            <FilterSelect label="分类" placeholder="全部分类" values={categories} value={filters.category} onChange={(category) => setFilters((current) => ({ ...current, category }))} />
            <FilterSelect label="状态" placeholder="全部状态" values={statuses} value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status: status as SearchDocument["status"] | undefined }))} />
          </div>
          <CommandList label="搜索结果">
            {loadError ? <p className="m-3 text-sm text-muted-foreground">搜索索引加载失败，请稍后重试。</p> : null}
            {!loadError && !hasLoaded ? <p className="m-3 text-sm text-muted-foreground">正在加载资产…</p> : null}
            {hasLoaded && !loadError ? (
              <>
                <CommandEmpty>没有匹配的资产。</CommandEmpty>
                <CommandGroup>
                  {results.map((result) => (
                    <CommandItem key={result.name} value={result.name} onSelect={() => onNavigate(withBasePath(result.href))}>
                      <span>
                        <strong>{result.title}</strong>
                        <small className="block text-muted-foreground">{result.description}</small>
                      </span>
                      <small className="text-muted-foreground">{result.status}</small>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function FilterSelect({ label, placeholder, values, value, onChange }: {
  label: string
  placeholder: string
  values: string[]
  value: string | undefined
  onChange(value: string | undefined): void
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
      <SelectTrigger aria-label={label} size="sm" className="w-32">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {values.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
