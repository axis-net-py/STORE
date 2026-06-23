'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, generateId, type UIMessage } from 'ai'
import { MessageSquare, X, Mic, MicOff, Send, Loader2, Sparkles, Bot, User } from 'lucide-react'
import { loadLatestThread } from '@/app/actions/advisor'

function messageText(msg: UIMessage): string {
  return (msg.parts ?? [])
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
}

/** Floating Conselheiro AXIS assistant. Replaces the legacy Gemini command-bot. */
export function Conselheiro({ tenantId }: { tenantId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [init, setInit] = useState<{ threadId: string; messages: UIMessage[] } | null>(null)

  // Lazily seed from the tenant's latest persisted thread the first time the panel opens.
  useEffect(() => {
    if (!isOpen || init) return
    let cancelled = false
    loadLatestThread()
      .then((thread) => {
        if (cancelled) return
        if (thread) {
          setInit({
            threadId: thread.id,
            messages: thread.messages.map(
              (m) => ({ id: m.id, role: m.role, parts: [{ type: 'text', text: m.content }] }) as UIMessage,
            ),
          })
        } else {
          setInit({ threadId: generateId(), messages: [] })
        }
      })
      .catch(() => {
        if (!cancelled) setInit({ threadId: generateId(), messages: [] })
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, init])

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 right-6 z-50 no-print">
      {isOpen &&
        (init ? (
          <ConselheiroChat threadId={init.threadId} initialMessages={init.messages} onClose={() => setIsOpen(false)} />
        ) : (
          <div className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[380px] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-6 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground font-medium">Reunindo a mesa...</span>
          </div>
        ))}

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Conselheiro AXIS"
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 text-white ${
          isOpen
            ? 'bg-zinc-800 hover:bg-zinc-700 hover:rotate-90'
            : 'bg-gradient-to-tr from-[#1a4d38] to-[#2d7a57] hover:scale-105'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5.5 h-5.5 animate-pulse" />}
      </button>
    </div>
  )
}

function ConselheiroChat({
  threadId,
  initialMessages,
  onClose,
}: {
  threadId: string
  initialMessages: UIMessage[]
  onClose: () => void
}) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/advisor', body: { threadId } }),
    [threadId],
  )
  const { messages, sendMessage, status } = useChat({ id: threadId, messages: initialMessages, transport })

  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const speechRef = useRef<unknown>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const loading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Web Speech API voice input (pt-BR), ported from the legacy assistant.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
    const Ctor = (SR.SpeechRecognition || SR.webkitSpeechRecognition) as
      | (new () => {
          continuous: boolean
          interimResults: boolean
          lang: string
          onstart: () => void
          onresult: (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void
          onerror: () => void
          onend: () => void
          start: () => void
          stop: () => void
        })
      | undefined
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'pt-BR'
    rec.onstart = () => setIsRecording(true)
    rec.onresult = (e) => setInput(e.results[0][0].transcript)
    rec.onerror = () => setIsRecording(false)
    rec.onend = () => setIsRecording(false)
    speechRef.current = rec
  }, [])

  const toggleRecording = () => {
    const rec = speechRef.current as { start: () => void; stop: () => void } | null
    if (!rec) return
    if (isRecording) rec.stop()
    else rec.start()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[380px] h-[500px] max-h-[calc(100dvh-12rem)] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-foreground">CONSELHEIRO AXIS</h3>
            <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-widest">Mesa redonda</span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Traga um problema real do negócio — pricing, escala, vendas, marca, decisão — e a mesa de mentores responde
            com vozes em primeira pessoa e um plano de ação.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                msg.role === 'user'
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-primary/10 border border-primary/20 text-foreground font-medium'
                  : 'bg-muted/40 border border-border text-foreground/90'
              }`}
            >
              <p className="whitespace-pre-line">{messageText(msg)}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Consultando a mesa...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-muted/20 flex gap-2 items-center">
        <button
          type="button"
          onClick={toggleRecording}
          title="Falar"
          className={`p-2 rounded-lg transition-all shrink-0 ${
            isRecording ? 'bg-rose-600 text-white animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Traga seu problema..."
          className="flex-1 bg-background border border-border h-9 rounded-lg px-3 text-[12.5px] font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg disabled:opacity-50 transition-all shrink-0"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>
    </div>
  )
}
