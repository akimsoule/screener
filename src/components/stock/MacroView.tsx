import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import type { MacroRegime, AssetClassBias } from "@/types/stock";
import { getMacroData } from "@/lib/netlifyApi";

interface MacroData {
  timestamp: string;
  marketData: {
    fedDotPlot2025: number;
    marketPricing2025: number;
    ismPmi: number;
    dxyMomentum: number;
    m2Growth: number;
    nfpSurprise: number;
  };
  macroRegime: MacroRegime;
  assetBias: AssetClassBias;
}

export function MacroView() {
  const [macroData, setMacroData] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMacroData = async () => {
      try {
        const data = await getMacroData();
        setMacroData(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchMacroData();
    // Rafraîchir toutes les 5 minutes
    const interval = setInterval(fetchMacroData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </Card>
    );
  }

  if (error || !macroData) {
    return (
      <Card className="p-6">
        <p className="text-red-500">
          Erreur lors du chargement des données macro: {error}
        </p>
      </Card>
    );
  }

  const { macroRegime, assetBias, marketData } = macroData;

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "RISK_ON":
        return "text-green-600 dark:text-green-400";
      case "RISK_OFF":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-yellow-600 dark:text-yellow-400";
    }
  };

  const getBiasColor = (bias: number) => {
    if (bias > 10) return "text-green-600 dark:text-green-400";
    if (bias < -10) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getBiasIcon = (bias: number) => {
    if (bias > 0) return <TrendingUp className="w-4 h-4 inline-block ml-1" />;
    if (bias < 0) return <TrendingDown className="w-4 h-4 inline-block ml-1" />;
    return <Activity className="w-4 h-4 inline-block ml-1" />;
  };

  const getSynthesisText = () => {
    if (
      macroRegime.phase === "RISK_ON" &&
      macroRegime.cycleStage === "LATE_CYCLE"
    ) {
      return (
        <>
          Les marchés évoluent actuellement en régime <strong>RISK-ON</strong>{" "}
          avec un niveau de confiance de {macroRegime.confidence}%, mais nous
          identifions des signaux de <strong>fin de cycle économique</strong>{" "}
          qui appellent à la vigilance.
        </>
      );
    }
    if (
      macroRegime.phase === "RISK_ON" &&
      macroRegime.cycleStage !== "LATE_CYCLE"
    ) {
      const cycleText =
        macroRegime.cycleStage === "EARLY_CYCLE"
          ? "de reprise précoce"
          : "d'expansion soutenue";
      return (
        <>
          Les conditions macroéconomiques actuelles favorisent un régime{" "}
          <strong>RISK-ON</strong> (confiance: {macroRegime.confidence}%), avec
          un cycle économique en phase {cycleText}.
        </>
      );
    }
    if (macroRegime.phase === "RISK_OFF") {
      return (
        <>
          Les marchés sont entrés en régime <strong>RISK-OFF</strong>{" "}
          (confiance: {macroRegime.confidence}%), caractérisé par une aversion
          marquée au risque et une fuite vers les actifs refuges.
        </>
      );
    }
    if (macroRegime.phase === "TRANSITION") {
      return (
        <>
          Les marchés traversent une phase de <strong>TRANSITION</strong>{" "}
          (confiance: {macroRegime.confidence}%), marquée par des signaux
          contradictoires nécessitant une approche prudente et diversifiée.
        </>
      );
    }
    return null;
  };

  const getFedPolicyText = () => {
    let policyText = "";
    if (macroRegime.fedPolicy === "CUTTING")
      policyText = "accommodante avec des baisses de taux";
    else if (macroRegime.fedPolicy === "PAUSING")
      policyText = "d'attentisme avec une pause dans le cycle";
    else if (macroRegime.fedPolicy === "HIKING")
      policyText = "restrictive avec des hausses de taux";
    else if (macroRegime.fedPolicy === "HAWKISH_PAUSE")
      policyText = "de pause hawkish maintenant un biais restrictif";

    const divergence = Math.abs(
      marketData.fedDotPlot2025 - marketData.marketPricing2025,
    );
    const divergenceText =
      divergence > 0.5 ? (
        <>
          {" "}
          Cette divergence de <strong>{divergence.toFixed(2)}%</strong> entre la
          Fed et le marché constitue un facteur de volatilité potentiel et
          suggère que{" "}
          {marketData.marketPricing2025 < marketData.fedDotPlot2025
            ? "les investisseurs anticipent un assouplissement plus marqué que la Fed ne le prévoit"
            : "la Fed pourrait adopter une politique plus accommodante que le marché ne l'anticipe"}
          .
        </>
      ) : (
        <>
          {" "}
          L'alignement relatif entre les prévisions de la Fed et les
          anticipations du marché réduit l'incertitude sur la trajectoire des
          taux.
        </>
      );

    return (
      <>
        La Réserve Fédérale américaine adopte actuellement une posture{" "}
        <strong>{policyText}</strong>. Selon le dernier Fed Dot Plot, les
        prévisions officielles tablent sur un taux directeur de{" "}
        {marketData.fedDotPlot2025}% pour 2025, tandis que les anticipations du
        marché (pricing via futures) s'établissent à{" "}
        {marketData.marketPricing2025}%.
        {divergenceText}
      </>
    );
  };

  const getEconomicCycleText = () => {
    let cycleStageText = "";
    if (macroRegime.cycleStage === "EARLY_CYCLE")
      cycleStageText = "début de cycle";
    else if (macroRegime.cycleStage === "MID_CYCLE")
      cycleStageText = "mi-cycle";
    else if (macroRegime.cycleStage === "LATE_CYCLE")
      cycleStageText = "fin de cycle";
    else if (macroRegime.cycleStage === "RECESSION")
      cycleStageText = "récession";

    let ismText = "";
    if (marketData.ismPmi > 55)
      ismText =
        " signalant une expansion robuste du secteur manufacturier bien au-dessus du seuil de 50";
    else if (marketData.ismPmi > 50)
      ismText = " indiquant une expansion modérée de l'activité manufacturière";
    else if (marketData.ismPmi > 45)
      ismText = " révélant une contraction modérée qui appelle à la vigilance";
    else
      ismText =
        " témoignant d'une contraction significative de l'activité, signal précurseur potentiel de récession";

    let nfpText = "";
    if (marketData.nfpSurprise > 100000)
      nfpText =
        "révélant une vigueur exceptionnelle du marché du travail qui pourrait maintenir la pression inflationniste";
    else if (marketData.nfpSurprise > 0)
      nfpText = "confirmant la résilience du marché de l'emploi";
    else if (marketData.nfpSurprise > -100000)
      nfpText = "suggérant un ralentissement modéré du marché du travail";
    else nfpText = "signalant une détérioration préoccupante de l'emploi";

    return (
      <>
        L'économie se situe en phase de <strong>{cycleStageText}</strong>.
        L'indice ISM PMI manufacturier s'établit à{" "}
        <strong>{marketData.ismPmi.toFixed(1)}</strong>,{ismText}. Les dernières
        données NFP (Non-Farm Payrolls) affichent une surprise de{" "}
        <strong>
          {marketData.nfpSurprise > 0 ? "+" : ""}
          {marketData.nfpSurprise.toLocaleString()}
        </strong>{" "}
        emplois par rapport au consensus, {nfpText}.
      </>
    );
  };

  const getLiquidityText = () => {
    let liquidityRegime = "";
    if (macroRegime.liquidity === "EXPANDING") liquidityRegime = "expansion";
    else if (macroRegime.liquidity === "CONTRACTING")
      liquidityRegime = "contraction";
    else if (macroRegime.liquidity === "NEUTRAL")
      liquidityRegime = "stabilisation";

    let liquidityDesc = "";
    if (macroRegime.liquidity === "EXPANDING") {
      liquidityDesc =
        " Cette expansion de la liquidité globale constitue un vent porteur pour les actifs risqués, en particulier les actions de croissance et les cryptomonnaies, en abaissant le coût du capital et en stimulant la valorisation des actifs financiers.";
    } else if (macroRegime.liquidity === "CONTRACTING") {
      liquidityDesc =
        " Cette contraction de la liquidité exerce une pression baissière sur les valorisations d'actifs risqués et favorise une rotation vers les actifs de qualité et défensifs.";
    } else if (macroRegime.liquidity === "NEUTRAL") {
      liquidityDesc =
        " Cette stabilisation de la liquidité suggère un environnement neutre où la performance dépendra davantage des fondamentaux spécifiques à chaque classe d'actifs.";
    }

    let dollarRegime = "";
    if (macroRegime.dollarRegime === "STRENGTHENING")
      dollarRegime = "renforcement";
    else if (macroRegime.dollarRegime === "WEAK") dollarRegime = "faiblesse";
    else if (macroRegime.dollarRegime === "NEUTRAL")
      dollarRegime = "neutralité";

    let dollarDesc = "";
    if (macroRegime.dollarRegime === "STRENGTHENING") {
      dollarDesc =
        " Cette appréciation du dollar reflète généralement une fuite vers la qualité et pénalise les actifs risqués, notamment les marchés émergents et les matières premières.";
    } else if (macroRegime.dollarRegime === "WEAK") {
      dollarDesc =
        " Cette dépréciation du dollar favorise les actifs risqués, les marchés émergents et les matières premières libellées en USD.";
    } else if (macroRegime.dollarRegime === "NEUTRAL") {
      dollarDesc =
        " Cette stabilité du dollar minimise l'impact des variations de change sur les allocations d'actifs.";
    }

    return (
      <>
        La masse monétaire M2 affiche une croissance annuelle de{" "}
        <strong>{marketData.m2Growth.toFixed(1)}%</strong>, caractérisant un
        régime de liquidité en <strong>{liquidityRegime}</strong>.
        {liquidityDesc} Le momentum trimestriel du dollar américain (DXY)
        s'établit à <strong>{marketData.dxyMomentum.toFixed(1)}%</strong>,
        indiquant un régime de <strong>{dollarRegime}</strong> du billet vert.
        {dollarDesc}
      </>
    );
  };

  const getStrategicRecommendationText = () => {
    if (
      macroRegime.phase === "RISK_ON" &&
      macroRegime.cycleStage === "LATE_CYCLE"
    ) {
      return (
        <>
          Dans ce contexte de fin de cycle en régime risk-on, nous recommandons
          une approche <strong>prudente et sélective</strong>. Privilégiez la
          prise de profits progressive sur les positions les plus risquées et
          initiez une rotation vers des secteurs défensifs (santé, consommation
          de base, utilities) et des actifs de qualité. Maintenez une allocation
          obligataire diversifiée incluant des maturités intermédiaires pour
          bénéficier d'une éventuelle baisse des taux. Limitez l'exposition aux
          actifs spéculatifs (crypto, small caps) et privilégiez les large caps
          de qualité avec des bilans solides.
        </>
      );
    }
    if (
      macroRegime.phase === "RISK_ON" &&
      macroRegime.cycleStage === "EARLY_CYCLE"
    ) {
      return (
        <>
          L'environnement actuel de début de cycle en régime risk-on offre des
          opportunités <strong>attractives sur les actifs risqués</strong>. Nous
          recommandons une surpondération sur les actions cycliques
          (financières, industrielles, matériaux), les small et mid-caps, ainsi
          qu'une exposition sélective aux cryptomonnaies majeures. Les matières
          premières industrielles bénéficient également de cette phase de
          reprise. Maintenez une duration obligataire courte pour limiter le
          risque de taux. C'est le moment d'augmenter progressivement
          l'exposition au risque tout en conservant une diversification
          prudente.
        </>
      );
    }
    if (
      macroRegime.phase === "RISK_ON" &&
      macroRegime.cycleStage === "MID_CYCLE"
    ) {
      return (
        <>
          La phase de mi-cycle en régime risk-on justifie un positionnement{" "}
          <strong>équilibré avec biais croissance</strong>. Maintenez une
          allocation diversifiée entre actions de croissance et valeur, avec une
          légère surpondération sur la tech et les secteurs bénéficiant de
          l'expansion économique. Les obligations investment grade offrent un
          portage attractif. Une exposition modérée aux actifs alternatifs
          (crypto, matières premières) permet de diversifier les sources de
          rendement. C'est une phase favorable pour optimiser le couple
          rendement/risque sans excès de prudence ni d'agressivité.
        </>
      );
    }
    if (macroRegime.phase === "RISK_OFF") {
      return (
        <>
          Le régime risk-off actuel impose une posture{" "}
          <strong>défensive et conservatrice</strong>. Réduisez
          significativement l'exposition aux actifs risqués au profit des
          valeurs refuges : obligations gouvernementales de qualité (Treasuries
          US, Bunds), secteurs défensifs (santé, utilities, consommation de
          base), or et liquidités. Évitez les actifs spéculatifs et les marchés
          émergents. Si vous maintenez une exposition actions, privilégiez les
          dividend aristocrats et les entreprises à faible beta. La priorité est
          la préservation du capital plutôt que la recherche de performance.
        </>
      );
    }
    if (macroRegime.phase === "TRANSITION") {
      return (
        <>
          La phase de transition actuelle nécessite une approche{" "}
          <strong>agile et diversifiée</strong>. Face à l'incertitude
          macroéconomique, privilégiez une allocation équilibrée sans biais
          directionnel fort. Diversifiez entre actions (avec un biais qualité),
          obligations (mix duration courte et intermédiaire), matières premières
          et liquidités. Adoptez une gestion tactique avec des rééquilibrages
          fréquents en fonction de l'évolution des indicateurs. Évitez les
          concentrations sectorielles ou géographiques excessives. Restez
          attentif aux signaux de rupture qui indiqueraient une sortie de cette
          phase transitoire vers un régime plus clairement défini.
        </>
      );
    }
    return null;
  };

  const getAssetLabel = (asset: string) => {
    switch (asset) {
      case "equities":
        return "Actions";
      case "crypto":
        return "Crypto";
      case "bonds":
        return "Obligations";
      case "commodities":
        return "Matières 1ères";
      case "forex":
        return "Forex";
      default:
        return asset;
    }
  };

  const getAssetDescription = (assetType: string, biasValue: number) => {
    const descriptions: Record<
      string,
      { positive: string; neutral: string; negative: string }
    > = {
      equities: {
        positive: "Momentum haussier fort",
        neutral: "Tendance neutre, consolidation",
        negative: "Pression baissière, prudence",
      },
      crypto: {
        positive: "Risk-on, forte demande spéculative",
        neutral: "Consolidation, attente de catalyseur",
        negative: "Aversion au risque, fuite liquidité",
      },
      bonds: {
        positive: "Recherche de sécurité, baisse taux",
        neutral: "Équilibre rendement/risque",
        negative: "Hausse taux, rotation vers risque",
      },
      commodities: {
        positive: "Inflation/demande forte, refuge",
        neutral: "Équilibre offre/demande",
        negative: "Récession anticipée, baisse demande",
      },
      forex: {
        positive: "Opportunités devises émergentes",
        neutral: "Parités stables, faible volatilité",
        negative: "Fuite vers dollar, risk-off",
      },
    };

    const desc = descriptions[assetType];
    if (!desc) return "";

    if (biasValue > 10) return desc.positive;
    if (biasValue < -10) return desc.negative;
    return desc.neutral;
  };

  return (
    <div className="space-y-4">
      {/* Explication contextuelle */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <details className="cursor-pointer group">
          <summary className="flex items-center justify-between list-none">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                Rapport d'Analyse Macroéconomique
              </h3>
            </div>
            <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-6 space-y-6">
            {/* Synthèse exécutive */}
            <div className="mb-6 pb-4 border-b border-blue-200 dark:border-blue-700">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 text-sm uppercase tracking-wide">
                Synthèse Exécutive
              </h4>
              <p className="text-base text-blue-900 dark:text-blue-100 leading-relaxed font-medium">
                {getSynthesisText()}
              </p>
            </div>

            {/* Analyse détaillée */}
            <div className="space-y-4 text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {/* Politique monétaire */}
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>{" "}
                  Politique Monétaire & Anticipations de Marché
                </h4>
                <p>{getFedPolicyText()}</p>
              </div>

              {/* Cycle économique et données réelles */}
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>{" "}
                  Cycle Économique & Indicateurs d'Activité
                </h4>
                <p>{getEconomicCycleText()}</p>
              </div>

              {/* Liquidité et conditions monétaires */}
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>{" "}
                  Liquidité & Conditions Monétaires
                </h4>
                <p>{getLiquidityText()}</p>
              </div>

              {/* Recommandations stratégiques */}
              <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-700">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>{" "}
                  Positionnement Stratégique Recommandé
                </h4>
                <p>{getStrategicRecommendationText()}</p>
              </div>

              {/* Disclaimer */}
              <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-600 dark:text-blue-300 italic">
                  💡 Cette analyse est générée automatiquement à partir
                  d'indicateurs macroéconomiques en temps réel. Elle ne
                  constitue pas un conseil en investissement personnalisé.
                  Consultez un conseiller financier pour des recommandations
                  adaptées à votre profil de risque et vos objectifs.
                </p>
              </div>
            </div>
          </div>
        </details>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">
          Indicateurs Macroéconomiques
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Phase du marché */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Phase du marché
            </p>
            <p
              className={`text-2xl font-bold ${getPhaseColor(macroRegime.phase)}`}
            >
              {(() => {
                if (macroRegime.phase === "RISK_ON") return "🟢 RISK-ON";
                if (macroRegime.phase === "RISK_OFF") return "🔴 RISK-OFF";
                return "🟡 TRANSITION";
              })()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Confiance: {macroRegime.confidence}%
            </p>
          </div>

          {/* Stade du cycle */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Stade du cycle
            </p>
            <p className="text-xl font-semibold">
              {macroRegime.cycleStage === "LATE_CYCLE" && "⚠️ Fin de cycle"}
              {macroRegime.cycleStage === "MID_CYCLE" && "📊 Mi-cycle"}
              {macroRegime.cycleStage === "EARLY_CYCLE" && "🌱 Début de cycle"}
              {macroRegime.cycleStage === "RECESSION" && "📉 Récession"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {macroRegime.cycleStage === "EARLY_CYCLE" &&
                "Reprise économique, taux bas, opportunités"}
              {macroRegime.cycleStage === "MID_CYCLE" &&
                "Expansion stable, croissance soutenue"}
              {macroRegime.cycleStage === "LATE_CYCLE" &&
                "Surchauffe, inflation, vigilance requise"}
              {macroRegime.cycleStage === "RECESSION" &&
                "Contraction économique, actifs défensifs"}
            </p>
          </div>

          {/* Politique Fed */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Politique Fed
            </p>
            <p className="text-xl font-semibold">
              {macroRegime.fedPolicy === "CUTTING" && "✂️ Baisse des taux"}
              {macroRegime.fedPolicy === "PAUSING" && "⏸️ Pause"}
              {macroRegime.fedPolicy === "HIKING" && "📈 Hausse des taux"}
              {macroRegime.fedPolicy === "HAWKISH_PAUSE" && "🦅 Pause hawkish"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {macroRegime.fedPolicy === "CUTTING" &&
                "Soutien à la croissance, favorable au risque"}
              {macroRegime.fedPolicy === "PAUSING" &&
                "Attentisme, équilibre inflation/croissance"}
              {macroRegime.fedPolicy === "HIKING" &&
                "Lutte contre l'inflation, pression sur actifs"}
              {macroRegime.fedPolicy === "HAWKISH_PAUSE" &&
                "Pause temporaire, ton restrictif maintenu"}
            </p>
          </div>

          {/* Dollar */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              Dollar (DXY)
            </p>
            <p className="text-xl font-semibold">
              {macroRegime.dollarRegime === "STRENGTHENING" &&
                "💪 Renforcement"}
              {macroRegime.dollarRegime === "WEAK" && "📉 Faible"}
              {macroRegime.dollarRegime === "NEUTRAL" && "➖ Neutre"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Momentum 3M: {marketData.dxyMomentum.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {macroRegime.dollarRegime === "STRENGTHENING" &&
                "Aversion au risque, refuge valeur"}
              {macroRegime.dollarRegime === "WEAK" &&
                "Appétit pour le risque, favorable EM/crypto"}
              {macroRegime.dollarRegime === "NEUTRAL" &&
                "Équilibre, aucune tendance forte"}
            </p>
          </div>

          {/* Liquidité */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Liquidité (M2)
            </p>
            <p className="text-xl font-semibold">
              {macroRegime.liquidity === "EXPANDING" && "💧 Expansion"}
              {macroRegime.liquidity === "CONTRACTING" && "🏜️ Contraction"}
              {macroRegime.liquidity === "NEUTRAL" && "➖ Neutre"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Croissance YoY: {marketData.m2Growth.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {macroRegime.liquidity === "EXPANDING" &&
                "Plus d'argent en circulation, soutien actifs"}
              {macroRegime.liquidity === "CONTRACTING" &&
                "Resserrement monétaire, pression baissière"}
              {macroRegime.liquidity === "NEUTRAL" &&
                "Stabilité monétaire, impact limité"}
            </p>
          </div>

          {/* ISM PMI */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              ISM PMI
            </p>
            <p className="text-xl font-semibold">
              {marketData.ismPmi.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {marketData.ismPmi > 50 ? "Expansion" : "Contraction"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {marketData.ismPmi > 55 && "Forte croissance manufacturière"}
              {marketData.ismPmi > 50 &&
                marketData.ismPmi <= 55 &&
                "Expansion modérée du secteur"}
              {marketData.ismPmi > 45 &&
                marketData.ismPmi <= 50 &&
                "Ralentissement, vigilance requise"}
              {marketData.ismPmi <= 45 &&
                "Contraction significative, récession possible"}
            </p>
          </div>
        </div>
      </Card>

      {/* Biais par classe d'actifs */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Biais par classe d'actifs</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(assetBias).map(([asset, bias]) => {
            const assetLabel = getAssetLabel(asset);

            return (
              <div key={asset} className="p-3 border rounded-lg text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 capitalize">
                  {assetLabel}
                </p>
                <p className={`text-2xl font-bold ${getBiasColor(bias)}`}>
                  {bias > 0 ? "+" : ""}
                  {bias}
                  {getBiasIcon(bias)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {getAssetDescription(asset, bias)}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Détails techniques */}
      <Card className="p-6">
        <details className="cursor-pointer">
          <summary className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Données de marché détaillées
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-gray-500 block mb-1">
                  Fed Dot Plot 2025:
                </span>
                <span className="font-mono font-bold text-lg">
                  {marketData.fedDotPlot2025}%
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Prévisions officielles Fed pour taux directeurs
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-gray-500 block mb-1">
                  Market Pricing 2025:
                </span>
                <span className="font-mono font-bold text-lg">
                  {marketData.marketPricing2025}%
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Anticipations du marché (futures)
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-gray-500 block mb-1">NFP Surprise:</span>
                <span className="font-mono font-bold text-lg">
                  {marketData.nfpSurprise > 0 ? "+" : ""}
                  {marketData.nfpSurprise.toLocaleString()}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Écart emplois vs consensus (force marché travail)
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              💡 Un écart important entre Fed Dot Plot et Market Pricing indique
              un désaccord sur la trajectoire des taux, créant potentiellement
              de la volatilité.
            </p>
          </div>
        </details>
      </Card>
    </div>
  );
}
