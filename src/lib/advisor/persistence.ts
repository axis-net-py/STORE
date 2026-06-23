import prisma from '@/lib/prisma'

/** Latest thread for a tenant, with its messages in chronological order. */
export async function getLatestThread(tenantId: string) {
  return prisma.advisorThread.findFirst({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
}

/**
 * Resolve the thread for this turn. If the client supplied an id that belongs to
 * the tenant, reuse it; otherwise create a new thread (honoring a client-generated
 * id so it stays stable across the session).
 */
export async function getOrCreateThread(
  tenantId: string,
  threadId: string | undefined,
  firstText: string,
  userId?: string | null,
): Promise<string> {
  if (threadId) {
    const existing = await prisma.advisorThread.findFirst({
      where: { id: threadId, tenantId },
      select: { id: true },
    })
    if (existing) return existing.id
  }
  const title = firstText.trim().slice(0, 60) || 'Nova consulta'
  const created = await prisma.advisorThread.create({
    data: {
      ...(threadId ? { id: threadId } : {}),
      tenantId,
      userId: userId ?? null,
      title,
    },
    select: { id: true },
  })
  return created.id
}

/** Append one message to a thread (tenant-scoped). No-op if the thread isn't this tenant's or content is empty. */
export async function appendMessage(
  tenantId: string,
  args: { threadId: string; role: 'user' | 'assistant'; content: string; mentors?: string[]; sources?: unknown },
): Promise<void> {
  if (!args.content.trim()) return
  const thread = await prisma.advisorThread.findFirst({
    where: { id: args.threadId, tenantId },
    select: { id: true },
  })
  if (!thread) return
  await prisma.advisorMessage.create({
    data: {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      mentors: args.mentors ?? [],
      sources: (args.sources as object) ?? undefined,
    },
  })
  await prisma.advisorThread.update({
    where: { id: args.threadId },
    data: { updatedAt: new Date() },
  })
}
