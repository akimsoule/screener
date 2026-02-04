# 📈 Stock Screener Pro

Un dashboard moderne de screening technique pour les marchés financiers avec une interface utilisateur élégante, des alertes Telegram en temps réel, une gestion configurable des symboles et **une analyse complète de portefeuille Wealthsimple**.

## ✨ Fonctionnalités

### 💼 Analyse de Portefeuille Wealthsimple (NOUVEAU!)

- **Upload de fichiers CSV** : Importez vos exports Wealthsimple (transactions + positions)
- **Analyse complète** : Allocation, performance, frais, diversification
- **Score de diversification** : Évaluation 0-100 avec recommandations
- **Détection des risques** : Concentration, leverage, frais, fiscalité
- **Recommandations personnalisées** : Actions concrètes pour optimiser votre portefeuille
- **Historique** : Sauvegarde et consultation des analyses précédentes

### 🎯 Analyse Technique Avancée

- **RSI (Relative Strength Index)** : Détection des conditions de surachat/survente
- **SMA (Simple Moving Average)** : Tendances à moyen terme
- **MACD** : Signaux de momentum et croisements
- **Scoring intelligent** : Système de notation pour recommandations d'achat/vente

### 📊 Interface Moderne

- **Design Dark Professional** : Interface moderne avec thème sombre
- **Dashboard Responsive** : Optimisé pour desktop et mobile
- **Graphiques Interactifs** : Visualisation avancée avec Recharts
- **Navigation par Onglets** : Organisation claire des fonctionnalités

### 🚨 Alertes Temps Réel

- **Notifications Telegram** : Alertes instantanées pour signaux forts
- **Configuration Flexible** : Bot token et chat ID personnalisables
- **Seuils Configurables** : Ajustement des niveaux de déclenchement

### ⚙️ Gestion des Symboles

- **CRUD Complet** : Ajouter, modifier, activer/désactiver des symboles
- **Base de Données** : Stockage PostgreSQL (SQLite en développement)
- **Validation** : Contrôles d'intégrité et feedback utilisateur

## 🛠️ Technologies Utilisées

### Frontend

- **React 19** + TypeScript
- **Vite** : Build tool ultra-rapide
- **Recharts** : Graphiques interactifs
- **React Tabs** : Navigation par onglets
- **CSS Modern** : Design system personnalisé

### Backend

- **Netlify Functions** : Serverless computing
- **Prisma ORM** : Gestion base de données
- **Yahoo Finance API** : Données de marché
- **Technical Indicators** : Bibliothèque d'analyse
- **CSV Parse** : Parsing des fichiers Wealthsimple

### Infrastructure

- **PostgreSQL** : Base de données production
- **SQLite** : Développement local
- **Telegram Bot API** : Notifications

## 🚀 Installation & Configuration

### 1. Prérequis

```bash
Node.js >= 18
PostgreSQL (production) ou SQLite (dev)
```

### 2. Installation

```bash
# Cloner le repository
git clone <repository-url>
cd stock-screener-pro

# Installer les dépendances
npm install
```

### 3. Configuration Base de Données

```bash
# Développement (SQLite automatique)
npm run prisma:migrate

# Production (PostgreSQL)
# Modifier .env avec DATABASE_URL
npx prisma migrate dev
```

### 4. Configuration FRED API (Données Macroéconomiques)

```bash
# Obtenir une clé API gratuite sur https://fredaccount.stlouisfed.org/apikeys
# Ajouter dans .env :
FRED_API_KEY="your_fred_api_key"
```

La FRED API permet d'accéder aux données économiques officielles :

- **M2SL** : Masse monétaire M2 (liquidité)
- **MANEMP** : ISM Manufacturing PMI (activité économique)
- **DFF** : Federal Funds Rate (taux directeur Fed)

Sans cette clé, l'application utilise des estimations basées sur les prix de marché.

### 5. Configuration Telegram

```bash
# Créer un bot sur @BotFather
# Ajouter dans .env :
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"
```

### 6. Démarrage

```bash
# Développement
npm run dev

# Build production
npm run build
```

## 📱 Utilisation

### Analyse de Portefeuille Wealthsimple

#### 1. Obtenir vos fichiers CSV

1. Connectez-vous à [Wealthsimple](https://www.wealthsimple.com)
2. **Transactions** : Activité → Exporter → `activities-export-YYYY-MM-DD.csv`
3. **Positions** : Portefeuille → Exporter → `holdings-report-YYYY-MM-DD.csv`

#### 2. Analyser votre portefeuille

1. Connectez-vous à l'application
2. Menu utilisateur → **Mon portefeuille**
3. Uploadez les deux fichiers CSV
4. Consultez l'analyse complète :
   - **Vue d'ensemble** : Valeur totale, gains/pertes, frais, score de diversification
   - **Allocation** : Répartition par compte (CELI, REER), par actif, par type
   - **Performance** : Meilleurs/pires performers, détail par position
   - **Diversification** : Score 0-100, analyse de concentration
   - **Risques** : Détection automatique (concentration, leverage, frais, fiscalité)
   - **Recommandations** : Actions concrètes pour optimiser votre portefeuille

#### 3. Comprendre votre score de diversification

- **70-100** : Excellent - Portefeuille bien diversifié
- **50-69** : Bon - Quelques améliorations possibles
- **30-49** : Moyen - Risque de concentration
- **0-29** : Faible - Diversification insuffisante

#### 4. Exemples de recommandations

- **Rééquilibrage** : Réduire les positions >25% du portefeuille
- **Diversification** : Ajouter 10-15 positions pour réduire le risque
- **Frais** : Regrouper les achats, utiliser des ETF sans commission
- **Fiscalité** : Maximiser CELI (7000$) et REER (18% du revenu)
- **ETF** : Considérer VEQT, VGRO ou VBAL pour simplifier

### Gestion des Symboles

1. Accéder à l'onglet "Gestion Symboles"
2. Ajouter des symboles (AAPL, TSLA, GOLD, etc.)
3. Activer/désactiver selon vos besoins

### Analyse des Graphiques

1. Sélectionner un symbole dans "Graphiques"
2. Cocher les indicateurs souhaités (RSI, SMA)
3. Analyser les tendances visuellement

### Screening Automatique

1. Aller dans "Screening"
2. Cliquer "Lancer l'analyse"
3. Recevoir les recommandations en temps réel

## 🎨 Interface Utilisateur

### Design System

- **Couleurs** : Palette professionnelle bleu/vert/rouge
- **Typographie** : Inter font family
- **Composants** : Cards, badges, boutons modernes
- **États** : Loading, success, error, warning

### Responsive Design

- **Desktop** : Layout 3 colonnes optimisé
- **Tablet** : Adaptation 2 colonnes
- **Mobile** : Interface verticale fluide

## 🔧 API Endpoints

### Fonctions Netlify

- `/.netlify/functions/app` : Screening principal
- `/.netlify/functions/symbols` : CRUD symboles
- `/.netlify/functions/prices` : Données de prix

### Structure des Données

```typescript
interface AnalysisReport {
  symbol: string;
  score: number;
  action: "ACHAT" | "VENTE" | "ATTENTE";
  details: {
    price: number;
    rsi: number;
    trend: "BULL" | "BEAR";
  };
}
```

## 📈 Métriques & KPIs

- **Précision des Signaux** : Taux de réussite des recommandations
- **Temps de Réponse** : Latence des analyses
- **Couverture** : Nombre de symboles surveillés
- **Alertes** : Volume des notifications Telegram

## 🔒 Sécurité

- **Variables d'Environnement** : Clés API sécurisées
- **Validation** : Sanitisation des entrées utilisateur
- **Rate Limiting** : Protection contre les abus
- **HTTPS** : Communications chiffrées

## 🚀 Déploiement

### Netlify (Recommandé)

```bash
# Build et déploiement automatique
npm run build
# Déployer sur Netlify
```

### Configuration Production

```bash
# Variables d'environnement Netlify
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Commiter les changements
4. Push et créer une PR

## 📄 Licence

MIT License - voir le fichier LICENSE pour plus de détails.

## 📞 Support

- **Issues** : GitHub Issues
- **Documentation** : Ce README
- **Discord** : Communauté d'utilisateurs

---

_Construit avec ❤️ pour les traders et investisseurs techniques_
{
files: ['**/*.{ts,tsx}'],
extends: [
// Other configs...

        // Remove tseslint.configs.recommended and replace with this
        tseslint.configs.recommendedTypeChecked,
        // Alternatively, use this for stricter rules
        tseslint.configs.strictTypeChecked,
        // Optionally, add this for stylistic rules
        tseslint.configs.stylisticTypeChecked,

        // Other configs...
      ],
      languageOptions: {
        parserOptions: {
          project: ['./tsconfig.node.json', './tsconfig.app.json'],
          tsconfigRootDir: import.meta.dirname,
        },
        // other options...
      },

},
])

````

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
````
