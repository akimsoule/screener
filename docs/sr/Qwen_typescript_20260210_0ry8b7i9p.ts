import { OHLC } from "../../../lib/data";
import { logger } from "../../../lib/logger";
import { clamp, normalizeValue } from "./utils";
import type { SupportResistanceAnalysis, SupportResistanceLevel } from "../types";

const SR_CONFIG = {
  MIN_SWING_BARS: 3, // Bars à gauche/droite pour valider un swing
  MAX_LEVELS: 7, // Nombre max de niveaux retournés (éviter le bruit)
  NEAR_THRESHOLD_PCT: 1.5, // Considéré "proche" si < 1.5%
  MIN_STRENGTH: 40, // Seuil pour niveau "significatif"
  DECAY_DAYS: 90, // Pondération décroissante après 90 jours
  VOLUME_WEIGHT: 0.3, // Poids du volume dans le calcul de strength
  RECENT_WEIGHT: 0.4, // Poids de la récence
  SWING_WEIGHT: 0.3, // Poids du nombre de rebonds
};

/**
 * Détecte les swing highs/lows avec validation de volume et durée
 */
function detectSwingPoints(
  ohlc: OHLC[],
  minBars: number = SR_CONFIG.MIN_SWING_BARS,
): Array<{ price: number; type: "HIGH" | "LOW"; index: number; volume: number }> {
  const swings: Array<{ price: number; type: "HIGH" | "LOW"; index: number; volume: number }> = [];

  for (let i = minBars; i < ohlc.length - minBars; i++) {
    const current = ohlc[i];
    
    // Swing High : plus haut que voisins
    const isSwingHigh =
      current.high > Math.max(...ohlc.slice(i - minBars, i).map(o => o.high)) &&
      current.high > Math.max(...ohlc.slice(i + 1, i + minBars + 1).map(o => o.high));
    
    // Swing Low : plus bas que voisins
    const isSwingLow =
      current.low < Math.min(...ohlc.slice(i - minBars, i).map(o => o.low)) &&
      current.low < Math.min(...ohlc.slice(i + 1, i + minBars + 1).map(o => o.low));

    if (isSwingHigh) {
      swings.push({ price: current.high, type: "HIGH", index: i, volume: current.volume || 0 });
    } else if (isSwingLow) {
      swings.push({ price: current.low, type: "LOW", index: i, volume: current.volume || 0 });
    }
  }

  return swings;
}

/**
 * Cluster les niveaux proches (DBSCAN-like simple) pour éviter la surcharge
 */
function clusterLevels(
  rawLevels: Array<{ price: number; type: "HIGH" | "LOW"; volume: number; daysAgo: number }>,
  priceTolerancePct: number = 1.2,
): SupportResistanceLevel[] {
  if (rawLevels.length === 0) return [];

  // Trier par prix
  rawLevels.sort((a, b) => a.price - b.price);

  const clusters: Array<{
    prices: number[];
    types: ("HIGH" | "LOW")[];
    volumes: number[];
    daysAgo: number[];
  }> = [];

  for (const level of rawLevels) {
    const tolerance = level.price * (priceTolerancePct / 100);
    
    // Chercher un cluster existant
    const existing = clusters.find(c => 
      Math.abs(level.price - c.prices[0]) <= tolerance
    );

    if (existing) {
      existing.prices.push(level.price);
      existing.types.push(level.type);
      existing.volumes.push(level.volume);
      existing.daysAgo.push(level.daysAgo);
    } else {
      clusters.push({
        prices: [level.price],
        types: [level.type],
        volumes: [level.volume],
        daysAgo: [level.daysAgo],
      });
    }
  }

  // Créer les niveaux consolidés
  return clusters.map(cluster => {
    const avgPrice = cluster.prices.reduce((a, b) => a + b, 0) / cluster.prices.length;
    const dominantType = cluster.types.filter(t => t === "HIGH").length > 
                         cluster.types.filter(t => t === "LOW").length 
                         ? "RESISTANCE" : "SUPPORT";
    
    // Calcul de strength pondéré
    const avgVolume = cluster.volumes.reduce((a, b) => a + b, 0) / cluster.volumes.length;
    const maxVolume = Math.max(...cluster.volumes);
    const volumeScore = normalizeValue(avgVolume, 0, maxVolume) * 100;
    
    const avgDaysAgo = cluster.daysAgo.reduce((a, b) => a + b, 0) / cluster.daysAgo.length;
    const recencyScore = Math.max(0, 100 - (avgDaysAgo / SR_CONFIG.DECAY_DAYS) * 100);
    
    const swingScore = Math.min(cluster.prices.length * 25, 100); // Max 4 tests = 100

    const strength =
      volumeScore * SR_CONFIG.VOLUME_WEIGHT +
      recencyScore * SR_CONFIG.RECENT_WEIGHT +
      swingScore * SR_CONFIG.SWING_WEIGHT;

    return {
      price: avgPrice,
      type: dominantType,
      strength: clamp(strength, 0, 100),
      distancePercent: 0, // Sera calculé plus tard
      lastTestDate: new Date(Date.now() - Math.min(...cluster.daysAgo) * 24 * 60 * 60 * 1000),
      swingCount: cluster.prices.length,
      isSignificant: strength >= SR_CONFIG.MIN_STRENGTH,
    };
  });
}

/**
 * Analyse complète S/R avec détection de "gap strength"
 */
export function analyzeSupportResistance(
  ohlc: OHLC[],
  currentPrice: number,
  lookbackDays: number = 180,
): SupportResistanceAnalysis {
  // 1. Filtrer les données récentes
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  const recentOhlc = ohlc.filter(o => new Date(o.date) >= cutoffDate);
  
  if (recentOhlc.length < 30) {
    logger.warn(`⚠️ Données insuffisantes pour S/R analysis (${recentOhlc.length} bars)`);
    return buildEmptyAnalysis(currentPrice);
  }

  // 2. Détecter swing points
  const swings = detectSwingPoints(recentOhlc, SR_CONFIG.MIN_SWING_BARS);
  
  // 3. Préparer pour clustering
  const rawLevels = swings.map(swing => {
    const daysAgo = recentOhlc.length - swing.index;
    return {
      price: swing.price,
      type: swing.type,
      volume: swing.volume,
      daysAgo,
    };
  });

  // 4. Clusteriser
  let levels = clusterLevels(rawLevels);
  
  // 5. Calculer distances et trier
  levels.forEach(level => {
    level.distancePercent = Math.abs((currentPrice - level.price) / level.price) * 100;
  });
  
  // Garder uniquement les niveaux significatifs ou très proches
  levels = levels
    .filter(l => l.isSignificant || l.distancePercent < SR_CONFIG.NEAR_THRESHOLD_PCT * 2)
    .sort((a, b) => a.distancePercent - b.distancePercent)
    .slice(0, SR_CONFIG.MAX_LEVELS);

  // 6. Identifier plus proche support/résistance
  const supports = levels.filter(l => l.type === "SUPPORT" && l.price < currentPrice);
  const resistances = levels.filter(l => l.type === "RESISTANCE" && l.price > currentPrice);

  const nearestSupport = supports.sort((a, b) => b.price - a.price)[0]; // Plus haut support sous prix
  const nearestResistance = resistances.sort((a, b) => a.price - b.price)[0]; // Plus basse résistance au-dessus

  const isNearSupport = !!nearestSupport && nearestSupport.distancePercent < SR_CONFIG.NEAR_THRESHOLD_PCT;
  const isNearResistance = !!nearestResistance && nearestResistance.distancePercent < SR_CONFIG.NEAR_THRESHOLD_PCT;

  // 7. Calculer "gap strength" : distance entre résistances consécutives
  let gapStrength = 0;
  let gapDirection: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";

  if (resistances.length >= 2) {
    // Trier résistances par prix croissant
    const sortedRes = [...resistances].sort((a, b) => a.price - b.price);
    const currentRes = sortedRes[0];
    const nextRes = sortedRes[1];
    
    // Distance relative entre résistances
    const gapPct = ((nextRes.price - currentRes.price) / currentRes.price) * 100;
    
    // Normaliser : gap > 15% = très fort momentum
    gapStrength = normalizeValue(gapPct, 5, 25) * 100;
    gapDirection = "BULLISH"; // Zone vide au-dessus = potentiel de hausse
    
  } else if (supports.length >= 2) {
    const sortedSup = [...supports].sort((a, b) => b.price - a.price);
    const currentSup = sortedSup[0];
    const nextSup = sortedSup[1];
    
    const gapPct = ((currentSup.price - nextSup.price) / currentSup.price) * 100;
    gapStrength = normalizeValue(gapPct, 5, 25) * 100;
    gapDirection = "BEARISH"; // Zone vide en dessous = risque de baisse
  }

  // 8. Interprétation
  let interpretation = "";
  if (gapStrength > 70) {
    interpretation = gapDirection === "BULLISH"
      ? "🚀 Momentum fort : grande zone vide au-dessus (résistance éloignée). Potentiel de continuation haussière."
      : "⚠️ Momentum baissier : grande zone vide en dessous. Risque de correction accélérée.";
  } else if (isNearSupport && isNearResistance) {
    interpretation = "📊 Prix coincé entre support et résistance → consolidation attendue.";
  } else if (isNearSupport) {
    interpretation = "🛡️ Rebond potentiel sur support testé. Niveau critique à surveiller.";
  } else if (isNearResistance) {
    interpretation = "⚠️ Approche d'une résistance clé. Risque de rejet ou breakout.";
  } else {
    interpretation = "🧭 Pas de niveau S/R immédiat. Marché en tendance ou zone neutre.";
  }

  return {
    levels,
    nearestSupport,
    nearestResistance,
    isNearSupport,
    isNearResistance,
    gapStrength: clamp(gapStrength, 0, 100),
    gapDirection,
    interpretation,
  };
}

function buildEmptyAnalysis(currentPrice: number): SupportResistanceAnalysis {
  return {
    levels: [],
    isNearSupport: false,
    isNearResistance: false,
    gapStrength: 0,
    gapDirection: "NEUTRAL",
    interpretation: "Pas de données suffisantes pour l'analyse S/R",
  };
}