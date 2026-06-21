import { CardState, newCard, Rating, updateCard } from './fsrs'

const CARDS_KEY = 'nw-srs-cards-v1'
const SETTINGS_KEY = 'nw-srs-settings-v1'

export interface Settings {
  rate: number
  voiceURI: string | null
  repeatMode: 'none' | 'sentence' | 'paragraph' | 'loop'
  repeatCount: number
  practiceMode: 'listen' | 'shadow' | 'recite'
  shadowPauseMultiplier: number
  skipLowWeight: boolean
  targetRetention: number
}

export const defaultSettings: Settings = {
  rate: 1.25,
  voiceURI: null,
  repeatMode: 'none',
  repeatCount: 1,
  practiceMode: 'listen',
  shadowPauseMultiplier: 1.5,
  skipLowWeight: false,
  targetRetention: 0.9,
}

interface DB {
  cards: Record<string, CardState>
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(CARDS_KEY)
    if (!raw) return { cards: {} }
    return JSON.parse(raw)
  } catch {
    return { cards: {} }
  }
}

function saveDB(db: DB) {
  try {
    localStorage.setItem(CARDS_KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('[store] save failed', e)
  }
}

export function getCard(id: string): CardState | null {
  return loadDB().cards[id] || null
}

export function getOrCreateCard(id: string): CardState {
  const db = loadDB()
  if (!db.cards[id]) {
    db.cards[id] = newCard(id)
    saveDB(db)
  }
  return db.cards[id]
}

export function rateCard(id: string, rating: Rating): CardState {
  const db = loadDB()
  if (!db.cards[id]) db.cards[id] = newCard(id)
  db.cards[id] = updateCard(db.cards[id], rating)
  saveDB(db)
  return db.cards[id]
}

export function recordListen(id: string): CardState {
  // 听读模式：轻量记录一次曝光，按 good 评级但只在次日到期前推进
  const db = loadDB()
  const existing = db.cards[id]
  if (!existing || existing.reviews === 0) {
    // 新卡或未评级过：仅打时间戳，不强行推进调度
    if (!existing) db.cards[id] = newCard(id)
    db.cards[id].lastReview = Date.now()
    saveDB(db)
    return db.cards[id]
  }
  // 已学过：按 good 评级温和推进
  db.cards[id] = updateCard(db.cards[id], 3)
  saveDB(db)
  return db.cards[id]
}

export function allCards(): CardState[] {
  return Object.values(loadDB().cards)
}

export function dueCount(now = Date.now()): number {
  return allCards().filter(c => c.due <= now).length
}

export function resetAll() {
  localStorage.removeItem(CARDS_KEY)
}

export function exportData(): string {
  return JSON.stringify(loadDB())
}

export function importData(json: string): void {
  const db = JSON.parse(json)
  saveDB(db)
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}
