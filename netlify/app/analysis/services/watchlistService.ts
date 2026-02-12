import { prisma } from "../../lib/prisma";
import { filterService, FilterOptions } from "./filterService";
import type { AnalysisReport } from "../types";
import { logger } from "../../lib/logger";
import { SERVER_PAGE_LIMIT } from "../../lib/constants";

export interface WatchlistItem {
  id: string;
  name: string;
  symbolType?: string | null;
  provider?: string | null;
  metadata?: any;
  lastAction?: string | null;
  lastScore?: number | null;
  lastPrice?: number | null;
  enabled: boolean;
  analysis?: AnalysisReport | null;
  cacheKey?: string | null;
}

export interface WatchlistResult {
  data: WatchlistItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  appliedFilters: Partial<FilterOptions>;
}

export class WatchlistService {
  private readonly DEFAULT_LIMIT = SERVER_PAGE_LIMIT;

  /**
   * Retourne la watchlist paginée en tenant compte des filtres.
   * Récupère les rapports d'analyse depuis le cache (analysis:report:${symbol}:regime:...)
   */
  async getWatchlist(
    options: FilterOptions = {},
    page = 1,
    limit = this.DEFAULT_LIMIT,
  ): Promise<WatchlistResult> {
    // Récupérer les symboles filtrés (méthode de FilterService)
    const filteredSymbols = await filterService.filterSymbols(options);

    const total = filteredSymbols.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const start = (page - 1) * limit;

    // 1) Regrouper toutes les entrées cache pour les symbols filtrés
    const prefixes = filteredSymbols.map(
      (f) => `analysis:report:${f.name}:regime:`,
    );

    const allCachedEntries = await this.fetchCachedEntries(prefixes);
    try {
      if (prefixes.length > 0) {
        // Construire un OR avec startsWith pour chaque préfixe
        const orClauses = prefixes.map((p) => ({
          key: { startsWith: p },
          expiresAt: { gt: new Date() },
        }));
        const cachedEntries = await prisma.cache.findMany({
          where: { OR: orClauses },
        });
        allCachedEntries.push(...cachedEntries);
      }
    } catch (err) {
      logger.warn(
        `⚠️ Erreur lecture cache analysis (bulk): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2) Pick best entry per symbol (bulk)

    const bestBySymbol = this.pickBestBySymbol(allCachedEntries);

    // 3) Construire la liste complète d'items enrichis (avec analysis si présente)
    const enriched = filteredSymbols.map((s) => {
      const best = bestBySymbol.get(s.name);
      const analysis = best?.value
        ? (best.value as unknown as AnalysisReport)
        : null;
      const cacheKey = best?.key ?? null;
      const score = analysis?.score ?? 0;
      return {
        symbolRow: s,
        analysis,
        cacheKey,
        score,
      };
    });

    // 3.b) Analyses : non prises en charge par ce service
    // Les analyses à la volée sont coûteuses en CPU / DB et sont exécutées ailleurs.
    // Ici, nous limitons le service à l'agrégation et lecture du cache uniquement.
    const missing = enriched
      .filter((e) => !e.analysis)
      .map((e) => e.symbolRow.name);

    if (missing.length > 0) {
      logger.info(
        `Skipping on-the-fly analysis for ${missing.length} symbols in WatchlistService`,
      );
    }

    // 4) Trier l'ensemble par |score| desc, tie-breaker score desc
    enriched.sort((a, b) => {
      const absA = Math.abs(a.score ?? 0);
      const absB = Math.abs(b.score ?? 0);
      if (absB !== absA) return absB - absA;
      return (b.score ?? 0) - (a.score ?? 0);
    });

    // 5) Paginer après tri
    const pageSlice = enriched.slice(start, start + limit);

    const data: WatchlistItem[] = pageSlice.map(
      ({ symbolRow: s, analysis, cacheKey }) => ({
        id: s.id,
        name: s.name,
        symbolType: s.symbolType,
        provider: s.provider,
        metadata: s.metadata,
        lastAction: s.lastAction,
        lastScore: s.lastScore,
        lastPrice: s.lastPrice,
        enabled: s.enabled,
        analysis,
        cacheKey,
      }),
    );

    return {
      data,
      pagination: { page, limit, total, totalPages },
      appliedFilters: options,
    };
  }

  private async fetchCachedEntries(prefixes: string[]): Promise<any[]> {
    if (!prefixes || prefixes.length === 0) return [];
    try {
      const orClauses = prefixes.map((p) => ({
        key: { startsWith: p },
        expiresAt: { gt: new Date() },
      }));
      return await prisma.cache.findMany({ where: { OR: orClauses } });
    } catch (err) {
      logger.warn(
        `⚠️ Erreur lecture cache analysis (bulk): ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private getAbsScoreFromEntry(entry: any): number {
    const score = (entry?.value as any)?.score;
    return Number.isFinite(score) ? Math.abs(score) : Number.NEGATIVE_INFINITY;
  }

  private pickBestBySymbol(entries: any[]): Map<string, any> {
    const map = new Map<string, any>();
    const keyRegex = /^analysis:report:([^:]+):regime:/i;

    for (const entry of entries) {
      const match = keyRegex.exec(entry.key);
      if (!match) continue;
      const symbol = match[1];

      const entryAbs = this.getAbsScoreFromEntry(entry);

      const current = map.get(symbol);
      if (!current) {
        map.set(symbol, entry);
        continue;
      }

      const currentAbs = this.getAbsScoreFromEntry(current);

      if (entryAbs > currentAbs) {
        map.set(symbol, entry);
      } else if (entryAbs === currentAbs) {
        if (entry.updatedAt > current.updatedAt) {
          map.set(symbol, entry);
        }
      }
    }

    return map;
  }
}

export const watchlistService = new WatchlistService();
