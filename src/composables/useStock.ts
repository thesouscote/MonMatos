import type { Session } from '../types'

/**
 * Calcule la quantité disponible d'un item en tenant compte
 * des départs actifs non retournés.
 */
export function getAvailableQty(
  itemId: number,
  totalQty: number,
  sessions: Session[]
): number {
  const activeDeps = sessions.filter(s => s.phase === 'arrive' && !s.isReturned)
  let inUse = 0
  for (const session of activeDeps) {
    const snap = session.snapshot.find(s => s.id === itemId)
    if (snap) inUse += snap.taken ?? (snap.checked ? snap.qty : 0)
  }
  return Math.max(0, totalQty - inUse)
}

/**
 * Returns true if at least one item has available stock > 0
 */
export function hasAvailableStock(
  items: Array<{ id: number; qty: number; status: string }>,
  sessions: Session[]
): boolean {
  return items
    .filter(i => i.status === 'ok' || i.status === 'lent')
    .some(i => getAvailableQty(i.id, i.qty, sessions) > 0)
}
