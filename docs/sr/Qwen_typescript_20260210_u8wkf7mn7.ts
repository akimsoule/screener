export interface SupportResistanceLevel {
  price: number;
  type: "SUPPORT" | "RESISTANCE";
  strength: number; // 0-100 (basé sur rebonds + volume + récence)
  distancePercent: number; // Distance % du prix actuel
  lastTestDate: Date;
  swingCount: number; // Nombre de tests historiques
  isSignificant: boolean; // Niveau majeur (> seuil de strength)
}

export interface SupportResistanceAnalysis {
  levels: SupportResistanceLevel[];
  nearestSupport?: SupportResistanceLevel;
  nearestResistance?: SupportResistanceLevel;
  isNearSupport: boolean;
  isNearResistance: boolean;
  gapStrength: number; // 0-100 : distance résistance actuelle vs précédente (↑ = momentum fort)
  gapDirection: "BULLISH" | "BEARISH" | "NEUTRAL"; // Bullish = grande zone vide au-dessus
  interpretation: string;
}