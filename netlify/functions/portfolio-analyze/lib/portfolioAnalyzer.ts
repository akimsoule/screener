import type {
  WealthsimpleActivity,
  WealthsimpleHolding,
  PortfolioAnalysisResult,
  AllocationData,
  PerformanceData,
  FeesData,
  DiversificationData,
  Risk,
  Recommendation,
} from "../../../../src/types/portfolio";
import { fetchQuote } from "../../lib/provider/dataProvider";

export async function analyzePortfolio(
  activities: WealthsimpleActivity[],
  holdings: WealthsimpleHolding[],
): Promise<PortfolioAnalysisResult> {
  // Filtrer les données invalides (lignes de métadonnées ou incomplètes)
  const validHoldings = holdings.filter(
    (h) => h.symbole && h.nom && h.valeur_marchande !== undefined,
  );
  const validActivities = activities.filter(
    (a) => a.symbole && a.type_activite,
  );

  // Calculer l'allocation
  const allocation = calculateAllocation(validHoldings);

  // Calculer la performance (async maintenant)
  const performance = await calculatePerformance(
    validHoldings,
    validActivities,
  );

  // Analyser les frais
  const fees = analyzeFees(validActivities, performance.overall.totalValue);

  // Évaluer la diversification
  const diversification = evaluateDiversification(validHoldings);

  // Identifier les risques
  const risks = identifyRisks(
    validHoldings,
    validActivities,
    diversification,
    fees,
    performance.quoteTypeMap,
  );

  // Générer des recommandations
  const recommendations = generateRecommendations(
    allocation,
    performance,
    fees,
    diversification,
    risks,
    validHoldings,
    performance.quoteTypeMap,
  );

  return {
    summary: {
      totalValue: performance.overall.totalValue,
      totalCost: performance.overall.totalCost,
      totalUnrealizedGain: performance.overall.totalGain,
      totalUnrealizedGainPercent: performance.overall.totalGainPercent,
      totalCommissions: fees.totalCommissions,
      analysisDate: new Date().toISOString(),
    },
    allocation,
    performance,
    fees,
    diversification,
    risks,
    recommendations,
  };
}

function calculateAllocation(holdings: WealthsimpleHolding[]): AllocationData {
  const byAccountType: Record<string, { value: number; percentage: number }> =
    {};
  const byAsset: Record<
    string,
    { value: number; percentage: number; quantity: number }
  > = {};
  const byAssetType: Record<string, { value: number; percentage: number }> = {};
  const bySector: Record<string, { value: number; percentage: number }> = {};

  let totalValue = 0;

  holdings.forEach((holding) => {
    const value = holding.valeur_marchande;
    totalValue += value;

    // Par type de compte
    const accountType = holding.type_de_compte;
    if (!byAccountType[accountType]) {
      byAccountType[accountType] = { value: 0, percentage: 0 };
    }
    byAccountType[accountType].value += value;

    // Par actif
    const symbol = holding.symbole;
    if (!byAsset[symbol]) {
      byAsset[symbol] = { value: 0, percentage: 0, quantity: 0 };
    }
    byAsset[symbol].value += value;
    byAsset[symbol].quantity += holding.quantite;

    // Par type d'actif
    const assetType = holding.type;
    if (!byAssetType[assetType]) {
      byAssetType[assetType] = { value: 0, percentage: 0 };
    }
    byAssetType[assetType].value += value;
  });

  // Calculer les pourcentages
  if (totalValue > 0) {
    Object.keys(byAccountType).forEach((key) => {
      byAccountType[key].percentage =
        (byAccountType[key].value / totalValue) * 100;
    });
    Object.keys(byAsset).forEach((key) => {
      byAsset[key].percentage = (byAsset[key].value / totalValue) * 100;
    });
    Object.keys(byAssetType).forEach((key) => {
      byAssetType[key].percentage = (byAssetType[key].value / totalValue) * 100;
    });
  }

  return {
    byAccountType,
    byAsset,
    bySector,
    byAssetType,
  };
}

async function calculatePerformance(
  holdings: WealthsimpleHolding[],
  activities: WealthsimpleActivity[],
): Promise<PerformanceData> {
  // Récupérer les prix actuels et types pour tous les symboles
  const symbols = [...new Set(holdings.map((h) => h.symbole))];
  const pricePromises = symbols.map(async (symbol) => {
    try {
      // Essayer d'abord avec le symbole tel quel
      let quote: { price?: number; quoteType?: string } | null =
        await fetchQuote(symbol);

      // Si échec et que le symbole ne contient pas de ".", essayer avec .TO (Toronto)
      if ((!quote || quote.price === 0) && !symbol.includes(".")) {
        quote = await fetchQuote(`${symbol}.TO`);
      }

      // Si échec et que le symbole ne contient pas de ".", essayer avec .CN (Canada)
      if ((!quote || quote.price === 0) && !symbol.includes(".")) {
        quote = await fetchQuote(`${symbol}.CN`);
      }

      return {
        symbol,
        price: (quote && quote.price) || 0,
        quoteType: (quote && quote.quoteType) || undefined,
      };
    } catch {
      return { symbol, price: 0, quoteType: undefined };
    }
  });
  const prices = await Promise.all(pricePromises);
  const priceMap = new Map(prices.map((p) => [p.symbol, p.price]));
  const quoteTypeMap = new Map(prices.map((p) => [p.symbol, p.quoteType]));

  // Calculer le prix moyen d'achat pour chaque symbole basé sur les activités
  const costBasis = new Map<
    string,
    { totalCost: number; totalQuantity: number }
  >();

  activities.forEach((activity) => {
    // Détecter les achats de manière plus flexible
    const isDeposit = activity.type_activite?.toLowerCase().includes("deposit");
    const isBuy =
      activity.sous_type_activite === "BUY" ||
      activity.sous_type_activite?.toLowerCase() === "buy" ||
      activity.direction === "Buy" ||
      activity.direction === "buy" ||
      activity.type_activite?.toLowerCase().includes("buy") ||
      activity.type_activite?.toLowerCase().includes("achat");
    const isReinvestedDividend =
      activity.sous_type_activite?.toLowerCase().includes("réinvesti") ||
      activity.sous_type_activite?.toLowerCase().includes("reinvested");
    const isDividendReinvestment =
      activity.type_activite?.toLowerCase().includes("dividend") &&
      activity.sous_type_activite?.toLowerCase().includes("reinvestment");

    // Ignorer les dépôts en espèces (deposits) qui n'achètent pas d'actifs
    if (isDeposit) {
      return;
    }

    // Comptabiliser les achats et dividendes réinvestis
    if (isBuy || isReinvestedDividend || isDividendReinvestment) {
      const symbol = activity.symbole;
      const cost = Math.abs(activity.montant_net_especes || 0);
      const quantity = Math.abs(activity.quantite || 0);

      // Ignorer si pas de symbole ou quantité nulle
      if (!symbol || quantity === 0) {
        return;
      }

      if (!costBasis.has(symbol)) {
        costBasis.set(symbol, { totalCost: 0, totalQuantity: 0 });
      }

      const basis = costBasis.get(symbol)!;
      basis.totalCost += cost;
      basis.totalQuantity += quantity;
    }
  });

  let totalValue = 0;
  let totalCost = 0;
  const byPosition: PerformanceData["byPosition"] = [];

  holdings.forEach((holding) => {
    const currentPrice = priceMap.get(holding.symbole) || 0;
    const quantity = holding.quantite;

    // Si le prix n'a pas pu être récupéré, utiliser la valeur marchande du CSV
    let marketValue = 0;
    if (currentPrice > 0) {
      marketValue = currentPrice * quantity;
    } else {
      // Fallback sur la valeur marchande du CSV
      marketValue = holding.valeur_marchande || 0;
    }

    // Calculer le coût de base depuis les activités
    const basis = costBasis.get(holding.symbole);
    let bookValue = 0;

    if (basis && basis.totalQuantity > 0) {
      const averageCost = basis.totalCost / basis.totalQuantity;
      bookValue = averageCost * quantity;
    } else {
      // Fallback sur la valeur du CSV si pas d'activités trouvées
      bookValue = holding.valeur_comptable_cad || 0;
    }

    const unrealizedGain = marketValue - bookValue;
    const unrealizedGainPercent =
      bookValue === 0 ? 0 : (unrealizedGain / bookValue) * 100;

    totalValue += marketValue;
    totalCost += bookValue;

    byPosition.push({
      symbol: holding.symbole,
      name: holding.nom,
      accountType: holding.type_de_compte,
      quantity,
      marketValue,
      bookValue,
      unrealizedGain,
      unrealizedGainPercent,
    });
  });

  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost === 0 ? 0 : (totalGain / totalCost) * 100;

  // Trier pour trouver les meilleurs/pires performers
  const sortedByGain = [...byPosition].sort(
    (a, b) => b.unrealizedGainPercent - a.unrealizedGainPercent,
  );

  const topPerformers = sortedByGain.slice(0, 3).map((p) => ({
    symbol: p.symbol,
    gainPercent: p.unrealizedGainPercent,
  }));

  const worstPerformers = sortedByGain
    .slice(-3)
    .reverse()
    .map((p) => ({
      symbol: p.symbol,
      gainPercent: p.unrealizedGainPercent,
    }));

  return {
    overall: {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
    },
    byPosition,
    topPerformers,
    worstPerformers,
    quoteTypeMap, // Retourner la map pour l'utiliser dans identifyRisks
  };
}

function analyzeFees(
  activities: WealthsimpleActivity[],
  totalValue: number,
): FeesData {
  let totalCommissions = 0;
  let tradeCount = 0;
  const feesByAccountType: Record<string, number> = {};

  activities.forEach((activity) => {
    if (activity.type_activite === "Trade") {
      totalCommissions += activity.commission;
      tradeCount++;

      const accountType = activity.type_compte;
      if (!feesByAccountType[accountType]) {
        feesByAccountType[accountType] = 0;
      }
      feesByAccountType[accountType] += activity.commission;
    }
  });

  const averageCommission = tradeCount > 0 ? totalCommissions / tradeCount : 0;
  const impact = totalValue > 0 ? (totalCommissions / totalValue) * 100 : 0;

  return {
    totalCommissions,
    averageCommission,
    commissionsPerTrade: averageCommission,
    feesByAccountType,
    impact,
  };
}

function evaluateDiversification(
  holdings: WealthsimpleHolding[],
): DiversificationData {
  const totalValue = holdings.reduce((sum, h) => sum + h.valeur_marchande, 0);
  const numberOfPositions = holdings.length;
  const numberOfAssets = new Set(holdings.map((h) => h.symbole)).size;
  const numberOfAccountTypes = new Set(holdings.map((h) => h.type_de_compte))
    .size;

  // Trouver la position la plus importante
  const sortedByValue = [...holdings].sort(
    (a, b) => b.valeur_marchande - a.valeur_marchande,
  );
  const topPosition = sortedByValue[0];
  const topPositionPercentage =
    totalValue > 0 ? (topPosition.valeur_marchande / totalValue) * 100 : 0;

  // Concentration top 3 et top 5
  const top3Value = sortedByValue
    .slice(0, 3)
    .reduce((sum, h) => sum + h.valeur_marchande, 0);
  const top5Value = sortedByValue
    .slice(0, 5)
    .reduce((sum, h) => sum + h.valeur_marchande, 0);
  const top3Concentration = totalValue > 0 ? (top3Value / totalValue) * 100 : 0;
  const top5Concentration = totalValue > 0 ? (top5Value / totalValue) * 100 : 0;

  // Balance des types d'actifs
  const assetTypeBalance: Record<string, number> = {};
  if (totalValue > 0) {
    holdings.forEach((h) => {
      const type = h.type;
      if (!assetTypeBalance[type]) {
        assetTypeBalance[type] = 0;
      }
      assetTypeBalance[type] += (h.valeur_marchande / totalValue) * 100;
    });
  }

  // Calculer le score de diversification (0-100)
  let score = 100;

  // Pénalité pour concentration
  if (topPositionPercentage > 50) score -= 30;
  else if (topPositionPercentage > 30) score -= 20;
  else if (topPositionPercentage > 20) score -= 10;

  if (top3Concentration > 70) score -= 20;
  else if (top3Concentration > 50) score -= 10;

  // Bonus pour nombre de positions
  if (numberOfPositions < 5) score -= 20;
  else if (numberOfPositions < 10) score -= 10;
  else if (numberOfPositions > 20) score += 10;

  // Bonus pour diversification des types de comptes
  if (numberOfAccountTypes >= 3) score += 10;
  else if (numberOfAccountTypes === 2) score += 5;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    numberOfPositions,
    numberOfAssets,
    numberOfAccountTypes,
    concentrationRisk: {
      topPosition: {
        symbol: topPosition.symbole,
        percentage: topPositionPercentage,
      },
      top3Concentration,
      top5Concentration,
    },
    assetTypeBalance,
  };
}

function isETF(symbol: string, name: string, quoteType?: string): boolean {
  // Méthode 1: Vérifier le quoteType de Yahoo Finance (le plus fiable)
  if (quoteType === "ETF") {
    return true;
  }

  // Méthode 2: Vérifier si le nom contient "ETF" ou "Index" (fallback si l'API n'a pas retourné de quoteType)
  const nameLower = name.toLowerCase();
  return (
    nameLower.includes("etf") ||
    nameLower.includes("index") ||
    nameLower.includes("indice")
  );
}

function identifyRisks(
  holdings: WealthsimpleHolding[],
  activities: WealthsimpleActivity[],
  diversification: DiversificationData,
  fees: FeesData,
  quoteTypeMap?: Map<string, string | undefined>,
): Risk[] {
  const risks: Risk[] = [];

  // Risque de concentration
  const topHolding = holdings.find(
    (h) => h.symbole === diversification.concentrationRisk.topPosition.symbol,
  );
  const topQuoteType =
    quoteTypeMap?.get(topHolding?.symbole || "") || undefined;
  const topIsETF = topHolding
    ? isETF(topHolding.symbole, topHolding.nom, topQuoteType)
    : false;

  // Seuils différents pour les ETF vs titres individuels
  const concentrationThreshold = topIsETF ? 80 : 40;

  if (
    diversification.concentrationRisk.topPosition.percentage >
    concentrationThreshold
  ) {
    const message = topIsETF
      ? `${diversification.concentrationRisk.topPosition.symbol} (ETF) représente ${diversification.concentrationRisk.topPosition.percentage.toFixed(1)}% de votre portefeuille.`
      : `${diversification.concentrationRisk.topPosition.symbol} représente ${diversification.concentrationRisk.topPosition.percentage.toFixed(1)}% de votre portefeuille.`;

    const recommendation = topIsETF
      ? "Bien que ce soit un ETF diversifié, considérez ajouter d'autres classes d'actifs (obligations, immobilier, etc.) pour une meilleure répartition."
      : "Considérez réduire cette position et diversifier dans d'autres actifs ou ETF.";

    risks.push({
      level: topIsETF ? "MEDIUM" : "HIGH",
      category: "CONCENTRATION",
      title: topIsETF
        ? "Concentration sur un ETF"
        : "Concentration élevée sur une position",
      description: message,
      impact: topIsETF
        ? "Manque de diversification entre classes d'actifs, même si l'ETF est lui-même diversifié."
        : "Une baisse de cette position aurait un impact significatif sur votre portefeuille global.",
      recommendation,
    });
  }

  // Compter combien des top 3 sont des ETF
  const top3Holdings = [...holdings]
    .sort((a, b) => (b.valeur_marchande || 0) - (a.valeur_marchande || 0))
    .slice(0, 3);
  const top3ETFCount = top3Holdings.filter((h) => {
    const quoteType = quoteTypeMap?.get(h.symbole);
    return isETF(h.symbole, h.nom, quoteType);
  }).length;

  // Seuil plus élevé si majoritairement des ETF
  const top3Threshold = top3ETFCount >= 2 ? 90 : 75;

  if (diversification.concentrationRisk.top3Concentration > top3Threshold) {
    const recommendation =
      top3ETFCount >= 2
        ? "Vos principales positions sont des ETF diversifiés, ce qui est positif. Considérez ajouter des actifs alternatifs (obligations, immobilier) pour compléter."
        : "Augmentez la diversification en ajoutant des positions dans d'autres secteurs ou en utilisant des ETF diversifiés.";

    risks.push({
      level: "MEDIUM",
      category: "CONCENTRATION",
      title: "Concentration sur les 3 principales positions",
      description: `Vos 3 principales positions représentent ${diversification.concentrationRisk.top3Concentration.toFixed(1)}% de votre portefeuille.`,
      impact: "Risque de volatilité accrue si ces positions sont corrélées.",
      recommendation,
    });
  }

  // Risque de faible diversification - adapté aux ETF
  if (diversification.numberOfPositions < 10) {
    // Vérifier si le portefeuille contient des ETF diversifiés
    const etfHoldings = holdings.filter((h) => {
      const quoteType = quoteTypeMap?.get(h.symbole);
      return isETF(h.symbole, h.nom, quoteType);
    });
    const etfValue = etfHoldings.reduce(
      (sum, h) => sum + (h.valeur_marchande || 0),
      0,
    );
    const totalValue = holdings.reduce(
      (sum, h) => sum + (h.valeur_marchande || 0),
      0,
    );
    const etfPercentage = totalValue > 0 ? (etfValue / totalValue) * 100 : 0;

    // Si le portefeuille est dominé par des ETF (>70%), le message est différent
    const recommendation =
      etfPercentage > 70
        ? "Votre portefeuille contient des ETF diversifiés qui couvrent déjà de nombreux titres. Considérez ajouter d'autres classes d'actifs (obligations, immobilier) plutôt que plus d'actions individuelles."
        : "Visez au moins 15-20 positions pour une meilleure diversification, ou simplifiez avec des ETF tout-en-un comme VEQT, VGRO ou VBAL.";

    risks.push({
      level: "MEDIUM",
      category: "CONCENTRATION",
      title: "Nombre limité de positions",
      description: `Votre portefeuille contient seulement ${diversification.numberOfPositions} positions.`,
      impact:
        etfPercentage > 70
          ? "Manque de diversification entre classes d'actifs, bien que les ETF fournissent une diversification au sein des actions."
          : "Risque non-systématique élevé, manque de diversification.",
      recommendation,
    });
  }

  // Risque de frais élevés
  if (fees.impact > 0.5) {
    risks.push({
      level: "HIGH",
      category: "FEES",
      title: "Impact élevé des frais",
      description: `Les frais représentent ${fees.impact.toFixed(2)}% de la valeur de votre portefeuille.`,
      impact:
        "Les frais réduisent significativement vos rendements à long terme.",
      recommendation:
        "Réduisez la fréquence de trading ou utilisez des ETF à faibles frais.",
    });
  } else if (fees.averageCommission > 5) {
    risks.push({
      level: "MEDIUM",
      category: "FEES",
      title: "Commissions moyennes élevées",
      description: `Commission moyenne de ${fees.averageCommission.toFixed(2)}$ CAD par transaction.`,
      impact:
        "Les commissions peuvent éroder vos rendements sur le long terme.",
      recommendation:
        "Privilégiez des transactions de montants plus élevés pour réduire l'impact des commissions.",
    });
  }

  // Risque fiscal (comptes enregistrés vs non-enregistrés)
  const accountTypes = new Set(holdings.map((h) => h.type_de_compte));
  if (!accountTypes.has("CELI") && !accountTypes.has("REER")) {
    risks.push({
      level: "MEDIUM",
      category: "TAX",
      title: "Optimisation fiscale limitée",
      description: "Vous n'utilisez pas de comptes enregistrés (CELI/REER).",
      impact: "Vous payez potentiellement des impôts inutiles sur vos gains.",
      recommendation:
        "Maximisez vos contributions CELI et REER pour bénéficier d'avantages fiscaux.",
    });
  }

  // Effet de levier (si présent)
  const leveragedETFs = holdings.filter(
    (h) =>
      h.nom &&
      (h.nom.toLowerCase().includes("2x") ||
        h.nom.toLowerCase().includes("3x") ||
        h.nom.toLowerCase().includes("bull") ||
        h.nom.toLowerCase().includes("bear")),
  );

  if (leveragedETFs.length > 0) {
    const leveragedValue = leveragedETFs.reduce(
      (sum, h) => sum + h.valeur_marchande,
      0,
    );
    const totalValue = holdings.reduce((sum, h) => sum + h.valeur_marchande, 0);
    const leveragedPercentage = (leveragedValue / totalValue) * 100;

    risks.push({
      level: "HIGH",
      category: "LEVERAGE",
      title: "Exposition aux produits à effet de levier",
      description: `${leveragedPercentage.toFixed(1)}% de votre portefeuille est dans des ETF à effet de levier.`,
      impact:
        "Risque de pertes amplifiées et de détérioration de valeur à long terme.",
      recommendation:
        "Les produits à effet de levier sont destinés au trading à court terme. Considérez réduire cette exposition.",
    });
  }

  return risks;
}

function generateRecommendations(
  allocation: AllocationData,
  performance: PerformanceData,
  fees: FeesData,
  diversification: DiversificationData,
  risks: Risk[],
  holdings: WealthsimpleHolding[],
  quoteTypeMap?: Map<string, string | undefined>,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Vérifier si le portefeuille est principalement composé d'ETF diversifiés
  const totalValue = performance.overall.totalValue;
  const etfHoldings = holdings.filter((h) => {
    const quoteType = quoteTypeMap?.get(h.symbole);
    return isETF(h.symbole, h.nom, quoteType);
  });
  const etfValue = etfHoldings.reduce(
    (sum, h) => sum + (h.valeur_marchande || 0),
    0,
  );
  const etfPercentage = totalValue > 0 ? (etfValue / totalValue) * 100 : 0;
  const isETFDominated = etfPercentage > 70;

  // Recommandation de diversification adaptée
  if (diversification.score < 60) {
    const action = isETFDominated
      ? "Votre portefeuille contient déjà des ETF diversifiés. Considérez ajouter d'autres classes d'actifs (obligations via VBAL/VAB, immobilier via VRE, ou matières premières) pour une meilleure répartition."
      : "Ajoutez des positions dans différents secteurs et types d'actifs. Visez au moins 15-20 positions bien réparties, ou simplifiez avec un ETF tout-en-un comme VEQT, VGRO ou VBAL.";

    recommendations.push({
      priority: "HIGH",
      category: "DIVERSIFICATION",
      title: "Améliorer la diversification",
      description: `Votre score de diversification est de ${diversification.score}/100.`,
      action,
      expectedImpact:
        "Réduction du risque non-systématique et amélioration du ratio risque/rendement.",
    });
  }

  // Recommandation de rééquilibrage adaptée aux ETF
  const topConcentration =
    diversification.concentrationRisk.topPosition.percentage;
  const topSymbol = diversification.concentrationRisk.topPosition.symbol;
  const topHolding = holdings.find((h) => h.symbole === topSymbol);
  const topQuoteType = quoteTypeMap?.get(topSymbol);
  const topIsETF = topHolding
    ? isETF(topSymbol, topHolding.nom, topQuoteType)
    : false;

  // Seuil différent pour ETF vs actions individuelles
  const rebalanceThreshold = topIsETF ? 85 : 25;

  if (topConcentration > rebalanceThreshold) {
    const action = topIsETF
      ? `${topSymbol} est un ETF diversifié, ce qui est positif. Cependant, considérez ajouter d'autres classes d'actifs (obligations, immobilier) pour équilibrer le portefeuille et réduire la volatilité globale.`
      : `Réduisez graduellement cette position à moins de 20% et réinvestissez dans des actifs moins représentés ou dans des ETF diversifiés.`;

    recommendations.push({
      priority: topIsETF ? "MEDIUM" : "HIGH",
      category: "REBALANCING",
      title: topIsETF
        ? "Diversifier entre classes d'actifs"
        : "Rééquilibrer le portefeuille",
      description: `${topSymbol} représente ${topConcentration.toFixed(1)}% de votre portefeuille.`,
      action,
      expectedImpact: topIsETF
        ? "Meilleure répartition entre actions, obligations et autres actifs pour un profil de risque équilibré."
        : "Meilleure gestion du risque et protection contre la volatilité d'une seule position.",
    });
  }

  // Recommandation sur les frais
  if (fees.impact > 0.3 || fees.averageCommission > 5) {
    recommendations.push({
      priority: "MEDIUM",
      category: "FEES",
      title: "Optimiser les frais de transaction",
      description: `Vous avez payé ${fees.totalCommissions.toFixed(2)}$ CAD en commissions.`,
      action:
        "Réduisez la fréquence de trading, groupez vos achats, ou privilégiez des ETF qui peuvent être achetés sans commission.",
      expectedImpact: `Économie potentielle de ${(fees.totalCommissions * 0.5).toFixed(2)}$ CAD par an.`,
    });
  }

  // Recommandation d'allocation CELI/REER
  const celiValue = allocation.byAccountType["CELI"]?.value || 0;
  const reerValue = allocation.byAccountType["REER"]?.value || 0;
  const registeredPercentage = ((celiValue + reerValue) / totalValue) * 100;

  if (registeredPercentage < 80) {
    recommendations.push({
      priority: "HIGH",
      category: "TAX",
      title: "Maximiser les comptes enregistrés",
      description: `Seulement ${registeredPercentage.toFixed(1)}% de votre portefeuille est dans des comptes enregistrés (CELI/REER).`,
      action:
        "Maximisez vos cotisations CELI (7 000$ pour 2024) et REER (18% du revenu) avant d'investir dans un compte non enregistré.",
      expectedImpact:
        "Économie d'impôts significative et croissance libre d'impôt.",
    });
  }

  // Recommandation sur la stratégie à long terme
  const etfCount = Object.keys(allocation.byAsset).filter(
    (symbol) =>
      symbol.includes("ETF") ||
      ["VEQT", "VGRO", "VBAL", "VCNS"].includes(symbol),
  ).length;

  if (etfCount === 0) {
    recommendations.push({
      priority: "MEDIUM",
      category: "ALLOCATION",
      title: "Considérer des ETF diversifiés",
      description: "Votre portefeuille ne contient pas d'ETF tout-en-un.",
      action:
        "Envisagez des ETF comme VEQT (100% actions), VGRO (80/20) ou VBAL (60/40) pour une diversification instantanée à faibles frais.",
      expectedImpact:
        "Simplification de la gestion et réduction des frais de gestion.",
    });
  }

  // Recommandation sur les positions perdantes
  const significantLosses = performance.byPosition.filter(
    (p: PerformanceData["byPosition"][0]) =>
      p.unrealizedGainPercent < -20 && p.marketValue > totalValue * 0.05,
  );

  if (significantLosses.length > 0) {
    recommendations.push({
      priority: "MEDIUM",
      category: "REBALANCING",
      title: "Réévaluer les positions en perte",
      description: `${significantLosses.length} position(s) significative(s) en perte de plus de 20%.`,
      action:
        "Analysez les raisons de ces pertes. Si les fondamentaux ont changé, considérez couper vos pertes. Sinon, ce peut être une opportunité d'achat.",
      expectedImpact:
        "Meilleure allocation du capital vers des opportunités plus prometteuses.",
    });
  }

  // Trier par priorité
  const priorityOrder: Record<"HIGH" | "MEDIUM" | "LOW", number> = {
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  return recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );
}
