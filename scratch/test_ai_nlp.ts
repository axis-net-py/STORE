// Automated Test for AI NLP Command Parser
// Simulates user voice or text inputs and verifies they map to the correct DB schema actions

// Local NLP Heuristic Parser (copied from API route)
function parseCommand(text: string) {
  const cleanText = text.toLowerCase().trim();

  // 1. SAFRA
  if (cleanText.includes("safra") || cleanText.includes("cosecha")) {
    let name = "Nova Safra";
    let crop = "soja";
    
    const cropMatch = cleanText.match(/(soja|milho|trigo|algodão|algodao|arroz|cosecha)/i);
    if (cropMatch) crop = cropMatch[1].replace("cosecha", "soja").replace("algodão", "algodao");
    
    const nameMatch = text.match(/(?:safra|cosecha)\s+de\s+([a-zA-Z0-9\s-]+)|(?:safra|cosecha)\s+([a-zA-Z0-9\s-]+)/i);
    if (nameMatch) name = nameMatch[1] || nameMatch[2];

    return {
      action: "create_harvest",
      data: {
        name: name.trim(),
        cropType: crop,
      }
    };
  }

  // 2. TALHÃO
  if (cleanText.includes("talhão") || cleanText.includes("talhao") || cleanText.includes("parcela")) {
    let name = "Novo Talhão";
    let area = 10;
    let unit = "HECTARE";

    const areaMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(ha|hectare|hectares|alq|alqueire|alqueires)/i);
    if (areaMatch) {
      area = parseFloat(areaMatch[1].replace(",", "."));
      const unitStr = areaMatch[2].toLowerCase();
      if (unitStr.startsWith("alq")) unit = "ALQUEIRE";
    }

    const nameMatch = text.match(/(?:talhão|talhao|parcela)\s+([a-zA-Z0-9\s\.\-áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]+)/i);
    if (nameMatch) {
      name = nameMatch[1].replace(/\d+(?:[.,]\d+)?\s*(ha|hectare|hectares|alq|alqueire|alqueires).*/gi, "").replace(/\s+de\s+$/i, "").trim();
    }

    return {
      action: "create_plot",
      data: {
        name: name || "Talhão IA",
        area: area,
        unit: unit,
      }
    };
  }

  // 3. FUNCIONÁRIO (Check before vehicle to prevent 'tratorista' matching 'trator' vehicle check)
  if (cleanText.includes("funcionário") || cleanText.includes("funcionario") || cleanText.includes("operador") || cleanText.includes("tratorista") || cleanText.includes("agrônomo") || cleanText.includes("agronomo")) {
    let name = "Novo Funcionário";
    let role = "operador";

    if (cleanText.includes("tratorista")) role = "tratorista";
    else if (cleanText.includes("agrônomo") || cleanText.includes("agronomo")) role = "agronomo";
    else if (cleanText.includes("gerente") || cleanText.includes("supervisor")) role = "gerente";
    else if (cleanText.includes("auxiliar")) role = "auxiliar";

    const nameMatch = text.match(/(?:funcionário|funcionario|operador|tratorista|agrônomo|agronomo|auxiliar|gerente)\s+([a-zA-Z\sáàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]+)/i);
    if (nameMatch) {
      name = nameMatch[1].replace(/\s*(tratorista|operador|agronomo|agrônomo|auxiliar|gerente)/gi, "").trim();
    }

    return {
      action: "create_employee",
      data: {
        name: name || "Funcionário IA",
        role: role,
      }
    };
  }

  // 4. FROTA
  if (cleanText.includes("frota") || cleanText.includes("veículo") || cleanText.includes("maquinário") || cleanText.includes("trator") || cleanText.includes("colheitadeira") || cleanText.includes("máquina")) {
    let name = "Novo Veículo";
    let type = "trator";

    if (cleanText.includes("colheitadeira")) type = "colheitadeira";
    else if (cleanText.includes("pulverizador")) type = "pulverizador";
    else if (cleanText.includes("caminhão") || cleanText.includes("caminhao")) type = "caminhao";
    else if (cleanText.includes("implemento")) type = "implemento";

    const nameMatch = text.match(/(?:frota|veículo|veiculo|máquina|maquina|trator|colheitadeira|caminhão|caminhao|pulverizador)\s+([a-zA-Z0-9\s-]+)/i);
    if (nameMatch) name = nameMatch[1].trim();

    return {
      action: "create_vehicle",
      data: {
        name: name || `Veículo ${type}`,
        type: type,
      }
    };
  }

  // 5. CONTRATO
  if (cleanText.includes("contrato")) {
    let contractNumber = `CT-${Math.floor(100 + Math.random() * 900)}`;
    let siloName = "Silo Geral";
    let grainType = "soja";
    let quantity = 100;
    let unit = "TON";
    let pricePerUnit = 20;
    let currency = "USD";

    const numMatch = cleanText.match(/(?:número|nro|nº|numero|contrato)\s*([a-zA-Z0-9-]+)/i);
    if (numMatch) contractNumber = numMatch[1].toUpperCase();

    const siloMatch = cleanText.match(/(?:silo|silos|comprador)\s+([a-zA-Z0-9áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]+)/i);
    if (siloMatch) {
      const potentialSilo = siloMatch[1].trim();
      if (!["soja", "milho", "trigo", "arroz", "algodao", "tonelada", "toneladas", "sacas", "quilos"].includes(potentialSilo.toLowerCase())) {
        siloName = "Silo " + potentialSilo.charAt(0).toUpperCase() + potentialSilo.slice(1);
      }
    }

    const grainMatch = cleanText.match(/(soja|milho|trigo|algodão|algodao|arroz)/i);
    if (grainMatch) grainType = grainMatch[1].toLowerCase().replace("algodão", "algodao");

    const qtyMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(toneladas|tonelada|ton|sacas|saca|sc|quilos|quilo|kg)/i);
    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1].replace(",", "."));
      const unitStr = qtyMatch[2].toLowerCase();
      if (unitStr.startsWith("ton")) unit = "TON";
      else if (unitStr.startsWith("saca") || unitStr.startsWith("sc")) unit = "BAG";
      else if (unitStr.startsWith("kg") || unitStr.startsWith("quilo")) unit = "KG";
    }

    const priceMatch = cleanText.match(/(?:por|a|preço|precio)\s*(\d+(?:[.,]\d+)?)\s*(dolares|dólares|usd|\$|reais|brl|r\$|guaranis|pyg|g\$)/i);
    if (priceMatch) {
      pricePerUnit = parseFloat(priceMatch[1].replace(",", "."));
      const curStr = priceMatch[2].toLowerCase();
      if (curStr.includes("dolar") || curStr.includes("usd") || curStr.includes("$")) currency = "USD";
      else if (curStr.includes("real") || curStr.includes("brl") || curStr.includes("r$")) currency = "BRL";
      else if (curStr.includes("guarani") || curStr.includes("pyg") || curStr.includes("g$")) currency = "PYG";
    }

    return {
      action: "create_contract",
      data: {
        contractNumber,
        siloName,
        grainType,
        quantity,
        unit,
        pricePerUnit,
        currency,
      }
    };
  }

  return { action: "chat", data: null };
}

// Test Suite
const tests = [
  {
    input: "cadastrar safra Soja 2026",
    expectedAction: "create_harvest",
    expectedData: { name: "Soja 2026", cropType: "soja" }
  },
  {
    input: "adicionar talhão Norte de 15.5 hectares",
    expectedAction: "create_plot",
    expectedData: { name: "Norte", area: 15.5, unit: "HECTARE" }
  },
  {
    input: "cadastrar colheitadeira Case IH",
    expectedAction: "create_vehicle",
    expectedData: { name: "Case IH", type: "colheitadeira" }
  },
  {
    input: "cadastrar funcionário João da Silva tratorista",
    expectedAction: "create_employee",
    expectedData: { name: "João da Silva", role: "tratorista" }
  },
  {
    input: "cadastrar contrato 202 de soja para silo Alfa de 500 toneladas a 25 dolares",
    expectedAction: "create_contract",
    expectedData: { contractNumber: "202", siloName: "Silo Alfa", grainType: "soja", quantity: 500, unit: "TON", pricePerUnit: 25, currency: "USD" }
  }
];

function runTests() {
  console.log("=== Running AI NLP Parser Tests ===");
  let passed = 0;

  for (const t of tests) {
    const result = parseCommand(t.input);
    console.log(`Input: "${t.input}"`);
    console.log(`Parsed Action: "${result.action}"`);
    console.log(`Parsed Data:`, JSON.stringify(result.data));

    const actionMatches = result.action === t.expectedAction;
    let dataMatches = true;

    if (result.data && t.expectedData) {
      for (const k of Object.keys(t.expectedData)) {
        if ((result.data as any)[k] !== (t.expectedData as any)[k]) {
          dataMatches = false;
        }
      }
    } else if (result.data !== t.expectedData) {
      dataMatches = false;
    }

    if (actionMatches && dataMatches) {
      console.log("Result: ✅ PASSED\n");
      passed++;
    } else {
      console.log("Result: ❌ FAILED");
      console.log(`Expected Action: "${t.expectedAction}"`);
      console.log(`Expected Data:`, JSON.stringify(t.expectedData));
      console.log("");
    }
  }

  console.log(`Summary: ${passed}/${tests.length} tests passed.`);
  if (passed !== tests.length) {
    process.exit(1);
  }
}

runTests();
