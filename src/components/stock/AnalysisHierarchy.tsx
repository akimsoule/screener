import { Card } from "@/components/ui/card";
import { TrendingUp, Target, CheckCircle } from "lucide-react";

interface AnalysisHierarchyProps {
  readonly macroPhase: "RISK_ON" | "RISK_OFF" | "TRANSITION";
  readonly macroConfidence: number;
  readonly technicalScore: number;
  readonly technicalAction: string;
  readonly liotBias?: number;
}

/**
 * Composant qui illustre la hiérarchie d'analyse :
 * 1. MACRO/FONDAMENTAL (le courant) - Direction de fond
 * 2. TECHNIQUE (les pierres) - Timing d'exécution
 */
export function AnalysisHierarchy({
  macroPhase,
  macroConfidence,
  technicalScore,
  technicalAction,
  liotBias = 0,
}: Readonly<AnalysisHierarchyProps>) {
  const getMacroColor = () => {
    if (macroPhase === "RISK_ON") return "text-green-600 dark:text-green-400";
    if (macroPhase === "RISK_OFF") return "text-red-600 dark:text-red-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getTechnicalColor = () => {
    if (technicalScore >= 40) return "text-green-600 dark:text-green-400";
    if (technicalScore <= -40) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const isAligned = () => {
    const macroIsBullish = macroPhase === "RISK_ON" || liotBias > 10;
    const technicalIsBullish = technicalScore > 0;
    return macroIsBullish === technicalIsBullish;
  };

  return (
    <Card className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800">
      <div className="space-y-4">
        {/* Titre explicatif */}
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
            Hiérarchie d'Analyse
          </h3>
        </div>

        {/* Méthodologie */}
        <div className="text-xs text-purple-700 dark:text-purple-300 italic mb-4 pl-7 border-l-2 border-purple-300 dark:border-purple-700">
          Comme un ruisseau de montagne : le <strong>fondamental</strong> est le
          courant (direction), le <strong>technique</strong> est les pierres
          (timing). On analyse d'abord le courant, puis les obstacles.
        </div>

        {/* NIVEAU 1 : MACRO/FONDAMENTAL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                📊 ANALYSE FONDAMENTALE (Macro)
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Direction de fond • Contexte global • Quoi trader et dans quelle
                direction
              </p>
            </div>
          </div>

          <div className="ml-10 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Régime Macro</p>
                <p className={`text-xl font-bold ${getMacroColor()}`}>
                  {macroPhase === "RISK_ON" && "🟢 RISK-ON"}
                  {macroPhase === "RISK_OFF" && "🔴 RISK-OFF"}
                  {macroPhase === "TRANSITION" && "🟡 TRANSITION"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Confiance</p>
                <p className="text-lg font-bold">{macroConfidence}%</p>
              </div>
            </div>
            {liotBias !== 0 && (
              <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Biais Liot sur cet actif :{" "}
                  <span
                    className={
                      liotBias > 0
                        ? "text-green-600 font-semibold"
                        : "text-red-600 font-semibold"
                    }
                  >
                    {liotBias > 0 ? "+" : ""}
                    {liotBias}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* FLÈCHE DE FLUX */}
        <div className="ml-4 flex items-center gap-2 text-purple-500">
          <div className="h-8 w-0.5 bg-purple-300 dark:bg-purple-700"></div>
          <TrendingUp className="w-4 h-4" />
        </div>

        {/* NIVEAU 2 : TECHNIQUE */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                📈 ANALYSE TECHNIQUE
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                Timing d'exécution • Gestion du risque • Zones d'entrée/sortie
              </p>
            </div>
          </div>

          <div className="ml-10 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Signal Technique</p>
                <p className={`text-lg font-bold ${getTechnicalColor()}`}>
                  {technicalAction}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Score</p>
                <p className={`text-lg font-bold ${getTechnicalColor()}`}>
                  {technicalScore > 0 ? "+" : ""}
                  {technicalScore}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* VALIDATION ALIGNEMENT */}
        <div
          className={`mt-4 p-3 rounded-lg border ${
            isAligned()
              ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700"
              : "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700"
          }`}
        >
          <div className="flex items-start gap-2">
            {isAligned() ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <span className="text-xl">⚠️</span>
            )}
            <div>
              <p
                className={`text-sm font-semibold ${
                  isAligned()
                    ? "text-green-900 dark:text-green-100"
                    : "text-orange-900 dark:text-orange-100"
                }`}
              >
                {isAligned()
                  ? "✅ Analyses Alignées"
                  : "⚠️ Divergence Macro/Technique"}
              </p>
              <p
                className={`text-xs mt-1 ${
                  isAligned()
                    ? "text-green-700 dark:text-green-300"
                    : "text-orange-700 dark:text-orange-300"
                }`}
              >
                {isAligned()
                  ? "Le courant fondamental et le signal technique convergent. Setup cohérent avec contexte global."
                  : "Le signal technique diverge du contexte macro. Prudence : le courant de fond prime sur les obstacles techniques."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
