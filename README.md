# Screener

Un projet serverless Netlify pour screener en TypeScript.

## Installation

1. Installez les dépendances :

   ```
   npm install
   ```

2. Lancez en mode développement :

   ```
   npm run dev
   ```

3. Vérifiez les types TypeScript :
   ```
   npm run type-check
   ```

## Déploiement

Pour déployer sur Netlify :

1. Connectez-vous à Netlify CLI :

   ```
   netlify login
   ```

2. Initialisez le projet :

   ```
   netlify init
   ```

3. Déployez :
   ```
   npm run deploy
   ```

## Structure

- `netlify/functions/` : Fonctions serverless
- `public/` : Fichiers statiques
- `netlify.toml` : Configuration Netlify
