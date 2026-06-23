'use server'

import { auth } from '@/auth'
import { AuthError } from '@/lib/errors'
import { getLatestThread } from '@/lib/advisor/persistence'

export interface LoadedThread {
  id: string
  messages: { id: string; role: 'user' | 'assistant'; content: string }[]
}

/** Client-facing: load the tenant's most recent advisor thread to seed the UI. */
export async function loadLatestThread(): Promise<LoadedThread | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new AuthError()
  const thread = await getLatestThread(session.user.tenantId)
  if (!thread) return null
  return {
    id: thread.id,
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  }
}
