# Documentation du Projet Screener

Bienvenue dans la documentation du projet Screener, une plateforme d'analyse macro-économique et technique pour le trading.

## Vue d'ensemble

Screener est une application web moderne qui combine l'analyse technique traditionnelle avec le contexte macro-économique pour fournir des recommandations de trading éclairées. Le système utilise des algorithmes quantitatifs inspirés des meilleures pratiques du trading professionnel.

## Architecture

### Frontend (React/TypeScript)

- **Framework** : React 18 avec TypeScript
- **UI** : Tailwind CSS + shadcn/ui
- **Charts** : TradingView Lightweight Charts
- **State Management** : React hooks + Context API

### Backend (Netlify Functions)

- **Runtime** : Node.js sur Netlify Edge Functions
- **Database** : Prisma + PostgreSQL
- **API** : RESTful avec validation
- **Authentification** : JWT + Netlify Identity

### Analyse quantitative

- **Moteur de scoring** : Algorithmes propriétaires
- **Indicateurs** : RSI, MACD, Bollinger, ADX, ATR
- **Régimes macro** : Détection RISK_ON/OFF/TRANSITION
- **Gestion de risque** : Kelly Criterion, volatilité ajustée

## Documentation technique

### 🔍 Logique d'analyse

- **[Moteur d'analyse](./analysis-logic.md)** : Documentation complète de l'algorithme de scoring quantitatifs

### 📊 Composants React

- **MacroView** : Affichage des indicateurs macro-économiques
- **StockChart** : Graphiques de prix avec indicateurs techniques
- **AnalysisHierarchy** : Hiérarchie d'analyse (Macro → Technique)
- **ChartControls** : Contrôles d'affichage des graphiques

### ⚙️ API Netlify Functions

- **`/app/analysis`** : Analyse technique d'un symbole
- **`/app/macro`** : Données macro-économiques live
- **`/cron-screener`** : Screening automatique quotidien
- **`/auth/*`** : Gestion de l'authentification

### 🗄️ Base de données

- **Schema Prisma** : Modèles de données et relations
- **Migrations** : Historique des changements de schéma
- **Seed** : Données d'initialisation

## Démarrage rapide

### Prérequis

```bash
Node.js >= 18
npm >= 8
PostgreSQL >= 13
```

### Installation

```bash
# Cloner le repository
git clone <repository-url>
cd screener

# Installer les dépendances
npm install

# Configuration de la base de données
cp .env.example .env
# Éditer .env avec vos credentials

# Initialiser la base de données
npx prisma migrate dev
npx prisma db seed

# Démarrer le développement
npm run dev
```

### Déploiement

```bash
# Build pour production
npm run build

# Déployer sur Netlify
netlify deploy --prod
```

## Guides d'utilisation

### Pour les traders

1. **Connexion** : Créer un compte ou se connecter
2. **Analyse macro** : Consulter les indicateurs économiques
3. **Recherche de symboles** : Utiliser la barre de recherche
4. **Analyse technique** : Examiner les graphiques et recommandations
5. **Gestion de portefeuille** : Suivre les positions et P&L

### Pour les développeurs

1. **Architecture** : Comprendre la structure du projet
2. **API** : Intégrer les fonctions Netlify
3. **Base de données** : Gérer les modèles Prisma
4. **Tests** : Écrire et exécuter les tests
5. **Déploiement** : Configurer l'environnement de production

## Philosophie de développement

### Principes

- **Simplicité** : Code clair et maintenable
- **Performance** : Optimisation des requêtes et rendu
- **Sécurité** : Validation stricte et authentification
- **Testabilité** : Code modulaire et testé
- **Évolutivité** : Architecture prête pour la croissance

### Standards de code

- **TypeScript** : Typage strict obligatoire
- **ESLint** : Règles de qualité de code
- **Prettier** : Formatage automatique
- **Conventional Commits** : Messages de commit standardisés

## Support et contribution

### Signaler un bug

1. Vérifier les issues existantes
2. Créer une nouvelle issue avec :
   - Description détaillée
   - Étapes de reproduction
   - Environnement (OS, navigateur, version)

### Contribuer

1. Forker le repository
2. Créer une branche feature
3. Commiter avec des messages conventionnels
4. Ouvrir une Pull Request

### Contact

- **Issues** : [GitHub Issues](https://github.com/username/screener/issues)
- **Discussions** : [GitHub Discussions](https://github.com/username/screener/discussions)

---

_Documentation du projet Screener - Version 1.0_</content>
<parameter name="filePath">/Volumes/FOLDER/dev/projects/screener/docs/README.md
