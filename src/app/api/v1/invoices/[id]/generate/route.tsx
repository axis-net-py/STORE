import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { SifenInvoicePDF } from '@/components/pdf/SifenInvoicePDF';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/authz';

// ─── API: Generate SIFEN Invoice PDF ─────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // A autorização estava duplicada aqui, e a cópia dava passe livre ao ADMIN —
  // exatamente o que lib/authz.ts deixou de fazer na auditoria de 2026-07-30.
  // Duas cópias de uma regra de acesso divergem sempre; esta rota devolve um
  // documento fiscal, e a que valia era a mais permissiva.
  let tenantId: string;
  let userId: string;
  try {
    ({ tenantId, userId } = await requirePermission('invoices:read'));
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Fetch invoice with all related data (scoped to tenant)
    const invoice = await prisma.commercialInvoice.findUnique({
      where: { id, tenantId },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Prepare data for PDF
    const invoiceData = {
      id: invoice.id,
      number: invoice.documentNumber || undefined,
      documentNumber: invoice.documentNumber || undefined,
      sifenCdc: invoice.sifenCdc,
      sifenXmlUrl: invoice.sifenXmlUrl,
      issuedAt: invoice.issuedAt,
      type: invoice.type,
      status: invoice.status,
      customer: {
        name: invoice.customer?.name || 'Consumidor Final',
        document: invoice.customer?.document || '00000000',
      },
      items: invoice.items.map((item) => ({
        product: {
          name: item.product.name,
          sku: item.product.sku,
        },
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      totalAmount: Number(invoice.totalAmount),
      totalUSD: invoice.totalUSD ? Number(invoice.totalUSD) : undefined,
      exchangeRate: invoice.exchangeRate ? Number(invoice.exchangeRate) : undefined,
    };

    // Generate PDF
    const doc = (
      <SifenInvoicePDF
        invoice={invoiceData}
        language="pt"
        tenantId={tenantId}
        userId={userId}
        checksum={Buffer.from(JSON.stringify(invoiceData)).toString('base64')}
      />
    );

    const pdfBuffer = await renderToBuffer(doc);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoice.documentNumber || id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
