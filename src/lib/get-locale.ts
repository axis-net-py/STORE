import { cookies } from "next/headers"

/** Locale lido do cookie NEXT_LOCALE (setado pelo language-provider). Usar em server components. */
export async function getLocale(): Promise<"pt" | "es"> {
  const cookieStore = await cookies()
  return cookieStore.get("NEXT_LOCALE")?.value === "es-PY" ? "es" : "pt"
}
