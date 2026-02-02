# Documentation de l'Analyse Macro-Technique

## Vue d'ensemble

Le système d'analyse `netlify/functions/app/analysis` implémente un moteur de scoring quantitatif avancé qui combine l'analyse technique traditionnelle avec le contexte macro-économique pour fournir des recommandations de trading robustes et adaptées au marché.

## Architecture

### Structure des fichiers

```
analysis/
├── index.ts           # Point d'entrée principal et orchestration
├── analysis.ts        # Moteur de scoring technique principal
├── macroRegime.ts     # Détection de régime macro-économique
├── assetClassBias.ts  # Calcul des biais sectoriels
├── portfolioManager.ts # Gestion et rééquilibrage de portefeuille
├── types.ts           # Définitions TypeScript
├── constants.ts       # Paramètres et seuils configurables
└── prices.ts          # Récupération des données de prix
```

## Flux d'analyse

### 1. Détection du régime macro (`macroRegime.ts`)

Le système commence par analyser le contexte macro-économique pour déterminer le régime de marché actuel.

#### Signaux utilisés :

- **Politique Fed** : Écart entre dot plot Fed et pricing du marché
- **ISM PMI** : Indicateur d'activité manufacturière
- **Momentum Dollar (DXY)** : Force/faiblesse du dollar
- **Croissance M2** : Expansion/contraction de la liquidité
- **Surprise NFP** : Écarts sur les données d'emploi

#### Phases détectées :

- `RISK_ON` : Environnement favorable aux actifs risqués
- `RISK_OFF` : Aversion au risque, fuite vers la qualité
- `TRANSITION` : Signaux contradictoires, approche prudente

### 2. Calcul des biais sectoriels (`assetClassBias.ts`)

En fonction du régime macro détecté, le système applique des biais d'allocation par classe d'actifs.

#### Règles principales :

- **Risk-On** : +15% actions, +20% crypto, +10% matières premières
- **Risk-Off** : +25% obligations, -15% actions, -25% crypto
- **Late Cycle** : Réduction significative de l'exposition crypto (-30%)
- **Dollar faible** : Bénéfique aux matières premières et crypto
- **Saisonnalité** : Boost crypto en octobre (October Pump)

### 3. Analyse technique (`analysis.ts`)

Le cœur du système analyse chaque symbole individuellement en intégrant le contexte macro.

#### Indicateurs techniques :

- **RSI** : Détection de surachat/survente
- **MACD** : Momentum et croisements
- **Bandes de Bollinger** : Volatilité et niveaux de support/résistance
- **ADX** : Force de tendance
- **ATR** : Volatilité pour le dimensionnement des positions

#### Régimes de marché détectés :

- `STRONG_TREND` : Tendance claire, forte conviction
- `WEAK_TREND` : Tendance présente mais faible
- `RANGE` : Marché latéral, faible momentum
- `CHOP` : Marché chaotique, forte volatilité

### 4. Gestion de portefeuille (`portfolioManager.ts`)

Le système fournit des recommandations de rééquilibrage basées sur :

- Exposition maximale par classe d'actifs
- Réduction en fin de cycle
- Prise de profits sur les positions gagnantes
- Gestion du risque de corrélation

## Métriques et seuils

### Seuils de scoring

```typescript
SCORE_THRESHOLDS = {
  STRONG_BUY: 70,
  BUY: 30,
  HOLD: [-30, 30],
  SELL: -30,
  STRONG_SELL: -70,
};
```

### Poids des indicateurs

```typescript
SCORE_WEIGHTS = {
  TREND: 0.25,
  MOMENTUM: 0.2,
  VOLATILITY: 0.15,
  VOLUME: 0.15,
  REGIME: 0.25,
};
```

### Paramètres de risque

```typescript
RISK_DEFAULTS = {
  MAX_RISK_PER_TRADE: 0.01, // 1% du capital par trade
  MAX_PORTFOLIO_RISK: 0.05, // 5% risque total
  MAX_POSITIONS: 10,
  MIN_CONFIDENCE: 60,
};
```

## Gestion des risques

### Dimensionnement des positions

- **Critère de Kelly** : Optimisation du ratio risque/récompense
- **Ajustement volatilité** : Réduction en période de forte volatilité
- **Limites de corrélation** : Évite la concentration sectorielle

### Filtres macro

- **VIX Threshold** : Stop trading si volatilité > seuil
- **Max Drawdown** : Arrêt automatique en cas de pertes excessives
- **Corrélation maximale** : Limite l'exposition corrélée

## Types de données

### AnalysisReport

```typescript
interface AnalysisReport {
  symbol: string;
  timestamp: Date;
  regime: Regime;
  rawScore: number; // Score brut [-100, +100]
  score: number; // Score normalisé
  action: string; // Recommandation textuelle
  confidence: number; // Niveau de confiance [%]
  recommendation: TradeRecommendation;
  interpretation: string; // Explication détaillée
}
```

### MacroRegime

```typescript
interface MacroRegime {
  phase: "RISK_ON" | "RISK_OFF" | "TRANSITION";
  cycleStage: "EARLY_CYCLE" | "MID_CYCLE" | "LATE_CYCLE" | "RECESSION";
  fedPolicy: "CUTTING" | "PAUSING" | "HIKING" | "HAWKISH_PAUSE";
  dollarRegime: "STRENGTHENING" | "WEAK" | "NEUTRAL";
  liquidity: "EXPANDING" | "CONTRACTING" | "NEUTRAL";
  confidence: number;
}
```

## Utilisation

### Analyse d'un symbole

```typescript
import { analyzeSymbolWithMacro } from "./analysis";

const result = await analyzeSymbolWithMacro(
  "AAPL",
  100000, // Valeur du compte
  marketData, // Données macro live
  currentPortfolio, // Positions actuelles
);
```

### Détection de régime macro uniquement

```typescript
import { detectMacroRegime } from "./analysis";

const regime = detectMacroRegime({
  fedDotPlot2025: 3.75,
  marketPricing2025: 3.7,
  ismPmi: 52.3,
  dxyMomentum: -2.1,
  m2Growth: 6.2,
  nfpSurprise: 25000,
});
```

## Philosophie d'investissement

Le système s'inspire de l'approche de Chris Liot (Liot Capital) en combinant :

- **Analyse top-down** : Contexte macro détermine l'allocation
- **Gestion quantitative** : Règles claires et backtestables
- **Risk management** : Protection du capital prioritaire
- **Adaptabilité** : Ajustements selon les régimes de marché

## Métriques de performance

Le système intègre des métriques pour l'évaluation :

- **Win Rate** : Taux de succès des trades
- **Profit Factor** : Ratio gains/pertes
- **Max Drawdown** : Plus forte perte cumulée
- **Sharpe Ratio** : Rendement ajusté au risque
- **Calmar Ratio** : Rendement / Max Drawdown

## Maintenance et évolution

### Calibration périodique

- Ajustement des seuils selon les conditions de marché
- Backtesting sur nouvelles données
- Validation des indicateurs

### Extensions possibles

- Intégration d'IA/ML pour la prédiction
- Analyse sentimentale des news
- Détection de patterns chartistes avancés
- Optimisation multi-actifs

---

_Documentation générée le 1 février 2026_</content>
<parameter name="filePath">/Volumes/FOLDER/dev/projects/screener/docs/analysis-logic.md
