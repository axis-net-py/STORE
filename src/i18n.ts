import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { FUSO_PARAGUAI } from '@/lib/fuso';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('NEXT_LOCALE')?.value || 'pt-BR';
  const locale = ['pt-BR', 'es-PY'].includes(rawLocale) ? rawLocale : 'pt-BR';

  return {
    locale,
    // Sem isto, o next-intl avisa e recorre ao fuso do ambiente: no servidor da
    // Vercel é UTC, no navegador é o do utilizador. As datas saíam diferentes
    // dos dois lados e o React reclamava da divergência de markup — e, pior,
    // uma data mostrada podia não ser o dia fiscal do documento. É o mesmo
    // fuso que decide a que dia pertence um documento (lib/fuso.ts).
    timeZone: FUSO_PARAGUAI,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
