# Analyse de Portefeuille Wealthsimple

Cette fonctionnalité permet d'analyser votre portefeuille Wealthsimple en uploadant vos fichiers CSV et d'obtenir un **rapport Markdown téléchargeable** avec des recommandations personnalisées.

## 🎯 Fonctionnalités

### Analyse complète du portefeuille

- **Allocation d'actifs** : Répartition par type de compte (CELI, REER), par actif, et par type d'actif
- **Performance** : Gains/pertes non réalisés, meilleurs et pires performers
- **Frais** : Analyse des commissions et leur impact sur le rendement
- **Diversification** : Score de diversification et analyse de concentration
- **Risques** : Identification des risques (concentration, leverage, frais, fiscalité)
- **Recommandations** : Actions concrètes pour optimiser le portefeuille
- **Rapport téléchargeable** : Fichier Markdown formaté avec toutes les analyses

### Avantages de cette approche

- ✅ **Aucune donnée persistée** : Vos informations financières ne sont jamais sauvegardées
- ✅ **Confidentialité maximale** : L'analyse est faite en mémoire et détruite après génération
- ✅ **Rapport portable** : Le fichier Markdown peut être lu n'importe où
- ✅ **Archivage personnel** : Vous gardez vos rapports localement
- ✅ **Format ouvert** : Markdown est lisible, éditable et convertible (PDF, HTML, etc.)

### Types d'analyses

#### 1. **Allocation**

- Par type de compte (CELI, REER, compte imposable)
- Par actif individuel
- Par type d'actif (ETF, actions, etc.)
- Visualisation avec barres de progression

#### 2. **Performance**

- Performance globale du portefeuille
- Performance par position
- Top 3 meilleurs performers
- Top 3 pires performers
- Gains/pertes non réalisés en $ et en %

#### 3. **Diversification**

- Score de diversification (0-100)
- Nombre de positions et d'actifs uniques
- Analyse de concentration (top position, top 3, top 5)
- Recommandations de rééquilibrage

#### 4. **Risques identifiés**

- **Concentration** : Position unique trop importante (>40%)
- **Leverage** : Exposition aux ETF à effet de levier (2x, 3x)
- **Frais** : Impact des commissions sur le rendement
- **Fiscalité** : Sous-utilisation des comptes enregistrés
- Chaque risque inclut son niveau (LOW, MEDIUM, HIGH, CRITICAL), description, impact et recommandation

#### 5. **Recommandations**

Recommandations personnalisées avec priorité (HIGH, MEDIUM, LOW) :

- Amélioration de la diversification
- Rééquilibrage du portefeuille
- Optimisation des frais
- Maximisation des comptes enregistrés (CELI/REER)
- Utilisation d'ETF diversifiés (VEQT, VGRO, VBAL)
- Réévaluation des positions en perte

## 📋 Comment obtenir vos fichiers CSV

1. Connectez-vous à [Wealthsimple](https://www.wealthsimple.com)
2. **Pour les transactions** :
   - Allez dans **Activité**
   - Cliquez sur **Exporter**
   - Téléchargez le fichier `activities-export-YYYY-MM-DD.csv`

3. **Pour les positions** :
   - Allez dans **Portefeuille**
   - Cliquez sur **Exporter**
   - Téléchargez le fichier `holdings-report-YYYY-MM-DD.csv`

## 🚀 Utilisation

### Via l'interface web

1. Connectez-vous à votre compte
2. Cliquez sur votre profil en haut à droite
3. Sélectionnez **Mon portefeuille**
4. Uploadez vos deux fichiers CSV :
   - Fichier des transactions (`activities-export`)
   - Fichier des positions (`holdings-report`)
5. Cliquez sur **Analyser et télécharger**
6. Le fichier `analyse-portefeuille-YYYY-MM-DD.md` est automatiquement téléchargé
7. Ouvrez-le avec n'importe quel éditeur Markdown (VS Code, Obsidian, etc.) ou convertissez-le en PDF

### Format des fichiers

#### activities-export.csv

```csv
date_transaction,date_reglement,compte_id,type_compte,type_activite,sous_type_activite,direction,symbole,nom,devise,quantite,prix_unitaire,commission,montant_net_especes
2026-01-17,2026-01-18,HQ9...,CELI,Trade,BUY,LONG,VEQT,Vanguard All-Equity ETF,CAD,100,55.50,0,-5550
```

Colonnes utilisées :

- `type_compte` : Type de compte (CELI, REER, etc.)
- `type_activite` : Type d'activité (Trade, etc.)
- `symbole` : Symbole du titre
- `nom` : Nom du titre
- `quantite` : Quantité négociée
- `prix_unitaire` : Prix par unité
- `commission` : Frais de transaction
- `montant_net_especes` : Montant net

#### holdings-report.csv

```csv
Nom du compte,Type de compte,Symbole,Nom,Type,Quantité,Prix du marché,Valeur marchande,Rendements non réalisés du marché,...
CELI,CELI,VEQT,Vanguard All-Equity ETF,EXCHANGE_TRADED_FUND,100,55.18,5518.00,118.00,...
```

Colonnes utilisées :

- `Type de compte` : Type de compte
- `Symbole` : Symbole du titre
- `Nom` : Nom complet du titre
- `Type` : Type d'actif (EQUITY, EXCHANGE_TRADED_FUND, etc.)
- `Quantité` : Nombre d'unités détenues
- `Prix du marché` : Prix actuel
- `Valeur marchande` : Valeur totale de la position
- `Valeur comptable (CAD)` : Coût de base ajusté
- `Rendements non réalisés du marché` : Gain/perte non réalisé

## 🔧 API Endpoints

### POST `/api/portfolio/analyze` Retourne un fichier Markdown téléchargeable.

**Request:**

```typescript
FormData {
  activitiesFile: File, // CSV des transactions
  holdingsFile: File    // CSV des positions
}
```

**Response:**

```
Content-Type: text/markdown; charset=utf-8
Content-Disposition: attachment; filename="analyse-portefeuille-YYYY-MM-DD.md"

# 📊 Analyse de Portefeuille Wealthsimple
...
```

## 📄 Format du rapport

Le fichier Markdown généré contient :

### 1. Vue d'ensemble

Tableau récapitulatif avec valeur totale, gains/pertes, frais, score de diversification

### 2. Allocation du portefeuille

- Par type de compte (tableaux avec valeurs et pourcentages)
- Par actif (top 10 positions)
- Par type d'actif (ETF, actions, etc.)

### 3. Performance

- Résumé global
- 🏆 Meilleurs performers (top 3)
- 📉 Pires performers (top 3)
- Détail par position (tableau complet)

### 4. Analyse des frais

- Total et moyenne des commissions
- Impact sur le portefeuille
- Répartition par compte

### 5. Diversification

- Métriques clés (score, nombre de positions, etc.)
- Risque de concentration
- Balance par type d'actif

### 6. ⚠️ Risques identifiés

Liste complète avec :

- Niveau (🔴 CRITIQUE, 🟠 ÉLEVÉ, 🟡 MOYEN, 🟢 FAIBLE)
- Description, impact et recommandation pour chaque risque

### 7. 💡 Recommandations

Liste priorisée avec :

- Priorité (🔴 HAUTE, 🟡 MOYENNE, 🔵 BASSE)
- Situation actuelle, action recommandée, impact attendu

## 🔄 Conversion du rapport

### En PDF

```bash
# Avec pandoc
pandoc analyse-portefeuille-2026-02-03.md -o rapport.pdf

# Avec VS Code
Code → Export PDF

# En ligne
https://www.markdowntopdf.com/
```

### En HTML

```bash
# Avec pandoc
pandoc analyse-portefeuille-2026-02-03.md -o rapport.html --standalone

# Avec marked
marked analyse-portefeuille-2026-02-03.md > rapport.html analysis: PortfolioAnalysisResult
}
```

## 📊 Exemple de recommandations

### Score de diversification < 60

```
PRIORITÉ HAUTE - Améliorer la diversifiindex.ts` : Endpoint d'upload et d'analyse
- `netlify/functions/portfolio-analyze/lib/portfolioAnalyzer.ts` : Logique d'analyse
- `netlify/functions/portfolio-analyze/lib/markdownGenerator.ts` : Génération du rapport

### Frontend
- `src/pages/Portfolio.tsx` : Page principale
- `src/components/portfolio/PortfolioUpload.tsx` : Composant d'upload
- `src/types/portfolio.ts` : Types TypeScript

### Workflow
1. **Upload** : Fichiers CSV envoyés au serveur
2. **Parse** : Parsing avec `csv-parse` et normalisation
3. **Analyse** : 6 fonctions d'analyse sophistiquées
4. **Génération** : Création du fichier Markdown formaté
5. **Téléchargement** : Fichier retourné au navigateur
6. **Nettoyage** : Toutes les données sont détruites (pas de persistance)

## 🔐 Sécurité

- ✅ **Aucune persistance** : Vos données ne sont jamais sauvegardées
- ✅ **Analyse en mémoire** : Traitement temporaire uniquement
- ✅ **Destruction immédiate** : Données effacées après génération du rapport
- ✅ **Authentification requise** : Accès protégé
- ✅ **Validation des fichiers** : .csv uniquement
- ✅ **Confidentialité maximale** : Vous seul avez accès à vos rapports
PRIORITÉ HAUTE - Maximiser les comptes enregistrés
Seulement 65.0% de votre portefeuille est dans des comptes enregistrés.
ActionSupport de formats supplémentaires (PDF direct, HTML)
- [ ] Graphiques intégrés dans le rapport
- [ ] Comparaison entre plusieurs périodes
- [ ] Templates de rapports personnalisables
- [ ] Support Questrade, Interactive Brokers
- [ ] Export vers Excel
- [ ] Analyse des dividende
- `netlify/functions/portfolio-analyze/` : Endpoint d'upload et d'analyse
- `netlify/functions/portfolio-analyze/lib/portfolioAnalyzer.ts` : Logique d'analyse
- `netlify/functions/portfolio-list/` : Liste des analyses
- `netlify/functions/portfolio-get/` : Récupération d'une analyse

### Frontend
- `src/pages/Portfolio.tsx` : Page principale
- `src/components/portfolio/PortfolioUpload.tsx` : Composant d'upload
- `src/components/portfolio/PortfolioAnalysisView.tsx` : Affichage des résultats
- `src/types/portfolio.ts` : Types TypeScript

### Base de données
Table `PortfolioAnalysis` :
- `userId` : Propriétaire de l'analyse
- `activitiesFileName`, `holdingsFileName` : Noms des fichiers
- `totalValue`, `totalCost`, `totalUnrealizedGain` : Métriques financières
- `allocation`, `performance`, `fees`, `diversification`, `risks`, `recommendations` : Résultats (JSON)

## 🔐 Sécurité

- Authentification requise pour accéder aux fonctionnalités
- Les analyses sont liées à l'utilisateur connecté
- Les fichiers CSV ne sont pas stockés, seuls les résultats d'analyse le sont
- Validation des formats de fichiers (.csv uniquement)

## 📝 Développement futur

- [ ] Export PDF des analyses
- [ ] Comparaison entre plusieurs analyses (évolution dans le temps)
- [ ] Graphiques interactifs (charts.js, recharts)
- [ ] Alertes automatiques sur les risques détectés
- [ ] Suggestions d'allocation optimale basées sur le profil de risque
- [ ] Intégration avec d'autres plateformes (Questrade, Interactive Brokers)
- [ ] Analyse des dividendes et revenus
- [ ] Calcul du ratio de Sharpe et autres métriques avancées
```
