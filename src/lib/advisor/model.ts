import { anthropic } from '@ai-sdk/anthropic'

// Direct Anthropic provider — chosen for guaranteed web_search server-tool support.
// IDs confirmed live 2026-06-23 against the AI SDK model table and the AI Gateway listing.
export const MODEL_DEFAULT = 'claude-sonnet-4-6'
export const MODEL_DEEP = 'claude-opus-4-8' // reserved for the Fase C "análise profunda" toggle

export function advisorModel(deep = false) {
  return anthropic(deep ? MODEL_DEEP : MODEL_DEFAULT)
}
