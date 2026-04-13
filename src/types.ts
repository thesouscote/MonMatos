// Types TypeScript pour MonMatos

export interface Item {
  id: number
  name: string
  cat: string
  qty: number
  status: 'ok' | 'repair' | 'lent' | 'lost'
  tags: string[]
  checkedArrive?: boolean
  checkedDepart?: boolean
  takenArrive?: number
  takenDepart?: number
  borrowedFrom?: string | null
}

export interface SessionSnapshot {
  id: number
  name: string
  cat: string
  qty: number
  taken: number
  checked: boolean
  borrowedFrom?: string | null
}

export interface Session {
  id: number
  name: string
  date: string
  phase: 'arrive' | 'depart'
  total: number
  checked: number
  snapshot: SessionSnapshot[]
  isReturned?: boolean
  linkedToDepartId?: number | null
}

export interface Template {
  id: number
  name: string
  itemIds: number[]
  createdAt: string
}

export interface BorrowedItem {
  _bid: number
  name: string
  borrowedFrom: string | null
  qty: number
  checkedDepart: boolean
  takenDepart?: number
}

export interface UserData {
  categories: string[]
  items: Item[]
  sessions: Session[]
  templates: Template[]
}

export type StatusType = Item['status']
export type ItemStatusInfo = { label: string; color: string; icon: string }

export const STATUS_MAP: Record<StatusType, ItemStatusInfo> = {
  ok:     { label: 'OK',           color: 'var(--accent)',   icon: '✓' },
  repair: { label: 'En réparation',color: 'var(--warn)',    icon: '🔧' },
  lent:   { label: 'Prêté',        color: '#8b5cf6',        icon: '↗' },
  lost:   { label: 'Perdu',        color: 'var(--danger)',  icon: '✗' },
}
