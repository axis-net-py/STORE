/**
 * Aplica o esquema do ERP a uma base de dados vazia.
 *
 * Corre `prisma migrate deploy` contra a base nova, com a MESMA pasta de
 * migrações que a base partilhada usa. É isso que garante que um cliente
 * provisionado hoje tem exatamente o esquema de todos os outros — e que a
 * tabela `_prisma_migrations` fica preenchida, para as migrações futuras
 * saberem onde pegar.
 *
 * Exige a ligação DIRETA, sem o pooler. O pooler do Neon fala PgBouncer em modo
 * transação; o `migrate deploy` precisa de sessões e falha com erros que não
 * dizem o que se passou.
 *
 * Só corre a partir da linha de comandos. Provisionar é um ato de operação, não
 * um pedido web: numa função serverless não há CLI do Prisma nem sistema de
 * ficheiros onde escrever, e o tempo limite acabaria a meio de uma migração —
 * que é a pior altura possível para parar.
 */
export async function aplicarMigracoes(ligacaoDireta: string): Promise<void> {
  const { spawn } = await import("node:child_process");

  await new Promise<void>((resolver, rejeitar) => {
    const p = spawn("npx", ["prisma", "migrate", "deploy"], {
      env: {
        ...process.env,
        DATABASE_URL: ligacaoDireta,
        // A shadow database só serve ao `migrate dev`, em desenvolvimento.
        // Herdá-la aqui apontaria as migrações do cliente novo para a base de
        // sombra de quem estiver a correr o comando.
        SHADOW_DATABASE_URL: undefined,
      } as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let saida = "";
    p.stdout?.on("data", (d) => (saida += d));
    p.stderr?.on("data", (d) => (saida += d));

    p.on("error", rejeitar);
    p.on("close", (codigo) => {
      if (codigo === 0) return resolver();
      // A saída do Prisma traz o erro do Postgres, que é o que permite
      // perceber se foi rede, permissão ou uma migração partida. A string de
      // ligação não aparece lá — vai só no ambiente do processo.
      rejeitar(new Error(`prisma migrate deploy falhou (código ${codigo}):\n${saida.slice(-2000)}`));
    });
  });
}
