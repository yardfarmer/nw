// Web Speech API 封装
// 中文优先，支持语速/音色设置；onend/onerror 回调

let cachedVoices: SpeechSynthesisVoice[] = []

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!isSupported()) return []
  if (cachedVoices.length) return cachedVoices
  const all = window.speechSynthesis.getVoices()
  cachedVoices = all.filter(v => /zh|cmn|chinese/i.test(v.lang) || /chinese|中文|普通话/i.test(v.name))
  if (cachedVoices.length === 0) cachedVoices = all
  return cachedVoices
}

export function onVoicesChanged(cb: () => void): void {
  if (!isSupported()) return
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoices = []
    cb()
  })
}

export interface SpeakOptions {
  text: string
  rate?: number
  pitch?: number
  voiceURI?: string | null
  onstart?: () => void
  onend?: () => void
  onerror?: (e: SpeechSynthesisErrorEvent) => void
  onboundary?: (e: SpeechSynthesisEvent) => void
}

let currentUtterance: SpeechSynthesisUtterance | null = null

export function speak(opts: SpeakOptions): SpeechSynthesisUtterance | null {
  if (!isSupported()) {
    opts.onerror?.(new Event('error') as SpeechSynthesisErrorEvent)
    return null
  }
  // iOS Safari 需要 cancel 才能切到新句
  window.speechSynthesis.cancel()

  const u = new SpeechSynthesisUtterance(opts.text)
  u.lang = 'zh-CN'
  u.rate = opts.rate ?? 1
  u.pitch = opts.pitch ?? 1
  const voices = getVoices()
  if (opts.voiceURI) {
    const v = voices.find(v => v.voiceURI === opts.voiceURI)
    if (v) u.voice = v
  } else if (voices.length) {
    u.voice = voices[0]
  }
  if (opts.onstart) u.onstart = opts.onstart
  if (opts.onend) u.onend = opts.onend
  if (opts.onerror) u.onerror = opts.onerror
  if (opts.onboundary) u.onboundary = opts.onboundary

  currentUtterance = u
  window.speechSynthesis.speak(u)
  return u
}

export function stopSpeaking(): void {
  if (!isSupported()) return
  currentUtterance = null
  window.speechSynthesis.cancel()
}

export function pauseSpeaking(): void {
  if (!isSupported()) return
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause()
  }
}

export function resumeSpeaking(): void {
  if (!isSupported()) return
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume()
  }
}

export function isSpeaking(): boolean {
  return isSupported() && window.speechSynthesis.speaking
}

// 估算朗读时长（毫秒），用于跟读模式静音窗口
// 中文约 5 字/秒（1x），实际随 rate 变化
export function estimateDurationMs(text: string, rate: number): number {
  const charCount = text.length
  const baseCharsPerSec = 5
  return Math.max(800, (charCount / baseCharsPerSec) * 1000 / rate)
}

// 唤醒锁：防止移动端锁屏暂停 speechSynthesis（best-effort）
let wakeLock: any = null

export async function requestWakeLock(): Promise<void> {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await (navigator as any).wakeLock.request('screen')
    }
  } catch {
    // 忽略
  }
}

export function releaseWakeLock(): void {
  try {
    wakeLock?.release?.()
    wakeLock = null
  } catch {
    // 忽略
  }
}
