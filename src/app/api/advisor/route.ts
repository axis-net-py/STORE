import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { google } from '@ai-sdk/google'
import { auth } from '@/auth'
import { advisorModel } from '@/lib/advisor/model'
import { buildSystemPrompt } from '@/lib/advisor/system-prompt'
import { getOrCreateThread, appendMessage } from '@/lib/advisor/persistence'

export const maxDuration = 120

/** Concatenate the text parts of the most recent message of a given role. */
function lastText(messages: UIMessage[], role: 'user' | 'assistant'): string {
  const msg = [...messages].reverse().find((m) => m.role === role)
  if (!msg) return ''
  return (msg.parts ?? [])
    .map((p: { type: string; text?: string }) => (p.type === 'text' ? p.text ?? '' : ''))
    .join('')
    .trim()
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  const tenantId = session.user.tenantId
  const userId = (session.user as { id?: string }).id ?? null

  const { messages, threadId: incomingThreadId }: { messages: UIMessage[]; threadId?: string } =
    await req.json()

  const userText = lastText(messages, 'user')
  const threadId = await getOrCreateThread(tenantId, incomingThreadId, userText, userId)
  if (userText) await appendMessage(tenantId, { threadId, role: 'user', content: userText })

  const result = streamText({
    model: advisorModel(false),
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    stopWhen: stepCountIs(5),
  })

  // Consume the stream so onFinish (persistence) runs even if the client disconnects.
  result.consumeStream()

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[advisor] stream error:', msg)
      return msg || 'Erro ao consultar o Conselheiro. Tente novamente.'
    },
    onFinish: async ({ messages: finalMessages }) => {
      const assistantText = lastText(finalMessages as UIMessage[], 'assistant')
      if (assistantText) {
        await appendMessage(tenantId, { threadId, role: 'assistant', content: assistantText })
      }
    },
  })
}
