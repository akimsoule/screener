import { PortfolioUpload } from "../components/portfolio/PortfolioUpload";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function PortfolioPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header avec navigation */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        </div>

        {/* Titre */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            Analyse de portefeuille Wealthsimple
          </h1>
          <p className="text-muted-foreground mt-1">
            Uploadez vos fichiers CSV pour obtenir une analyse détaillée et des
            recommandations
          </p>
        </div>

        {/* Composant d'upload */}
        <PortfolioUpload />
      </div>
    </div>
  );
}
