# Test de l'analyse de portefeuille

## Fichiers de test

Copier les fichiers CSV fournis dans le workspace :

- `activities-export-2026-01-29.csv`
- `holdings-report-2026-01-29.csv`

## Étapes de test

### 1. Démarrer l'application

```bash
npm run dev
```

### 2. Se connecter

- Aller sur http://localhost:8888
- Se connecter ou créer un compte

### 3. Accéder à l'analyse de portefeuille

- Cliquer sur le menu utilisateur (en haut à droite)
- Sélectionner "Mon portefeuille"

### 4. Uploader les fichiers

- Sélectionner le fichier `activities-export-2026-01-29.csv` pour les transactions
- Sélectionner le fichier `holdings-report-2026-01-29.csv` pour les positions
- Cliquer sur "Analyser le portefeuille"

### 5. Vérifier les résultats

L'analyse devrait afficher :

#### Vue d'ensemble

- **Valeur totale** : ~46 982 CAD
- **Gain/Perte non réalisé** : variable selon les données
- **Frais totaux** : 12.84 CAD (commission sur la vente USDC)
- **Score de diversification** : devrait être moyen/bas (seulement 2 positions principales)

#### Allocation

- **Par compte** :
  - CELI : ~35 000 CAD (74%)
  - REER : ~11 000 CAD (23%)
- **Par actif** :
  - VEQT : majoritaire (plusieurs achats)
  - MU : ~878 CAD

#### Performance

- **Meilleurs performers** : affiche les 3 meilleures positions
- **Pires performers** : affiche les 3 pires positions
- Détail par position avec gain/perte non réalisé

#### Diversification

- **Nombre de positions** : 3
- **Score** : probablement < 60 (peu de diversification)
- **Concentration** :
  - VEQT devrait représenter >70% du portefeuille
  - Risque de concentration élevé

#### Risques identifiés

Devrait identifier :

- ✅ **Concentration élevée** : VEQT représente la majorité du portefeuille
- ✅ **Produit à effet de levier** : SLVU (vendu mais devrait être détecté dans l'historique)
- ✅ **Nombre limité de positions** : seulement 3 positions

#### Recommandations

Devrait recommander :

- ✅ **Améliorer la diversification** : ajouter plus de positions
- ✅ **Rééquilibrer** : réduire la concentration sur VEQT
- ✅ **Maximiser CELI/REER** : bonne utilisation des comptes enregistrés (97%)

## Résultats attendus

### Métriques financières

- Valeur totale du portefeuille : ~46 982 CAD
- Coût de base : ~45 970 CAD
- Gain non réalisé : ~1 012 CAD (+2.2%)
- Frais totaux : 12.84 CAD

### Allocation

- CELI : 74%
- REER : 23%
- VEQT : 73% du total
- MU : 2% du total

### Score de diversification

- Attendu : 40-50/100
- Raisons :
  - Seulement 3 positions (pénalité)
  - Concentration élevée sur VEQT >70% (pénalité)
  - Mais 2 types de comptes (bonus)

### Risques

1. **Concentration** (HIGH) : VEQT >70%
2. **Diversification limitée** (MEDIUM) : 3 positions seulement
3. **Leverage** (HIGH) : SLVU détecté dans l'historique

### Recommandations prioritaires

1. **HIGH** : Rééquilibrer le portefeuille (réduire VEQT)
2. **HIGH** : Améliorer la diversification (ajouter positions)
3. **MEDIUM** : Optimiser les frais (regrouper les achats)

## Tests API

### Upload et analyse

```bash
curl -X POST http://localhost:8888/api/portfolio/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "activitiesFile=@activities-export-2026-01-29.csv" \
  -F "holdingsFile=@holdings-report-2026-01-29.csv"
```

### Liste des analyses

```bash
curl http://localhost:8888/api/portfolio/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Récupérer une analyse

```bash
curl http://localhost:8888/api/portfolio/ANALYSIS_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Validation

- [ ] Upload des fichiers fonctionne
- [ ] Parsing CSV correct
- [ ] Calculs financiers corrects
- [ ] Score de diversification cohérent
- [ ] Risques identifiés pertinents
- [ ] Recommandations utiles
- [ ] Interface responsive
- [ ] Sauvegarde en DB
- [ ] Récupération des analyses précédentes
- [ ] Navigation fluide
