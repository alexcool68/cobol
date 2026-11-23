# Spécifications Fonctionnelles et Techniques - Mainframe File Tool (Nuxt 4)

## 1. Contexte et Objectifs Métier

Dans le secteur de l'assurance, la gestion des incidents sur l'environnement Mainframe (z/OS) implique la création, l'injection et le suivi de fichiers de test ou de régularisation à travers plusieurs chaînes de batchs (JCLs).

Chaque chaîne génère (ou non) des fichiers de sortie au format séquentiel fixe (FB). Ces fichiers contiennent des mouvements comptables et techniques régis par des **Copybooks COBOL**.
Chaque enregistrement possède une structure commune identifiée par un **Code Chaîne** (4 caractères, ex. : `DP01`, `JG16`, `GE00`) et éventuellement un **Type d'Enregistrement (`TYP-ENR`)**, qui détermine quelle clause **`REDEFINES`** s'applique (ou une structure plate s'il n'y a pas de `REDEFINES`).

**Objectif de l'outil :**
Fournir une application Web locale (**Nuxt 4 + Nuxt UI v4**) permettant :
1. De paramétrer une fois pour toutes les copybooks, règles de mouvements, modèles DSN et accès FTP (**Administration**).
2. De rapatrier en 1 clic les fichiers d'un incident via FTP z/OS en mode binaire **ou** par upload de fichiers binaires locaux, de les découper selon les copybooks et de générer un fichier CSV propre par Code Chaîne (**Métier**).

---

## 2. Spécifications Fonctionnelles & Ergonomie

L'application est découpée en deux espaces distincts accessibles depuis une barre latérale repliable (`UDashboardSidebar`) :

### A. Espace Administration (Paramétrage pérenne)

1. **Gestion des Copybooks (`/admin/copybooks`) :**
   - Importation de fichiers `.cpy` ou saisie directe du code COBOL.
   - Support des copybooks avec niveau `01` **ou** démarrant directement par plusieurs groupes frères `05` (sans niveau `01`).
   - **Inspecteur visuel en direct :** calcul automatique du `LRECL` cumulé, positions d'octets, types (`PIC`, `COMP`, `COMP-3`, `S9`), tronc commun et branches `REDEFINES` détectées.

2. **Référentiel des Codes Chaîne & `TYP-ENR` (`/admin/chains`) :**
   - Définition des **Codes Chaîne** (longueur fixe de 4 caractères, ex. : `DP01`, `JG16`, `GE00`).
   - Conditionnement optionnel selon le Code Chaîne : ajout d'un sous-critère **`TYP-ENR`**.
   - Association **optionnelle** à une branche `REDEFINES` du Copybook (si aucune branche n'est sélectionnée, la structure plate / tronc commun est utilisée).

3. **Modèles de Fichiers DSN (`/admin/models`) :**
   - Déclaration des fichiers types intervenant dans les chaînes (ex. : `TEST.SPE.GJ020005`).
   - Pour chaque modèle : DSN par défaut, Copybook associé, `LRECL` forcé optionnel, et Codes Chaîne / `TYP-ENR` autorisés (laisser vide = toutes les règles du copybook).

4. **Connexion FTP z/OS (`/admin/ftp`) :**
   - Paramétrage Host, Port (`21`), User RACF, Mot de passe, Timeout, et option **guillemets simples z/OS (`'DSN'`)**.
   - Bouton **« Tester la connexion »** (vérification `TYPE I`) et indicateur de statut temps réel dans la sidebar.

---

### B. Espace Métier (Opérationnel Incident au quotidien)

1. **Historique des Incidents (`/`) :**
   - Liste persistante des incidents traités (recherche par numéro, compteurs fichiers/lignes/CSV, statut `Terminé` / `Partiel` / `Échec`).
   - Actions rapides : Ouvrir, Télécharger ZIP, Supprimer.

2. **Nouvel Incident & Ajout de fichiers (`/incidents/new`) :**
   - Saisie du numéro d'incident (ou ajout direct dans un incident existant via `?incidentId=...`).
   - **Deux modes de récupération :**
     - **FTP z/OS (Binaire)** : cases à cocher des modèles DSN avec champ DSN réel éditable (et surcharge locale optionnelle par ligne).
     - **Upload fichier binaire** : zone de glisser-déposer / sélection de fichiers `.bin` directement depuis le poste, sans passer par le FTP.
   - Bouton **« Importer et Convertir »** / **« Convertir les fichiers »**.

3. **Résultats d'un Incident & Gestion des générations (`/incidents/[id]`) :**
   - Bandeau KPI (date, fichiers traités, total enregistrements, CSV générés).
   - Onglets par fichier DSN avec actions sur chaque génération :
     - **Relancer FTP** (re-télécharge et reconvertit avec la configuration à jour).
     - **Remplacer (`.bin`)** (uploade un nouveau fichier binaire pour remplacer cette génération).
     - **Supprimer** (supprime ce traitement et ses CSV/aperçus sur disque).
   - Actions globales : **+ Ajouter des fichiers**, **Tout télécharger (ZIP)**, **Supprimer l'incident**.
   - Cartes cliquables par **Code Chaîne / `TYP-ENR`** (plus un groupe `REJETS` pour les lignes non reconnues), chacune avec son bouton **CSV**.
   - Tableau de prévisualisation filtrable des 200 premières lignes (colonne `#` figée à gauche, en-tête figé, `scrollbar-gutter: stable`).
   - **Export CSV compatible Excel FR :**
     - Un fichier CSV distinct par Code Chaîne / `TYP-ENR`.
     - Séparateur de colonnes : point-virgule `;`.
     - Séparateur décimal : virgule `,` (ex. : `597,12`), sans symbole monétaire.
     - Encodage : UTF-8 avec BOM et fins de ligne CRLF.

---

## 3. Spécifications Techniques & Règles de Décodage

### 3.1 Protocole FTP z/OS
- **Protocole :** FTP classique (port 21) via `basic-ftp`.
- **Mode de transfert :** **Binaire strict (`TYPE I`)** — aucune translation EBCDIC $\rightarrow$ ASCII côté Mainframe.
- **Option z/OS :** Ajout automatique de guillemets simples (`'TEST.SPE.GJ020005'`) activable dans la config FTP.
- **Format des fichiers :** Séquentiel à Longueur Fixe (Fixed Block - FB), sans séparateurs de ligne.

### 3.2 Auto-détection du `LRECL`
- Si aucun `LRECL` forcé n'est défini et que la taille du fichier binaire n'est pas un multiple exact du `LRECL` de la copybook (ex. écart d'1 octet ou padding FB), le décodeur recherche automatiquement le diviseur exact le plus proche (de `-16` à `+256` octets) qui s'aligne sur les règles de **Code Chaîne / `TYP-ENR`**, et affiche un badge **`auto-détecté`** dans l'interface.

### 3.3 Page de code EBCDIC & Types COBOL
- **Page de code :** **IBM-1147** (EBCDIC France étendu $\rightarrow$ UTF-8).
- **Types supportés :**
  1. **`PIC X(n)`** : EBCDIC IBM-1147 $\rightarrow$ UTF-8.
  2. **`PIC 9(n)` / `PIC S9(n)V9(m)`** (Zoned Decimal / Display) : gestion du signe overpunch EBCDIC (`C`/`F` positif, `D` négatif) et virgule implicite `V`.
  3. **`PIC S9(n)V9(m) COMP-3`** (Packed Decimal / BCD) : 2 chiffres par octet + demi-octet signe (`C`/`F`/`D`), taille $\lceil (n + m + 1) / 2 \rceil$.
  4. **`PIC S9(n) COMP` / `COMP-4` / `COMP-5`** (Binaire Big-Endian) : 2, 4 ou 8 octets.
- **Résolution des `REDEFINES` :** Pas d'`OCCURS` ni de `REDEFINES` imbriqués dans le périmètre actuel ; support complet des copybooks plats sans `REDEFINES`.

---

## 4. Architecture Clean (Nuxt 4 + Nuxt UI v4)

```text
cobol/
├── shared/types/                    # Types TypeScript partagés (cobol, config, incident)
├── app/                             # Présentation (Nuxt 4 + Nuxt UI v4)
│   ├── layouts/default.vue          # DashboardGroup + Sidebar (Métier / Admin)
│   ├── composables/                 # useFormatters, useFtpStatus
│   ├── components/
│   │   ├── copybook/                # StructureInspector
│   │   └── incident/                # FileSourceRow, ChainGroupCards, PreviewTable
│   └── pages/                       # index, incidents/[new|[id]], admin/[copybooks|chains|models|ftp]
├── server/
│   ├── domain/                      # Cœur métier pur (0 dépendance I/O, testé sous Vitest)
│   │   ├── cobol/                   # parser.ts, ebcdic.ts, decoder.ts
│   │   └── csv/                     # formatter.ts
│   ├── infrastructure/              # Adaptateurs techniques
│   │   ├── ftp/                     # zos-ftp.client.ts
│   │   ├── zip/                     # archive.builder.ts
│   │   ├── storage/                 # paths.ts
│   │   └── repositories/            # copybook.repo, config.repo, incident.repo
│   ├── services/                    # copybook.service, config.service, incident.service
│   └── api/                         # Contrôleurs Nitro validés avec Zod
├── tests/                           # Tests unitaires Vitest (domain + infrastructure)
└── data/                            # Stockage local (gitignored) : config/, copybooks/, incidents/
```
