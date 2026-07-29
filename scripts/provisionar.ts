/**
 * Provisiona um cliente novo.
 *
 * Casca fina à volta de provisionTenant() (spec Projeto 2, §5.1) — a mesma
 * função que o futuro painel de administração vai chamar. As duas vias nunca
 * divergem porque são a mesma.
 *
 * Uso:
 *   node --env-file=.env scripts/provisionar.ts \
 *     --nome "Ferretería del Sur" \
 *     --email admin@ferreteriasur.com.py \
 *     [--slug ferreteria-sur] [--vertical store|farm|clinic|food] \
 *     [--modulos warehouse,hr]
 */

import { provisionTenant } from "../src/lib/provisioning.ts";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const nome = arg("nome");
  const email = arg("email");

  if (!nome || !email) {
    console.error("Faltam argumentos obrigatórios.\n");
    console.error('  node --env-file=.env scripts/provisionar.ts --nome "Nome do Cliente" --email admin@cliente.com.py');
    console.error("\nOpcionais: --slug  --vertical (store|farm|clinic|food)  --modulos a,b");
    process.exit(1);
  }

  const r = await provisionTenant({
    nome,
    emailAdmin: email,
    slug: arg("slug"),
    vertical: (arg("vertical") as any) ?? "store",
    modulosExtra: arg("modulos")?.split(",").map((m) => m.trim()).filter(Boolean),
  });

  const base = process.env.TENANT_BASE_DOMAINS?.split(",")[0]?.trim();
  const url = base && base !== "localhost"
    ? `https://${r.slug}.${base}/setup?token=${r.tokenConfiguracao}`
    : `https://axisretail.vercel.app/setup?token=${r.tokenConfiguracao}`;

  const linha = "─".repeat(72);
  console.log(linha);
  console.log(`Cliente   : ${nome}`);
  console.log(`Tenant ID : ${r.tenantId}`);
  console.log(`Subdomínio: ${r.slug}`);
  console.log(`Admin     : ${r.emailAdmin}`);
  console.log(linha);
  console.log("LINK DE CONFIGURAÇÃO (uso único, entregue ao cliente):");
  console.log(url);
  console.log(linha);
  console.log(`Expira em : ${r.expiraEm.toLocaleString()}`);
  console.log();
  console.log("Este link aparece UMA só vez — na base de dados fica apenas o");
  console.log("hash. O cliente define a senha dele; ninguém deste lado a saberá.");
  console.log(linha);
}

main()
  .catch((e) => {
    console.error("FALHOU — nada foi criado (transação revertida):", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { default: prisma } = await import("../src/lib/prisma.ts");
    await prisma.$disconnect();
  });
