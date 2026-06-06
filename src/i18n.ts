import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('NEXT_LOCALE')?.value || 'pt-BR';
  const locale = ['pt-BR', 'es-PY'].includes(rawLocale) ? rawLocale : 'pt-BR';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
