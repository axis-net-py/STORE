import { getInvoiceById } from "@/app/actions/invoice";
import { Receipt80mm } from "@/components/thermal/Receipt80mm";
import { renderToStream } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return new NextResponse("Missing invoice ID", { status: 400 });
  }

  // Buscar fatura com detalhes
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  // Fetch tenant name
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId }
  });

  // Converter Decimal para number para o PDF
  const pdfInvoice = {
    ...invoice,
    totalAmount: Number(invoice.totalAmount),
    totalUSD: invoice.totalUSD ? Number(invoice.totalUSD) : undefined,
    items: invoice.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      totalPrice: Number(item.totalPrice),
      product: {
        name: item.product.name,
        sku: item.product.sku
      },
    })),
  };

  // Renderizar PDF
  const stream = await renderToStream(
    <Receipt80mm invoice={pdfInvoice as any} tenantName={tenant?.name || undefined} />
  );

  // Converter stream para buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const pdfBuffer = Buffer.concat(chunks);

  // Retornar como PDF
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${id.slice(-8)}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    },
  });
}
