// 构建脚本：解析 markdown 生成 narration JSON
// 优先用 narration/<path>.md 手写朗读源；否则回退到 reference/<path>.md 规则化转换
// 输出到 public/narration/<pagePath>.json

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CONTENT_DIRS = ['reference', '题库', '答题模板与速记卡']
const NARRATION_DIR = path.join(ROOT, 'narration')
const OUTPUT_DIR = path.join(ROOT, 'public', 'narration')

const md = new MarkdownIt({ html: true, linkify: false, typographer: false })

const EMOJI_RE = /[⭐🔥※✅❌→←↑↓★▲△○●□■▪▫·…—–✓✗]+/g
const MULTI_SPACE_RE = /\s+/g
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/

function walk(dir) {
  let out = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out = out.concat(walk(p))
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

function pagePathFromAbs(absPath) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/')
  return '/' + rel.replace(/\.md$/, '')
}

function narrationPathFor(pagePath) {
  const stripped = pagePath.replace(/^\/(reference|题库|答题模板与速记卡)\//, '')
  return path.join(NARRATION_DIR, stripped + '.md')
}

function stripFrontmatter(raw) {
  const m = raw.match(FRONTMATTER_RE)
  if (m) return raw.slice(m[0].length)
  return raw
}

function cleanText(s) {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 链接保留文本
    .replace(/`([^`]+)`/g, '$1')               // 行内代码保留文本
    .replace(EMOJI_RE, '')
    .replace(MULTI_SPACE_RE, ' ')
    .trim()
}

function splitSentences(text) {
  const out = []
  const re = /[^。！？!?；;\n]+[。！？!?；;]*/g
  let m
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim()
    if (s) out.push(s)
  }
  if (out.length === 0 && text.trim()) out.push(text.trim())
  return out
}

function detectWeight(text) {
  if (text.includes('🔥')) return 2
  if (text.includes('⭐')) return 1
  return 0
}

// 从 inline 文本中提取 **bold** 作为填空点
// 返回 { fullText, cloze, clozeAnswer }
function extractCloze(inlineContent) {
  const boldRe = /\*\*([^*]+)\*\*/
  const m = boldRe.exec(inlineContent)
  if (!m) {
    return { fullText: cleanText(inlineContent), cloze: undefined, clozeAnswer: undefined }
  }
  const answer = m[1]
  const fullText = inlineContent.replace(/\*\*([^*]+)\*\*/g, '$1')
  // 只把第一个 bold 替换成 ____，其余保留
  let firstReplaced = false
  const cloze = inlineContent.replace(/\*\*([^*]+)\*\*/g, (_, g1) => {
    if (!firstReplaced) {
      firstReplaced = true
      return '____'
    }
    return g1
  })
  return {
    fullText: cleanText(fullText),
    cloze: cleanText(cloze),
    clozeAnswer: answer,
  }
}

function parseFile(absPath, isNarration, originalPagePath) {
  const raw = stripFrontmatter(fs.readFileSync(absPath, 'utf-8'))
  const tokens = md.parse(raw, {})
  const pagePath = originalPagePath || pagePathFromAbs(absPath)
  const sections = []
  let currentSection = null
  let segIdx = 0
  let blockIdx = 0
  let inTable = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'table_open') { inTable = true; continue }
    if (t.type === 'table_close') { inTable = false; continue }
    if (inTable) continue
    if (t.type === 'fence' || t.type === 'code_block') continue

    if (t.type === 'heading_open') {
      const level = parseInt(t.tag.slice(1))
      const inline = tokens[i + 1]
      const text = cleanText(inline?.content || '')
      if (text) {
        currentSection = {
          anchor: text,
          level,
          weight: detectWeight(inline?.content || ''),
          segments: [],
        }
        sections.push(currentSection)
        segIdx = 0
      }
      continue
    }

    if (t.type === 'paragraph_open' || t.type === 'list_item_open' || t.type === 'blockquote_open') {
      const inline = tokens[i + 1]
      if (!inline || inline.type !== 'inline') continue
      const rawInline = inline.content
      if (!rawInline.trim()) continue

      blockIdx++
      const ownWeight = detectWeight(rawInline)
      const headingWeight = currentSection?.weight || 0
      const weight = Math.max(ownWeight, headingWeight)
      const clozeInfo = isNarration
        ? extractCloze(rawInline)
        : { fullText: cleanText(rawInline), cloze: undefined, clozeAnswer: undefined }
      const cleaned = clozeInfo.fullText
      if (cleaned.length < 4) continue

      const sentences = splitSentences(cleaned)
      sentences.forEach((s, sentIdx) => {
        const c = cleanText(s)
        if (c.length < 4) return
        if (!currentSection) {
          currentSection = { anchor: '', level: 1, weight: 0, segments: [] }
          sections.push(currentSection)
          segIdx = 0
        }
        let segCloze, segClozeAnswer
        if (isNarration && clozeInfo.cloze && sentIdx === 0) {
          // 句子级别 cloze：把清洗后的句子也做一次替换
          const sentCloze = clozeInfo.cloze
          if (sentCloze.includes('____') && sentCloze.includes(c.slice(0, Math.min(10, c.length)))) {
            segCloze = sentCloze
            segClozeAnswer = clozeInfo.clozeAnswer
          } else if (c.includes(clozeInfo.clozeAnswer || '\0')) {
            // 退化：直接在当前句替换答案
            segCloze = c.replace(clozeInfo.clozeAnswer, '____')
            segClozeAnswer = clozeInfo.clozeAnswer
          }
        }
        currentSection.segments.push({
          id: `${pagePath}#${currentSection.anchor || 'root'}-${segIdx++}`,
          text: c,
          heading: currentSection.anchor || '',
          blockIdx,
          weight,
          type: 'knowledge',
          cloze: segCloze,
          clozeAnswer: segClozeAnswer,
        })
      })
    }
  }

  return {
    pagePath,
    title: sections[0]?.anchor || path.basename(absPath, '.md'),
    sections: sections.filter(s => s.segments.length > 0 || s.level <= 2),
  }
}

function buildAll() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  let total = 0
  let narrationCount = 0
  for (const dir of CONTENT_DIRS) {
    const absDir = path.join(ROOT, dir)
    if (!fs.existsSync(absDir)) continue
    const files = walk(absDir)
    for (const file of files) {
      const pagePath = pagePathFromAbs(file)
      const narrationSrc = narrationPathFor(pagePath)
      const hasNarration = fs.existsSync(narrationSrc)
      const src = hasNarration ? narrationSrc : file
      const doc = parseFile(src, hasNarration, pagePath)
      const outPath = path.join(OUTPUT_DIR, pagePath + '.json')
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify(doc), 'utf-8')
      total++
      if (hasNarration) narrationCount++
    }
  }
  console.log(`[build-narration] generated ${total} files (${narrationCount} from narration sources)`)
}

function buildOne(absPath) {
  const pagePath = pagePathFromAbs(absPath)
  const narrationSrc = narrationPathFor(pagePath)
  const hasNarration = fs.existsSync(narrationSrc)
  const src = hasNarration ? narrationSrc : absPath
  const doc = parseFile(src, hasNarration, pagePath)
  const outPath = path.join(OUTPUT_DIR, pagePath + '.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(doc), 'utf-8')
  return pagePath
}

const cmd = process.argv[2]
if (cmd === 'watch') {
  // 单文件重建（被 Vite 插件调用）
  const target = process.argv[3]
  if (target) {
    buildOne(path.resolve(target))
    console.log(`[build-narration] rebuilt ${target}`)
  }
} else {
  buildAll()
}
