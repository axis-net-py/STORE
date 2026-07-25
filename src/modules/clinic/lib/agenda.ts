// Helpers puros da agenda — sem dependências, testável com `node --test`.

export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 20
export const SLOT_MINUTES = 30
export const DAY_TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60

/** Dois intervalos [aStart,aEnd) e [bStart,bEnd) se sobrepõem? */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** Segunda-feira 00:00 da semana da data (semana começa na segunda). */
export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = r.getDay() // 0=dom
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Minutos desde DAY_START_HOUR (pode ser negativo/estourar — chamador clampa). */
export function minutesIntoDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() - DAY_START_HOUR * 60
}

/** Posição vertical do bloco no grid, em % do dia visível. */
export function blockPosition(startsAt: Date, endsAt: Date): { topPct: number; heightPct: number } {
  const start = Math.max(0, minutesIntoDay(startsAt))
  const end = Math.min(DAY_TOTAL_MINUTES, minutesIntoDay(endsAt))
  return {
    topPct: (start / DAY_TOTAL_MINUTES) * 100,
    heightPct: (Math.max(end - start, 15) / DAY_TOTAL_MINUTES) * 100,
  }
}

export type WorkingHours = Record<string, [string, string][]>

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function dayKey(d: Date): string {
  return DAY_KEYS[d.getDay()]
}

/** Horário (HH:mm em minutos) está dentro de alguma faixa de trabalho do dia? Sem workingHours = sempre dentro. */
export function isWithinWorkingHours(wh: WorkingHours | null | undefined, d: Date): boolean {
  if (!wh) return true
  const ranges = wh[dayKey(d)]
  if (!ranges || ranges.length === 0) return false
  const min = d.getHours() * 60 + d.getMinutes()
  return ranges.some(([from, to]) => {
    const [fh, fm] = from.split(':').map(Number)
    const [th, tm] = to.split(':').map(Number)
    return min >= fh * 60 + fm && min < th * 60 + tm
  })
}
