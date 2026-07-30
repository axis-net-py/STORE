import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";

/**
 * Upload de anexo (PDF ou imagem da fatura) para o Vercel Blob.
 *
 * Teto de ~4.5MB por request serverless. Se for preciso mais, migrar para
 * upload direto do cliente.
 */

/**
 * Tipos aceites, por MIME.
 *
 * Sem esta lista o endpoint aceitava qualquer ficheiro e gravava-o com acesso
 * público — incluindo HTML ou SVG, que o navegador executa. Isso transformava
 * o armazenamento de faturas num alojamento de conteúdo arbitrário.
 *
 * A extensão gravada vem DAQUI e não do nome do ficheiro: o nome é escolhido
 * pelo utilizador e não é fonte de verdade sobre o conteúdo.
 */
const TIPOS_ACEITES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** 4 MB — abaixo do teto do runtime serverless, com margem. */
const TAMANHO_MAXIMO = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Armazenamento de anexos não configurado (BLOB_READ_WRITE_TOKEN)." },
      { status: 400 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
    }

    const extensao = TIPOS_ACEITES[file.type];
    if (!extensao) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo não aceito: ${file.type || "desconhecido"}. ` +
            `Envie PDF ou imagem (JPEG, PNG, WebP, HEIC).`,
        },
        { status: 415 }
      );
    }

    if (file.size > TAMANHO_MAXIMO) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        { error: `Arquivo grande demais (${mb} MB). O limite é 4 MB.` },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    }

    const path = `purchases/${session.user.tenantId}/${Date.now()}_invoice.${extensao}`;
    const blob = await put(path, file, {
      access: "public",
      addRandomSuffix: true,
      // Content-type explícito, derivado do que validámos — não do que o
      // cliente declarou no upload.
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    console.error("[upload] Falha:", err);
    // Mensagem genérica: o erro do fornecedor pode conter detalhes internos.
    return NextResponse.json({ error: "Falha no upload do anexo." }, { status: 500 });
  }
}
