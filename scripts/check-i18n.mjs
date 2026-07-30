/**
 * Auditoria de i18n — impede que os idiomas voltem a divergir.
 *
 * Verifica:
 *  1. Paridade de chaves entre pt-BR.json e es-PY.json (nenhuma pode faltar dos dois lados).
 *  2. Valores idênticos entre os dois idiomas (sinal de tradução esquecida).
 *
 * Uso: node scripts/check-i18n.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) =>
  JSON.parse(readFileSync(join(root, "src", "messages", name), "utf8"));

/** Achata o objeto em pares "a.b.c" -> valor. */
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

// Termos legitimamente iguais nos dois idiomas (nomes próprios, siglas, símbolos).
const ALLOWED_IDENTICAL = new Set([
  // Cognatos: escrevem-se igual em português e espanhol. Não são traduções
  // esquecidas — traduzi-los de forma diferente seria que estaria errado.
  "nav.fiscal",
  "nav.silos",
  "nav.contratos",
  "nav.agenda",
  "nav.customersPatients",
  "app.title",
  "common.cancel",
  "common.edit",
  "common.filter",
  "common.total",
  "common.no",
  "common.status",
  "common.search",
  "common.confirm",
  "common.all",
  "common.optional",
  "currency.usd",
  "sifen.status.CANCELLED",
  "suppliers.show",
  "currency.pyg",
  "currency.symbol_pyg",
  "currency.symbol_usd",
  "currency.symbol_brl",
  "exchangeRates.ratePYGtoUSD",
  "exchangeRates.ratePYGtoBRL",
  "exchangeRates.isManual",
  "exchangeRates.table.rateUSD",
  "exchangeRates.table.rateBRL",
  "header.themeLight",
  "nav.orders",
  "nav.invoices",
  "nav.products",
  "nav.customers",
  "nav.cambio",
  "nav.mobile.invoices",
  "nav.mobile.products",
  "reports.filters.exportPDF",
  "reports.table.total",
  "customers.category",
  "customers.document",
  "customers.fisica",
  "customers.juridica",
  "customers.show",
  "invoices.type",
  "invoices.number",
  "invoices.total",
  "invoices.purchase",
  "invoices.all",
  "invoices.sifenAll",
  "invoices.customer",
  "suppliers.document",
  "suppliers.cash",
  "products.sku",
  "products.type",
  "products.show",
  "pages.customers.title",
  "pages.invoices.title",
  "pages.products.title",
  // Formularios: placeholders, siglas e nomes proprios iguais nos dois idiomas.
  "customers.editTitle",
  "customers.documentLabel",
  "customers.documentType",
  "customers.phonePlaceholder",
  "customers.addressPlaceholder",
  "customers.cityPlaceholder",
  "customers.country",
  "customers.countryBR",
  "customers.submit",
  "suppliers.documentLabel",
  "suppliers.documentType",
  "suppliers.fisica",
  "suppliers.juridica",
  "suppliers.addressPlaceholder",
  "suppliers.cityPlaceholder",
  "suppliers.country",
  "suppliers.countryBR",
  "billing.legalSifen",
  "billing.commonReceiptHint",
  "billing.customer",
  "billing.invoiceNumberPlaceholder",
  "billing.stampNumber",
  "billing.stampNumberPlaceholder",
  "billing.currencyUSD",
  "billing.vat",
  "billing.exempt",
  "billing.equivalentPYG",
  "billing.equivalentUSD",
  "billing.confirmPurchase",
  "billing.printA4",
  "billing.print80mm",
  "billing.purchase",
  "reports.filters.purchases",
  "invoiceActions.edit",
  "invoiceActions.print",
  "reportsDashboard.filter",
  "reportsDashboard.print",
  "reportsDashboard.customer",
  "reportsDashboard.total",
  "reportsDashboard.movementType",
  "reportsDashboard.totalIn",
  "auth.emailPlaceholder",
  "exchangeRates.usdToPyg",
  "exchangeRates.brlToPyg",
  "reports.filters.print",
  "priceTag.equivalent",
]);

const pt = flatten(load("pt-BR.json"));
const es = flatten(load("es-PY.json"));

const missingInEs = Object.keys(pt).filter((k) => !(k in es));
const missingInPt = Object.keys(es).filter((k) => !(k in pt));
const identical = Object.keys(pt).filter(
  (k) =>
    k in es &&
    typeof pt[k] === "string" &&
    pt[k] === es[k] &&
    !ALLOWED_IDENTICAL.has(k)
);

let failed = false;
const report = (label, keys) => {
  if (!keys.length) return;
  failed = true;
  console.error(`\n${label} (${keys.length}):`);
  for (const k of keys) console.error(`  - ${k}`);
};

report("Chaves ausentes em es-PY.json", missingInEs);
report("Chaves ausentes em pt-BR.json", missingInPt);
report(
  "Valores idênticos nos dois idiomas (tradução possivelmente esquecida)",
  identical
);

if (failed) {
  console.error("\n✗ Auditoria de i18n falhou.");
  process.exit(1);
}
console.log(
  `✓ i18n consistente — ${Object.keys(pt).length} chaves em paridade entre pt-BR e es-PY.`
);
