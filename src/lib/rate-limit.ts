/**
 * Rate limiter em memória (janela deslizante) para proteger o login de força bruta.
 *
 * Em ambiente serverless a memória é por instância, então o limite real pode ser
 * um pouco mais frouxo que o configurado — ainda assim elimina ataques triviais.
 * Para garantia forte em produção multi-instância, trocar por um armazenamento
 * compartilhado (ex.: Upstash Redis) mantendo esta mesma interface.
 */

type Entry = { attempts: number[]; }

const store = new Map<string, Entry>()

const WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const MAX_ATTEMPTS = 5

export function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry) return false
  entry.attempts = entry.attempts.filter((t) => now - t < WINDOW_MS)
  return entry.attempts.length >= MAX_ATTEMPTS
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now()
  const entry = store.get(key) ?? { attempts: [] }
  entry.attempts = entry.attempts.filter((t) => now - t < WINDOW_MS)
  entry.attempts.push(now)
  store.set(key, entry)

  // Higiene: não deixar o mapa crescer indefinidamente
  if (store.size > 10000) {
    for (const [k, v] of store) {
      if (v.attempts.every((t) => now - t >= WINDOW_MS)) store.delete(k)
    }
  }
}

export function clearAttempts(key: string): void {
  store.delete(key)
}
