import type { PortfolioAnalysisResult } from "../../../../src/types/portfolio";

export function generateMarkdownReport(
  analysis: PortfolioAnalysisResult,
): string {
  const {
    summary,
    allocation,
    performance,
    fees,
    diversification,
    risks,
    recommendations,
  } = analysis;

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "0,00 $";
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    if (!Number.isFinite(value)) return "0,00%";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const date = new Date(summary.analysisDate).toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `# 📊 Analyse de Portefeuille Wealthsimple

**Date de l'analyse** : ${date}

---

## 📈 Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| **Valeur totale** | ${formatCurrency(summary.totalValue)} |
| **Coût de base** | ${formatCurrency(summary.totalCost)} |
| **Gain/Perte non réalisé** | ${formatCurrency(summary.totalUnrealizedGain)} (${formatPercent(summary.totalUnrealizedGainPercent)}) |
| **Frais totaux** | ${formatCurrency(summary.totalCommissions)} |
| **Score de diversification** | ${diversification.score}/100 |

---

## 💼 Allocation du portefeuille

### Par type de compte

| Compte | Valeur | Pourcentage |
|--------|--------|-------------|
${Object.entries(allocation.byAccountType)
  .map(
    ([type, data]) =>
      `| ${type} | ${formatCurrency(data.value)} | ${data.percentage.toFixed(1)}% |`,
  )
  .join("\n")}

### Par actif (Top 10)

| Symbole | Valeur | Pourcentage | Quantité |
|---------|--------|-------------|----------|
${Object.entries(allocation.byAsset)
  .sort(([, a], [, b]) => b.value - a.value)
  .slice(0, 10)
  .map(
    ([symbol, data]) =>
      `| ${symbol} | ${formatCurrency(data.value)} | ${data.percentage.toFixed(1)}% | ${data.quantity.toFixed(4)} |`,
  )
  .join("\n")}

### Par type d'actif

| Type | Valeur | Pourcentage |
|------|--------|-------------|
${Object.entries(allocation.byAssetType)
  .map(
    ([type, data]) =>
      `| ${type} | ${formatCurrency(data.value)} | ${data.percentage.toFixed(1)}% |`,
  )
  .join("\n")}

---

## 📊 Performance

### Résumé global

- **Rendement total** : ${formatCurrency(performance.overall.totalGain)} (${formatPercent(performance.overall.totalGainPercent)})
- **Valeur marchande** : ${formatCurrency(performance.overall.totalValue)}
- **Coût de base** : ${formatCurrency(performance.overall.totalCost)}

### 🏆 Meilleurs performers

| Symbole | Rendement |
|---------|-----------|
${performance.topPerformers.map((p) => `| ${p.symbol} | ${formatPercent(p.gainPercent)} |`).join("\n")}

### 📉 Pires performers

| Symbole | Rendement |
|---------|-----------|
${performance.worstPerformers.map((p) => `| ${p.symbol} | ${formatPercent(p.gainPercent)} |`).join("\n")}

### Détail par position

| Symbole | Nom | Compte | Quantité | Valeur | Gain/Perte | % |
|---------|-----|--------|----------|--------|------------|---|
${performance.byPosition
  .sort((a, b) => b.marketValue - a.marketValue)
  .map(
    (p) =>
      `| ${p.symbol} | ${p.name} | ${p.accountType} | ${p.quantity.toFixed(4)} | ${formatCurrency(p.marketValue)} | ${formatCurrency(p.unrealizedGain)} | ${formatPercent(p.unrealizedGainPercent)} |`,
  )
  .join("\n")}

---

## 💰 Analyse des frais

| Métrique | Valeur |
|----------|--------|
| **Total des commissions** | ${formatCurrency(fees.totalCommissions)} |
| **Commission moyenne** | ${formatCurrency(fees.averageCommission)} |
| **Impact sur le portefeuille** | ${fees.impact.toFixed(3)}% |

### Frais par type de compte

| Compte | Frais |
|--------|-------|
${Object.entries(fees.feesByAccountType)
  .map(([type, amount]) => `| ${type} | ${formatCurrency(amount)} |`)
  .join("\n")}

---

## 🎯 Diversification

### Métriques clés

| Métrique | Valeur |
|----------|--------|
| **Score global** | ${diversification.score}/100 |
| **Nombre de positions** | ${diversification.numberOfPositions} |
| **Nombre d'actifs uniques** | ${diversification.numberOfAssets} |
| **Types de comptes** | ${diversification.numberOfAccountTypes} |

### Risque de concentration

- **Position principale** : ${diversification.concentrationRisk.topPosition.symbol} (${diversification.concentrationRisk.topPosition.percentage.toFixed(1)}%)
- **Top 3 positions** : ${diversification.concentrationRisk.top3Concentration.toFixed(1)}%
- **Top 5 positions** : ${diversification.concentrationRisk.top5Concentration.toFixed(1)}%

### Balance par type d'actif

| Type | Pourcentage |
|------|-------------|
${Object.entries(diversification.assetTypeBalance)
  .map(([type, pct]) => `| ${type} | ${pct.toFixed(1)}% |`)
  .join("\n")}

---

## ⚠️ Risques identifiés

${risks.length === 0 ? "✅ **Aucun risque majeur détecté** - Votre portefeuille présente une bonne structure." : ""}

${risks
  .map(
    (risk, index) => `
### ${index + 1}. ${risk.title}

**Niveau** : ${risk.level === "CRITICAL" ? "🔴 CRITIQUE" : risk.level === "HIGH" ? "🟠 ÉLEVÉ" : risk.level === "MEDIUM" ? "🟡 MOYEN" : "🟢 FAIBLE"}  
**Catégorie** : ${risk.category}

**Description** : ${risk.description}

**Impact** : ${risk.impact}

**Recommandation** : ${risk.recommendation}
`,
  )
  .join("\n---\n")}

---

## 💡 Recommandations

${recommendations
  .map(
    (rec, index) => `
### ${index + 1}. ${rec.title}

**Priorité** : ${rec.priority === "HIGH" ? "🔴 HAUTE" : rec.priority === "MEDIUM" ? "🟡 MOYENNE" : "🔵 BASSE"}  
**Catégorie** : ${rec.category}

**Situation actuelle** : ${rec.description}

**Action recommandée** : ${rec.action}

**Impact attendu** : ${rec.expectedImpact}
`,
  )
  .join("\n---\n")}

---

## 📝 Notes importantes

- Cette analyse est basée sur vos données Wealthsimple au ${date}.
- Les recommandations sont générées automatiquement et ne constituent pas des conseils financiers personnalisés.
- Consultez un conseiller financier pour des recommandations adaptées à votre situation.
- Les rendements passés ne garantissent pas les rendements futurs.

---

**Généré par Stock Screener Pro** - Analyse de portefeuille Wealthsimple  
Pour plus d'informations : https://github.com/akimsoule/screener
`;
}
