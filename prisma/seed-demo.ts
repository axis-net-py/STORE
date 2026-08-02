/**
 * Contas de apresentação — uma por vertical: store, farm e clinic.
 *
 * Contas LIMPAS: nem um produto, nem um cliente, nem uma fatura inventada.
 * O que cada uma tem é o que um cliente pago tem no primeiro dia — plano de
 * contas, matriz de permissões e depósito principal — porque quem as cria é
 * `provisionTenant()`, a MESMA função que provisiona um cliente real. Um
 * caminho próprio para a apresentação mostraria um sistema que não é o que
 * se entrega.
 *
 * Fica por preencher, de propósito, tudo o que é do cliente: RUC, morada,
 * atividade económica, timbrado, certificado. São dados fiscais reais e
 * inventá-los seria mostrar uma empresa que não existe.
 *
 * Uso:
 *   npx tsx prisma/seed-demo.ts
 *   DEMO_PASSWORD='outra-senha' npx tsx prisma/seed-demo.ts
 *
 * A senha é definida aqui, o que o provisionamento normal nunca faz: o
 * cliente define a dele por um link de uso único, para o fornecedor do
 * sistema nunca conhecer credenciais alheias. Numa conta de apresentação é ao
 * contrário — a senha tem de ser conhecida, porque é para ser mostrada. Por
 * isso estas contas vivem em clientes só de apresentação, sem dados de
 * ninguém, e os links de configuração por usar são queimados.
 *
 * Idempotente: correr outra vez repõe a senha e não duplica nada.
 */

import { hash } from "bcryptjs";
import prisma from "../src/lib/prisma.ts";
import { provisionTenant } from "../src/lib/provisioning.ts";

/** Senha das três contas. Igual nas três: numa apresentação escreve-se ao vivo. */
const SENHA = process.env.DEMO_PASSWORD || "Axis@Demo2026";

type Demo = {
  vertical: "store" | "farm" | "clinic";
  nome: string;
  slug: string;
  email: string;
  nomeAdmin: string;
};

const DEMOS: Demo[] = [
  {
    vertical: "store",
    nome: "AXIS Store — Demo",
    slug: "demo-store",
    email: "demo@axisstore.com",
    nomeAdmin: "Demonstração Store",
  },
  {
    vertical: "farm",
    nome: "AXIS Farm — Demo",
    slug: "demo-farm",
    email: "demo@axisfarm.com",
    nomeAdmin: "Demonstração Farm",
  },
  {
    vertical: "clinic",
    nome: "AXIS Clinic — Demo",
    slug: "demo-clinic",
    email: "demo@axisclinic.com",
    nomeAdmin: "Demonstração Clinic",
  },
];

async function garantirTenant(d: Demo): Promise<void> {
  const existente = await prisma.tenant.findUnique({
    where: { slug: d.slug },
    select: { id: true },
  });

  if (existente) {
    console.log(`  ${d.slug}: já existia`);
    return;
  }

  await provisionTenant({
    nome: d.nome,
    slug: d.slug,
    emailAdmin: d.email,
    nomeAdmin: d.nomeAdmin,
    vertical: d.vertical,
  });
  console.log(`  ${d.slug}: provisionado`);
}

async function definirSenha(email: string): Promise<void> {
  const user = await prisma.user.update({
    where: { email },
    data: { password: await hash(SENHA, 12), mustChangePassword: false },
    select: { id: true },
  });

  // Queima os links de configuração por usar. A conta já tem senha conhecida;
  // deixar um link válido a apontar para ela seria uma segunda via sem dono.
  await prisma.passwordSetupToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
}

async function main() {
  console.log("Contas de apresentação — store, farm e clinic\n");

  for (const d of DEMOS) {
    await garantirTenant(d);
    await definirSenha(d.email);
  }

  const linha = "─".repeat(70);
  console.log(`\n${linha}`);
  console.log("CREDENCIAIS");
  console.log(linha);
  for (const d of DEMOS) {
    console.log(`${d.vertical.padEnd(7)} ${d.email.padEnd(24)} ${SENHA}`);
  }
  console.log(linha);
  console.log("Papel: SOVEREIGN (acesso total) em cada cliente.");
  console.log("Contas vazias: não colocar dados reais nelas.");
  console.log(linha);
}

main()
  .catch((e) => {
    console.error("Falhou:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
