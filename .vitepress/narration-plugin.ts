// Vite 插件：dev 模式启动时全量构建 narration JSON；
// 监听 reference/ narration/ 题... 等 .md 变更，增量重建对应 JSON 并触发页面重载

import { Plugin } from 'vite'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = process.cwd()
const WATCH_DIRS = ['reference', '题库', '答题模板与速记卡', 'narration'].map(d => path.join(ROOT, d))

function runBuildAll() {
  return new Promise<void>((resolve) => {
    const p = spawn('node', ['scripts/build-narration.mjs'], { cwd: ROOT, stdio: 'inherit' })
    p.on('close', () => resolve())
  })
}

function runBuildOne(file: string) {
  return new Promise<void>((resolve) => {
    const p = spawn('node', ['scripts/build-narration.mjs', 'watch', file], { cwd: ROOT, stdio: 'inherit' })
    p.on('close', () => resolve())
  })
}

export function narrationPlugin(): Plugin {
  let server: any = null

  return {
    name: 'narration-builder',
    configureServer(s) {
      server = s
      runBuildAll().then(() => {
        // 重新读取已存在的 narration JSON 让浏览器拉新
      })
      s.watcher.add(WATCH_DIRS)
      s.watcher.on('change', (file) => {
        if (!file.endsWith('.md')) return
        if (!WATCH_DIRS.some(d => file.startsWith(d + path.sep))) return
        runBuildOne(file).then(() => {
          // 通知浏览器重载当前页（重新 fetch narration JSON）
          s.ws.send({ type: 'full-reload' })
        })
      })
      s.watcher.on('add', (file) => {
        if (!file.endsWith('.md')) return
        if (!WATCH_DIRS.some(d => file.startsWith(d + path.sep))) return
        runBuildOne(file).then(() => {
          s.ws.send({ type: 'full-reload' })
        })
      })
    },
    buildStart() {
      // 生产构建前全量生成
      if (process.env.NODE_ENV === 'production' || !server) {
        return new Promise<void>((resolve) => {
          // 仅在输出目录不存在或为空时跑；否则跳过（已在 docs:build 前通过 prebuild 跑过）
          const outDir = path.join(ROOT, 'public', 'narration')
          const exists = fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0
          if (exists) {
            // 强制重建以保证最新
          }
          runBuildAll().then(() => resolve())
        })
      }
    },
  }
}
