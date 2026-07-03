import { NextRequest, NextResponse } from "next/server";
import { getOrFetchExchangeRate } from "@/lib/exchange";
import { auth } from "@/auth";

/**
 * POST /api/exchange-rates/fetch
 * Fetches official exchange rates from BCP (Banco Central del Paraguay)
 * Falls back to ExchangeRate-API if BCP is unavailable.
 * Caches rates for 1 hour in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || session.user.tenantId;

    if (tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const savedRate = await getOrFetchExchangeRate(tenantId);

    return NextResponse.json({
      success: true,
      rate: {
        id: savedRate.id,
        PYGtoUSD: savedRate.ratePYGtoUSD,
        PYGtoBRL: savedRate.ratePYGtoBRL,
        source: savedRate.source,
        date: savedRate.date,
      },
    });
  } catch (error) {
    console.error("[ExchangeRates] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

