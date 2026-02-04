// Types pour l'analyse de portefeuille Wealthsimple

export interface WealthsimpleActivity {
  date_transaction: string;
  date_reglement: string;
  compte_id: string;
  type_compte: string;
  type_activite: string;
  sous_type_activite: string;
  direction: string;
  symbole: string;
  nom: string;
  devise: string;
  quantite: number;
  prix_unitaire: number;
  commission: number;
  montant_net_especes: number;
}

export interface WealthsimpleHolding {
  nom_du_compte: string;
  type_de_compte: string;
  classification_du_compte: string;
  numero_de_compte: string;
  symbole: string;
  bourse: string;
  mic: string;
  nom: string;
  type: string;
  quantite: number;
  direction_de_position: string;
  prix_du_marche: number;
  devise_du_prix: string;
  valeur_comptable_cad: number;
  devise_de_la_valeur_comptable_cad: string;
  valeur_comptable_marche: number;
  devise_de_la_valeur_comptable_marche: string;
  valeur_marchande: number;
  devise_de_la_valeur_marchande: string;
  rendements_non_realises_du_marche: number;
  devise_des_rendements_non_realises_du_marche: string;
}

export interface AllocationData {
  byAccountType: Record<string, { value: number; percentage: number }>;
  byAsset: Record<
    string,
    { value: number; percentage: number; quantity: number }
  >;
  bySector: Record<string, { value: number; percentage: number }>;
  byAssetType: Record<string, { value: number; percentage: number }>;
}

export interface PerformanceData {
  overall: {
    totalValue: number;
    totalCost: number;
    totalGain: number;
    totalGainPercent: number;
  };
  byPosition: Array<{
    symbol: string;
    name: string;
    accountType: string;
    quantity: number;
    marketValue: number;
    bookValue: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
  }>;
  topPerformers: Array<{ symbol: string; gainPercent: number }>;
  worstPerformers: Array<{ symbol: string; gainPercent: number }>;
  quoteTypeMap?: Map<string, string | undefined>; // Type de quote Yahoo Finance (ETF, EQUITY, etc.)
}

export interface FeesData {
  totalCommissions: number;
  averageCommission: number;
  commissionsPerTrade: number;
  feesByAccountType: Record<string, number>;
  impact: number; // Impact des frais sur le rendement (%)
}

export interface DiversificationData {
  score: number; // Score de 0 à 100
  numberOfPositions: number;
  numberOfAssets: number;
  numberOfAccountTypes: number;
  concentrationRisk: {
    topPosition: { symbol: string; percentage: number };
    top3Concentration: number;
    top5Concentration: number;
  };
  assetTypeBalance: Record<string, number>;
}

export interface Risk {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category:
    | "CONCENTRATION"
    | "LEVERAGE"
    | "VOLATILITY"
    | "LIQUIDITY"
    | "FEES"
    | "TAX";
  title: string;
  description: string;
  impact: string;
  recommendation: string;
}

export interface Recommendation {
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: "DIVERSIFICATION" | "ALLOCATION" | "FEES" | "TAX" | "REBALANCING";
  title: string;
  description: string;
  action: string;
  expectedImpact: string;
}

export interface PortfolioAnalysisResult {
  summary: {
    totalValue: number;
    totalCost: number;
    totalUnrealizedGain: number;
    totalUnrealizedGainPercent: number;
    totalCommissions: number;
    analysisDate: string;
  };
  allocation: AllocationData;
  performance: PerformanceData;
  fees: FeesData;
  diversification: DiversificationData;
  risks: Risk[];
  recommendations: Recommendation[];
}

export interface PortfolioUploadRequest {
  activitiesFile: File;
  holdingsFile: File;
}

export interface PortfolioUploadResponse {
  success: boolean;
  analysisId: string;
  analysis: PortfolioAnalysisResult;
  message?: string;
  error?: string;
}
