import { useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  Download,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function PortfolioUpload() {
  const [activitiesFile, setActivitiesFile] = useState<File | null>(null);
  const [holdingsFile, setHoldingsFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleActivitiesFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file?.name.endsWith(".csv")) {
      setActivitiesFile(file);
      setError(null);
    } else {
      setError("Le fichier doit être au format CSV");
    }
  };

  const handleHoldingsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.name.endsWith(".csv")) {
      setHoldingsFile(file);
      setError(null);
    } else {
      setError("Le fichier doit être au format CSV");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!activitiesFile || !holdingsFile) {
      setError("Veuillez sélectionner les deux fichiers");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("activitiesFile", activitiesFile);
      formData.append("holdingsFile", holdingsFile);

      const response = await fetch("/api/portfolio/analyze", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Échec de l'analyse");
        }
        throw new Error("Échec de l'analyse");
      }

      // Le serveur retourne un fichier Markdown
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Extraire le nom du fichier depuis le header Content-Disposition
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `analyse-portefeuille-${new Date().toISOString().split("T")[0]}.md`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        resetForm();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetForm = () => {
    setActivitiesFile(null);
    setHoldingsFile(null);
    setError(null);
    setSuccess(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-6 w-6" />
          Analyser votre portefeuille Wealthsimple
        </CardTitle>
        <CardDescription>
          Téléchargez vos fichiers CSV d'exportation pour obtenir une analyse
          détaillée et des recommandations personnalisées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">
              Comment obtenir vos fichiers CSV :
            </h3>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Connectez-vous à votre compte Wealthsimple</li>
              <li>
                Allez dans <strong>Activité</strong> et exportez vos
                transactions
              </li>
              <li>
                Allez dans <strong>Portefeuille</strong> et exportez vos
                positions
              </li>
              <li>Téléchargez les deux fichiers ci-dessous</li>
            </ol>
          </div>

          {/* Fichier des activités */}
          <div className="space-y-2">
            <Label
              htmlFor="activities-file"
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Fichier des transactions (activities-export)
            </Label>
            <Input
              id="activities-file"
              type="file"
              accept=".csv"
              onChange={handleActivitiesFileChange}
              disabled={isAnalyzing}
            />
            {activitiesFile && (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {activitiesFile.name}
              </p>
            )}
          </div>

          {/* Fichier des positions */}
          <div className="space-y-2">
            <Label htmlFor="holdings-file" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Fichier des positions (holdings-report)
            </Label>
            <Input
              id="holdings-file"
              type="file"
              accept=".csv"
              onChange={handleHoldingsFileChange}
              disabled={isAnalyzing}
            />
            {holdingsFile && (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {holdingsFile.name}
              </p>
            )}
          </div>

          {/* Messages d'état */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm">
                Analyse terminée ! Le fichier a été téléchargé.
              </p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!activitiesFile || !holdingsFile || isAnalyzing}
              className="flex-1"
            >
              {isAnalyzing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Analyser et télécharger
                </>
              )}
            </Button>
            {(activitiesFile || holdingsFile) && !isAnalyzing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Réinitialiser
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
