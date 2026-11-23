# Mainframe File Tool

Application web locale développée avec **Nuxt 4** et **Nuxt UI v4** permettant de récupérer, décoder et convertir des fichiers binaires Mainframe (EBCDIC / COBOL) en fichiers CSV exploitables dans Excel.

## Fonctionnalités

- **Espace Administration :**
  - Import et inspection de copybooks COBOL (calcul automatique des positions, types et `REDEFINES`).
  - Paramétrage des règles de découpage et des modèles de fichiers.
  - Configuration de la connexion FTP en mode binaire.
- **Espace Métier :**
  - Suivi et historique par incident.
  - Récupération des fichiers via FTP binaire ou par import local (glisser-déposer).
  - Décodage EBCDIC (`IBM-1147`), champs numériques (`COMP`, `COMP-3`, décimaux signés) et export CSV / ZIP.

## Stack technique

- **Frontend :** Nuxt 4, Vue 3, Nuxt UI v4, Tailwind CSS v4
- **Backend :** Nitro (Node.js), TypeScript, Zod
- **Tests :** Vitest

## Démarrage

```bash
pnpm install
pnpm dev
```

Application disponible sur `http://localhost:3000`.

### Tests

```bash
pnpm test
```
