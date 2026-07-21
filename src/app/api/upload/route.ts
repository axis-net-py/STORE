import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";

// Upload de anexo (PDF/imagem da fatura) para o Vercel Blob.
// ponytail: server-side put via FormData — teto de ~4.5MB por request serverless,
// suficiente para faturas. Se precisar de arquivos maiores, migrar para client upload.
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

    const ext = file.name.split(".").pop() || "bin";
    const path = `purchases/${session.user.tenantId}/${Date.now()}_invoice.${ext}`;
    const blob = await put(path, file, { access: "public", addRandomSuffix: true });

    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Falha no upload" }, { status: 500 });
  }
}
