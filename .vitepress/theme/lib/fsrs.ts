// 自适应间隔重复算法：FSRS 启发的可记忆度公式 + SM-2 的 ease factor
// 目标保留率 0.9（下次复习时 90% 概率记得）
// 评级：1=没记住 / 2=模糊 / 3=记住 / 4=简单

export type Rating = 1 | 2 | 3 | 4

export interface CardState {
  id: string
  ease: number
  reps: number
  interval: number
  difficulty: number
  stability: number
  due: number
  lastReview: number | null
  reviews: number
  lapses: number
}

const DAY_MS = 86400000
const TARGET_R = 0.9

export function newCard(id: string, now = Date.now()): CardState {
  return {
    id,
    ease: 2.5,
    reps: 0,
    interval: 0,
    difficulty: 0.5,
    stability: 0.4,
    due: now,
    lastReview: null,
    reviews: 0,
    lapses: 0,
  }
}

export function retrievability(stability: number, tDays: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + tDays / (9 * stability), -1)
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

export function updateCard(card: CardState, rating: Rating, now = Date.now()): CardState {
  const tDays = card.lastReview ? (now - card.lastReview) / DAY_MS : 0
  const R = retrievability(card.stability, tDays)

  const dDelta = [0.25, 0.1, -0.05, -0.2][rating - 1]
  const difficulty = clamp(card.difficulty + dDelta - 0.15 * (R - TARGET_R), 0.1, 1)
  const D = difficulty

  let stability: number
  if (rating === 1) {
    stability = Math.max(0.1, card.stability * 0.2 * (1 - D))
  } else if (rating === 2) {
    stability = card.stability * (1.2 - D * 0.3)
  } else if (rating === 3) {
    stability = card.stability * (2.0 - D * 0.4) * (1 + (1 - R))
  } else {
    stability = card.stability * (3.0 - D * 0.5) * (1 + (1 - R) * 0.5)
  }
  stability = Math.max(0.1, stability)

  let ease = card.ease + [0, -0.2, -0.15, 0, 0.15][rating]
  if (rating === 1) ease = Math.max(1.3, ease - 0.2)
  ease = clamp(ease, 1.3, 3.5)

  const reps = rating === 1 ? 0 : card.reps + 1
  const lapses = card.lapses + (rating === 1 && card.reps > 0 ? 1 : 0)

  let intervalDays: number
  let dueOffset: number
  if (rating === 1) {
    intervalDays = 0
    dueOffset = 60000 // 1 分钟内重听
  } else if (reps === 1) {
    intervalDays = 1
    dueOffset = intervalDays * DAY_MS
  } else if (reps === 2) {
    intervalDays = 3
    dueOffset = intervalDays * DAY_MS
  } else {
    intervalDays = Math.max(1, stability)
    dueOffset = intervalDays * DAY_MS
  }

  return {
    ...card,
    difficulty,
    stability,
    ease,
    reps,
    lapses,
    reviews: card.reviews + 1,
    lastReview: now,
    interval: intervalDays,
    due: now + dueOffset,
  }
}

export function isDue(card: CardState | null, now = Date.now()): boolean {
  if (!card) return true
  return card.due <= now
}

export function nextIntervalLabel(card: CardState): string {
  const days = card.interval
  if (days === 0) return '1 分钟'
  if (days < 1) return `${Math.round(days * 24)} 小时`
  if (days === 1) return '1 天'
  if (days < 30) return `${Math.round(days)} 天`
  if (days < 365) return `${Math.round(days / 30)} 个月`
  return `${(days / 365).toFixed(1)} 年`
}
