<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vitepress'
import {
  Segment,
  Section,
  fetchNarration,
  flattenSections,
  sectionBoundaries,
} from '../lib/narration'
import * as audio from '../lib/audio'
import * as store from '../lib/store'
import * as fsrs from '../lib/fsrs'

const route = useRoute()

const doc = ref<Awaited<ReturnType<typeof fetchNarration>>>(null)
const segments = ref<Segment[]>([])
const bounds = ref<{ start: number; end: number; section: Section }[]>([])
const currentIdx = ref(0)
const isPlaying = ref(false)
const isPaused = ref(false)
const settings = ref<store.Settings>(store.defaultSettings)
const voices = ref<SpeechSynthesisVoice[]>([])
const showSettings = ref(false)
const showList = ref(false)
const showRating = ref(false)
const repeatCounter = ref(0)
const paragraphRepeatCounter = ref(0)
const lastRating = ref<fsrs.Rating | null>(null)
const currentCardState = ref<fsrs.CardState | null>(null)
const shadowPauseTimer = ref<number | null>(null)
const isReviewing = ref(false)
const reviewQueue = ref<number[]>([])
const statusMsg = ref('')
const containerRef = ref<HTMLElement | null>(null)

const hasContent = computed(() => segments.value.length > 0)
const currentSegment = computed<Segment | null>(
  () => segments.value[currentIdx.value] || null
)
const currentSectionTitle = computed(() => currentSegment.value?.heading || '')
const dueInQueue = computed(() => reviewQueue.value.length)

function findBlockStart(idx: number): number {
  const seg = segments.value[idx]
  if (!seg) return idx
  let i = idx
  while (i > 0 && segments.value[i - 1].blockIdx === seg.blockIdx) i--
  return i
}
function findBlockEnd(idx: number): number {
  const seg = segments.value[idx]
  if (!seg) return idx
  let i = idx
  while (i < segments.value.length - 1 && segments.value[i + 1].blockIdx === seg.blockIdx) i++
  return i
}

async function loadPage(rawPath: string) {
  audio.stopSpeaking()
  isPlaying.value = false
  showRating.value = false
  isReviewing.value = false
  reviewQueue.value = []
  statusMsg.value = ''

  // 规范化 path：去 base 前缀、去 .html、解 URL 编码
  const base = import.meta.env.BASE_URL || '/'
  let p = rawPath
  if (base !== '/' && p.startsWith(base)) p = p.slice(base.length)
  if (!p.startsWith('/')) p = '/' + p
  try { p = decodeURIComponent(p) } catch {}
  p = p.replace(/\.html$/, '').replace(/\/index$/, '/') || '/'

  const d = await fetchNarration(p)
  doc.value = d
  if (!d) {
    segments.value = []
    bounds.value = []
    return
  }
  segments.value = flattenSections(d)
  bounds.value = sectionBoundaries(d)
  currentIdx.value = 0
  repeatCounter.value = 0
  paragraphRepeatCounter.value = 0
}

onMounted(async () => {
  settings.value = store.loadSettings()
  voices.value = audio.getVoices()
  audio.onVoicesChanged(() => {
    voices.value = audio.getVoices()
  })
  await loadPage(route.path)
})

onUnmounted(() => {
  audio.stopSpeaking()
  audio.releaseWakeLock()
  if (shadowPauseTimer.value) clearTimeout(shadowPauseTimer.value)
})

watch(
  () => route.path,
  async (p) => {
    await loadPage(p)
  }
)

watch(settings, (s) => store.saveSettings(s), { deep: true })

watch(hasContent, (v) => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('has-smart-player', v)
})

// === 朗读 ===
function startSpeaking(text: string) {
  audio.speak({
    text,
    rate: settings.value.rate,
    voiceURI: settings.value.voiceURI,
    onend: handleUtteranceEnd,
    onerror: () => {
      isPlaying.value = false
      statusMsg.value = '语音播放失败'
    },
  })
}

function handleUtteranceEnd() {
  if (shadowPauseTimer.value) {
    clearTimeout(shadowPauseTimer.value)
    shadowPauseTimer.value = null
  }

  // 背诵模式：播完等待评分，不自动推进
  if (settings.value.practiceMode === 'recite' && isReviewing.value) {
    showRating.value = true
    isPlaying.value = false
    return
  }

  const seg = currentSegment.value
  if (!seg) {
    isPlaying.value = false
    return
  }

  // 跟读模式：播一句 → 静音 → 重播一次 → 下一句
  if (settings.value.practiceMode === 'shadow') {
    if (repeatCounter.value === 0) {
      repeatCounter.value = 1
      const pauseMs = audio.estimateDurationMs(seg.text, settings.value.rate) * settings.value.shadowPauseMultiplier
      statusMsg.value = '请跟读…'
      shadowPauseTimer.value = window.setTimeout(() => {
        statusMsg.value = ''
        startSpeaking(seg.text)
      }, pauseMs)
      return
    }
    repeatCounter.value = 0
    advance()
    return
  }

  // 听读模式：按 repeatMode 处理
  const mode = settings.value.repeatMode
  const count = Math.max(1, settings.value.repeatCount)

  if (mode === 'sentence') {
    if (repeatCounter.value < count - 1) {
      repeatCounter.value++
      startSpeaking(seg.text)
      return
    }
    repeatCounter.value = 0
    advance()
    return
  }

  if (mode === 'paragraph') {
    const blockEnd = findBlockEnd(currentIdx.value)
    if (currentIdx.value < blockEnd) {
      currentIdx.value++
      startSpeaking(currentSegment.value!.text)
      return
    }
    if (paragraphRepeatCounter.value < count - 1) {
      paragraphRepeatCounter.value++
      currentIdx.value = findBlockStart(currentIdx.value)
      startSpeaking(currentSegment.value!.text)
      return
    }
    paragraphRepeatCounter.value = 0
    // 下一段
    const next = blockEnd + 1
    if (next >= segments.value.length) {
      isPlaying.value = false
      statusMsg.value = '本页播放完毕'
      return
    }
    currentIdx.value = next
    startSpeaking(currentSegment.value!.text)
    return
  }

  if (mode === 'loop') {
    const next = (currentIdx.value + 1) % segments.value.length
    currentIdx.value = next
    startSpeaking(currentSegment.value!.text)
    return
  }

  // none
  advance()
}

function advance() {
  if (isReviewing.value) {
    // 复习模式由评分推进
    return
  }
  const next = currentIdx.value + 1
  if (next >= segments.value.length) {
    isPlaying.value = false
    statusMsg.value = '本页播放完毕'
    return
  }
  currentIdx.value = next
  startSpeaking(currentSegment.value!.text)
}

// === 控制按钮 ===
function togglePlay() {
  if (!hasContent.value) return
  if (isPlaying.value) {
    audio.stopSpeaking()
    isPlaying.value = false
    isPaused.value = false
    if (shadowPauseTimer.value) {
      clearTimeout(shadowPauseTimer.value)
      shadowPauseTimer.value = null
    }
    return
  }
  // 启动
  audio.requestWakeLock()
  isPlaying.value = true
  isPaused.value = false
  statusMsg.value = ''

  if (settings.value.practiceMode === 'recite') {
    startReviewSession()
    return
  }

  const seg = currentSegment.value
  if (seg) startSpeaking(seg.text)
}

function jumpTo(idx: number) {
  if (idx < 0 || idx >= segments.value.length) return
  audio.stopSpeaking()
  if (shadowPauseTimer.value) {
    clearTimeout(shadowPauseTimer.value)
    shadowPauseTimer.value = null
  }
  currentIdx.value = idx
  repeatCounter.value = 0
  paragraphRepeatCounter.value = 0
  if (isPlaying.value) {
    startSpeaking(currentSegment.value!.text)
  }
}

function prev() {
  jumpTo(Math.max(0, currentIdx.value - 1))
}
function next() {
  jumpTo(Math.min(segments.value.length - 1, currentIdx.value + 1))
}
function replay() {
  jumpTo(currentIdx.value)
}

// === 复习模式 ===
function startReviewSession() {
  const now = Date.now()
  const queue: { idx: number; due: number; weight: number }[] = []
  segments.value.forEach((seg, idx) => {
    if (settings.value.skipLowWeight && seg.weight === 0) return
    const card = store.getCard(seg.id)
    const due = card ? card.due : 0
    if (due <= now) {
      queue.push({ idx, due, weight: seg.weight })
    }
  })
  queue.sort((a, b) => {
    if (a.due !== b.due) return a.due - b.due
    if (a.weight !== b.weight) return b.weight - a.weight
    return a.idx - b.idx
  })
  reviewQueue.value = queue.map(q => q.idx)

  if (reviewQueue.value.length === 0) {
    isPlaying.value = false
    statusMsg.value = '当前页无到期卡片，可切换浏览模式'
    return
  }
  isReviewing.value = true
  currentIdx.value = reviewQueue.value[0]
  showRating.value = false
  const seg = currentSegment.value!
  currentCardState.value = store.getOrCreateCard(seg.id)
  statusMsg.value = `复习中：1 / ${reviewQueue.value.length}`
  // 背诵模式：先播 cloze 提示版，等评分后再播完整版？
  // 简化：直接播完整版，用户评分别
  startSpeaking(seg.text)
}

function rateCard(rating: fsrs.Rating) {
  const seg = currentSegment.value
  if (!seg) return
  const updated = store.rateCard(seg.id, rating)
  currentCardState.value = updated
  lastRating.value = rating

  // 从队列移除
  reviewQueue.value = reviewQueue.value.filter(i => i !== currentIdx.value)
  if (reviewQueue.value.length === 0) {
    isPlaying.value = false
    showRating.value = false
    isReviewing.value = false
    statusMsg.value = '本页复习完成 🎉'
    return
  }
  currentIdx.value = reviewQueue.value[0]
  showRating.value = false
  const next = currentSegment.value!
  currentCardState.value = store.getOrCreateCard(next.id)
  statusMsg.value = `复习中：${reviewQueue.value.length} 张待复习`
  startSpeaking(next.text)
}

// === 章节聚焦 ===
const sectionOptions = computed(() => {
  return bounds.value.map((b, i) => ({
    idx: i,
    label: b.section.anchor || `段 ${i + 1}`,
    start: b.start,
    end: b.end,
  }))
})
const currentSectionIdx = ref(0)

function focusSection(idx: number) {
  const b = bounds.value[idx]
  if (!b) return
  // 跳到该 section 第一句
  jumpTo(b.start)
  currentSectionIdx.value = idx
}

// === 设置 ===
function closePanels() {
  showSettings.value = false
  showList.value = false
}

const dueCount = computed(() => store.dueCount())
</script>

<template>
  <div v-if="hasContent" class="smart-player" ref="containerRef">
    <!-- 当前进度条 -->
    <div class="sp-progress">
      <div
        class="sp-progress__bar"
        :style="{ width: segments.length ? ((currentIdx + 1) / segments.length) * 100 + '%' : '0%' }"
      />
    </div>

    <!-- 当前提文 -->
    <div class="sp-now" @click="showList = !showList">
      <div class="sp-now__text" :title="currentSegment?.text">
        {{ currentSegment?.text || '点击播放开始' }}
      </div>
      <div class="sp-now__meta">
        <span>{{ currentIdx + 1 }}/{{ segments.length }}</span>
        <span v-if="currentSegment?.weight === 2" class="sp-tag sp-tag--hot">🔥重点</span>
        <span v-else-if="currentSegment?.weight === 1" class="sp-tag sp-tag--star">⭐</span>
        <span v-if="statusMsg" class="sp-status">{{ statusMsg }}</span>
      </div>
    </div>

    <!-- 评分行（背诵模式 + 等待评分时显示） -->
    <div v-if="showRating" class="sp-rating">
      <button class="sp-rate sp-rate--1" @click="rateCard(1)">没记住</button>
      <button class="sp-rate sp-rate--2" @click="rateCard(2)">模糊</button>
      <button class="sp-rate sp-rate--3" @click="rateCard(3)">记住</button>
      <button class="sp-rate sp-rate--4" @click="rateCard(4)">简单</button>
    </div>

    <!-- 主控按钮 -->
    <div class="sp-controls">
      <button class="sp-btn" @click="prev" title="上一句">⏮</button>
      <button class="sp-btn sp-btn--play" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button class="sp-btn" @click="next" title="下一句">⏭</button>
      <button class="sp-btn" @click="replay" title="重播本句">↻</button>

      <select v-model="settings.practiceMode" class="sp-select" title="练习模式">
        <option value="listen">听读</option>
        <option value="shadow">跟读</option>
        <option value="recite">背诵</option>
      </select>

      <select v-model="settings.repeatMode" class="sp-select" title="重复模式">
        <option value="none">单遍</option>
        <option value="sentence">句×N</option>
        <option value="paragraph">段×N</option>
        <option value="loop">循环</option>
      </select>

      <input
        v-if="settings.repeatMode === 'sentence' || settings.repeatMode === 'paragraph'"
        type="number"
        min="1"
        max="10"
        v-model.number="settings.repeatCount"
        class="sp-num"
        title="重复次数"
      />

      <button class="sp-btn" @click="showSettings = !showSettings" title="设置">⚙</button>
      <button class="sp-btn" @click="showList = !showList" title="句子列表">📚</button>
    </div>

    <!-- 设置面板 -->
    <div v-if="showSettings" class="sp-panel">
      <div class="sp-panel__row">
        <label>语速 {{ settings.rate.toFixed(2) }}x</label>
        <input type="range" min="0.5" max="2.5" step="0.05" v-model.number="settings.rate" />
      </div>
      <div class="sp-panel__row">
        <label>语音</label>
        <select v-model="settings.voiceURI" class="sp-select">
          <option :value="null">系统默认</option>
          <option v-for="v in voices" :key="v.voiceURI" :value="v.voiceURI">{{ v.name }}</option>
        </select>
      </div>
      <div class="sp-panel__row" v-if="settings.practiceMode === 'shadow'">
        <label>跟读静音 {{ settings.shadowPauseMultiplier.toFixed(1) }}x</label>
        <input type="range" min="0.5" max="3" step="0.1" v-model.number="settings.shadowPauseMultiplier" />
      </div>
      <div class="sp-panel__row">
        <label>
          <input type="checkbox" v-model="settings.skipLowWeight" />
          背诵模式跳过非重点
        </label>
      </div>
      <div class="sp-panel__row sp-panel__stats">
        <span>全局待复习：{{ dueCount }} 张</span>
      </div>
    </div>

    <!-- 句子列表 -->
    <div v-if="showList" class="sp-list">
      <div class="sp-list__head">
        <select v-model="currentSectionIdx" @change="focusSection(currentSectionIdx)" class="sp-select">
          <option v-for="s in sectionOptions" :key="s.idx" :value="s.idx">📌 {{ s.label }}</option>
        </select>
        <button class="sp-btn" @click="showList = false">收起</button>
      </div>
      <div class="sp-list__items">
        <div
          v-for="(s, i) in segments"
          :key="s.id"
          class="sp-list__item"
          :class="{ 'is-active': i === currentIdx, 'is-hot': s.weight === 2, 'is-star': s.weight === 1 }"
          @click="jumpTo(i)"
        >
          <span class="sp-list__idx">{{ i + 1 }}</span>
          <span class="sp-list__text">{{ s.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.smart-player {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
  padding: 8px 12px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
  font-size: 14px;
}

.sp-progress {
  height: 2px;
  background: var(--vp-c-divider);
  margin: -8px -12px 6px;
}
.sp-progress__bar {
  height: 100%;
  background: var(--vp-c-brand, #c0392b);
  transition: width 0.2s;
}

.sp-now {
  cursor: pointer;
  padding: 4px 0;
}
.sp-now__text {
  font-size: 14px;
  line-height: 1.4;
  max-height: 2.8em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.sp-now__meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin-top: 2px;
}
.sp-tag {
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
}
.sp-tag--hot {
  background: rgba(231, 76, 60, 0.15);
  color: #c0392b;
}
.sp-tag--star {
  background: rgba(241, 196, 15, 0.2);
  color: #b8860b;
}
.sp-status {
  margin-left: auto;
  color: var(--vp-c-brand, #c0392b);
}

.sp-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.sp-btn {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 16px;
  cursor: pointer;
  min-width: 40px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.sp-btn--play {
  background: var(--vp-c-brand, #c0392b);
  color: #fff;
  border-color: transparent;
  font-size: 18px;
  padding: 8px 14px;
}
.sp-select {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 13px;
  min-height: 40px;
  max-width: 90px;
}
.sp-num {
  width: 50px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  border-radius: 8px;
  padding: 6px;
  font-size: 13px;
  text-align: center;
  min-height: 40px;
}

.sp-rating {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 6px 0;
}
.sp-rate {
  padding: 10px 4px;
  border-radius: 8px;
  border: none;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  min-height: 44px;
}
.sp-rate--1 { background: #c0392b; }
.sp-rate--2 { background: #e67e22; }
.sp-rate--3 { background: #27ae60; }
.sp-rate--4 { background: #2980b9; }

.sp-panel {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 10px;
  margin-top: 6px;
}
.sp-panel__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 13px;
}
.sp-panel__row label {
  color: var(--vp-c-text-2);
}
.sp-panel__row input[type='range'] {
  width: 100%;
}
.sp-panel__stats {
  color: var(--vp-c-text-2);
  font-size: 12px;
}

.sp-list {
  margin-top: 6px;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 6px;
}
.sp-list__head {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}
.sp-list__head .sp-select {
  flex: 1;
  max-width: none;
}
.sp-list__items {
  max-height: 40vh;
  overflow-y: auto;
}
.sp-list__item {
  display: flex;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  border-left: 3px solid transparent;
}
.sp-list__item.is-active {
  background: var(--vp-c-bg-soft);
  border-left-color: var(--vp-c-brand, #c0392b);
}
.sp-list__item.is-hot {
  background: rgba(231, 76, 60, 0.05);
}
.sp-list__item.is-star {
  background: rgba(241, 196, 15, 0.05);
}
.sp-list__idx {
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.sp-list__text {
  flex: 1;
}

@media (min-width: 768px) {
  .smart-player {
    max-width: 768px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 12px 12px 0 0;
  }
}
</style>

<style>
/* 全局：播放器显示时为底部留空间 */
body.has-smart-player {
  padding-bottom: 160px;
}
@media (max-width: 767px) {
  body.has-smart-player {
    padding-bottom: 200px;
  }
}
</style>
