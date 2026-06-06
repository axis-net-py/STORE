import prisma from "@/lib/prisma";

const BCP_API_URL = process.env.BCP_API_URL || "https://www.bcp.gov.py/api/tasas-cambio";
const EXCHANGERATE_API_KEY = process.env.EXCHANGERATE_API_KEY;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface ExchangeRateResponse {
  PYGtoUSD: number;
  PYGtoBRL: number;
  source: string;
  timestamp: number;
}

export async function fetchBCPRates(): Promise<ExchangeRateResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(BCP_API_URL, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "AXIS-ERP/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`BCP API returned ${response.status}`);
    }

    const data = await response.json();

    // Parse BCP response (structure may vary)
    // Expected: { usd: number, brl: number } or similar
    const PYGtoUSD = data.usd || data.USD || data.dolar || 7000; // Fallback to ~7000
    const PYGtoBRL = data.brl || data.BRL || data.real || 1300; // Fallback to ~1300

    return {
      PYGtoUSD: typeof PYGtoUSD === "number" ? PYGtoUSD : parseFloat(String(PYGtoUSD)),
      PYGtoBRL: typeof PYGtoBRL === "number" ? PYGtoBRL : parseFloat(String(PYGtoBRL)),
      source: "BCP_API",
      timestamp: Date.now(),
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

export async function fetchExchangeRateAPI(): Promise<ExchangeRateResponse> {
  if (!EXCHANGERATE_API_KEY) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      "https://open.er-api.com/v6/latest/PYG",
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`ExchangeRate-API returned ${response.status}`);
    }

    const data = await response.json();

    return {
      PYGtoUSD: 1 / (data.rates?.USD || 0.00014),
      PYGtoBRL: 1 / (data.rates?.BRL || 0.00077),
      source: "ExchangeRate-API",
      timestamp: Date.now(),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(
    `https://v6.exchangerate-api.com/v6/${EXCHANGERATE_API_KEY}/latest/PYG`,
    { signal: controller.signal }
  );

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`ExchangeRate-API returned ${response.status}`);
  }

  const data = await response.json();

  return {
    PYGtoUSD: 1 / data.conversion_rates.USD,
    PYGtoBRL: 1 / data.conversion_rates.BRL,
    source: "ExchangeRate-API",
    timestamp: Date.now(),
  };
}

export async function getOrFetchExchangeRate(tenantId: string, force = false) {
  if (!force) {
    // Check cache first
    const cachedRate = await prisma.exchangeRate.findFirst({
      where: {
        tenantId,
        date: {
          gte: new Date(Date.now() - CACHE_DURATION_MS),
        },
      },
      orderBy: { date: "desc" },
    });

    if (cachedRate) {
      return cachedRate;
    }
  }

  // Fetch from APIs
  let rateData: ExchangeRateResponse;
  try {
    rateData = await fetchBCPRates();
  } catch (bcpError) {
    console.warn("[ExchangeRates] BCP API failed, trying fallback", bcpError);
    try {
      rateData = await fetchExchangeRateAPI();
    } catch (fallbackError) {
      console.error("[ExchangeRates] Fallback API also failed:", fallbackError);
      // If everything fails, return the latest available rate in DB regardless of age
      const lastRate = await prisma.exchangeRate.findFirst({
        where: { tenantId },
        orderBy: { date: "desc" },
      });
      if (lastRate) return lastRate;

      // Absolute fallback if database is empty
      return await prisma.exchangeRate.create({
        data: {
          tenantId,
          ratePYGtoUSD: 7800,
          ratePYGtoBRL: 1350,
          source: "AXIS_SYSTEM_FALLBACK",
          isManual: false,
        },
      });
    }
  }

  // Save new rate to DB
  return await prisma.exchangeRate.create({
    data: {
      tenantId,
      ratePYGtoUSD: rateData.PYGtoUSD,
      ratePYGtoBRL: rateData.PYGtoBRL,
      source: rateData.source,
      isManual: false,
    },
  });
}
