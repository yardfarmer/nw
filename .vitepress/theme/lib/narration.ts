// 运行时按 route.path 拉取 narration JSON
// JSON 由构建脚本生成在 public/narration/<pagePath>.json

export interface Segment {
  id: string
  text: string
  heading: string
  blockIdx: number
  weight: number          // 0/1/2，来源 ⭐🔥
  type: 'knowledge' | 'mnemonic' | 'qa' | 'contrast'
  cloze?: string          // 挖空版
  clozeAnswer?: string    // 被挖空的答案
  sourceLine?: number
}

export interface Section {
  anchor: string
  level: number
  weight: number
  segments: Segment[]
}

export interface NarrationDoc {
  pagePath: string
  title: string
  sections: Section[]
}

const cache = new Map<string, NarrationDoc | null>()

export async function fetchNarration(pagePath: string): Promise<NarrationDoc | null> {
  if (cache.has(pagePath)) return cache.get(pagePath)!

  const base = import.meta.env.BASE_URL || '/'
  // 每段单独 encode，保留 /
  const encoded = pagePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  const url = `${base}narration${encoded}.json`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      cache.set(pagePath, null)
      return null
    }
    const doc = (await res.json()) as NarrationDoc
    cache.set(pagePath, doc)
    return doc
  } catch (e) {
    console.warn('[narration] fetch failed', url, e)
    cache.set(pagePath, null)
    return null
  }
}

export function flattenSections(doc: NarrationDoc): Segment[] {
  const out: Segment[] = []
  for (const sec of doc.sections) {
    for (const seg of sec.segments) {
      out.push(seg)
    }
  }
  return out
}

export function sectionBoundaries(doc: NarrationDoc): { start: number; end: number; section: Section }[] {
  const bounds: { start: number; end: number; section: Section }[] = []
  let cursor = 0
  for (const sec of doc.sections) {
    const len = sec.segments.length
    if (len > 0) {
      bounds.push({ start: cursor, end: cursor + len - 1, section: sec })
      cursor += len
    }
  }
  return bounds
}
