# Spécifications Fonctionnelles et Techniques - Mainframe File Tool (Nuxt 4)

## 1. Contexte et Objectifs Métier

Dans le secteur de l'assurance, la gestion des incidents sur l'environnement Mainframe (z/OS) implique la création, l'injection et le suivi de fichiers de test ou de régularisation à travers plusieurs chaînes de batchs (JCLs).

Chaque chaîne génère (ou non) des fichiers de sortie au format séquentiel fixe (FB). Ces fichiers contiennent des mouvements comptables et techniques régis par des **Copybooks COBOL**.
Chaque enregistrement possède une structure commune identifiée par un **Code Chaîne** (4 caractères) et éventuellement un **Type d'Enregistrement (TYP-ENR)**, qui détermine quelle clause **`REDEFINES`** s'applique pour le découpage des données.

**Objectif de l'outil :**
Fournir une application Web locale (Nuxt 4) permettant :

1. De paramétrer une fois pour toutes les formats de fichiers, copybooks et règles de mouvements (**Administration**).
2. De rapatrier en 1 clic les fichiers d'un incident via FTP z/OS en mode binaire, de les découper selon les copybooks et de générer un fichier CSV propre par Code Chaîne (**Métier**).

---

## 2. Spécifications Fonctionnelles & Ergonomie

L'application est découpée en deux espaces distincts :

### A. Espace Administration (Paramétrage pérenne)

1. **Gestion des Copybooks :**
   - Importation / saisie de fichiers de copybooks COBOL (`.cpy`).
   - Analyse syntaxique : détection du niveau `01`, calcul du $LRECL$ (longueur d'enregistrement fixe), positions des champs, types de données, et identification des zones `REDEFINES`.

2. **Référentiel des Codes Chaîne & Typ-Enr :**
   - Définition des **Codes Chaîne** (longueur fixe de 4 caractères, ex. : `DP01`, `JG16`, `GE00`).
   - Conditionnement optionnel selon le Code Chaîne : ajout d'un sous-critère **TYP-ENR** (ex: pour `DP01`, distinction `A` vs `B`).
   - Association de chaque couple `(Code Chaîne, TYP-ENR)` à la branche correspondante du `REDEFINES` du Copybook.

3. **Modèles de Fichiers DSN (Catalogue) :**
   - Déclaration des fichiers types intervenant dans les chaînes (ex. : `TEST.SPE.GJ020005`, `TEST.SPE.GJ020010`).
   - Pour chaque modèle de fichier :
     - Sélection du **Copybook** applicable.
     - Sélection des **Codes Chaîne** et **TYP-ENR** admissibles / attendus dans ce fichier.

---

### B. Espace Métier (Opérationnel Incident au quotidien)

1. **Gestion & Historique des Incidents :**
   - Création d'un nouvel incident via son identifiant (ex. : `INC-2024-5891`).
   - **Historique persistant :** Liste des incidents déjà traités (stockage local des métadonnées et des CSV générés) permettant de rouvrir un incident passé, consulter ses tableaux ou retélécharger ses CSV/ZIP à tout moment.
2. **Sélection et Personnalisation des Datasets :**
   - Présentation sous forme de liste avec cases à cocher des fichiers modèles configurés dans l'Admin.
   - En cochant un fichier, l'utilisateur peut modifier ou compléter le DSN réel sur z/OS (ex. : `TEST.SPE.GJ020005.INC5891`).
3. **Action « Importer et Convertir » :**
   - Téléchargement automatique en FTP binaire z/OS pour tous les fichiers cochés.
   - Découpage immédiat en mémoire selon les règles définies en administration.
4. **Restitution & Export CSV (Par Code Chaîne) :**
   - Synthèse visuelle des enregistrements par fichier :
     - Nombre de lignes par Code Chaîne et par TYP-ENR.
     - Détection des éventuels rejets / lignes non reconnues.
   - Prévisualisation des données sous forme de tableau.
   - Export CSV compatible **Excel FR** :
     - **Un fichier CSV distinct par Code Chaîne / TYP-ENR** (ex. : `GJ020005_DP01.csv`, `GJ020005_JG16_TYP_A.csv`).
     - Séparateur de colonnes : point-virgule `;`.
     - Séparateur décimal : virgule `,` (ex. : `1250,75`), sans symbole monétaire.
     - Encodage : UTF-8 avec BOM (pour l'affichage natif des accents dans Excel).
   - Bouton de téléchargement unitaire ou bouton global « Télécharger tout en ZIP ».

---

## 3. Spécifications Techniques & Règles de Décodage

### 3.1 Protocole FTP z/OS

- **Protocole :** FTP classique (port 21).
- **Option z/OS :** Option activable dans la configuration FTP pour entourer automatiquement les DSN de guillemets simples (`'TEST.SPE.GJ020005'`) afin d'éviter le préfixage par le User RACF (ajustable lors des premiers tests).
- **Mode de transfert :** **Binaire strict (`TYPE I`)**.
- _Impératif :_ Le serveur FTP du Mainframe ne doit effectuer aucune translation EBCDIC $\rightarrow$ ASCII lors du transfert, sous peine de corrompre irrémédiablement les octets des champs binaires (`COMP`) et compactés (`COMP-3`).
- **Format des fichiers :** Séquentiel à Longueur Fixe (Fixed Block - FB). Il n'y a pas de caractère de fin de ligne (`\r\n` ou `\n`) ; le découpage se fait par tranche d'$LRECL$ octets dans le tampon binaire brut (calculé depuis le copybook, avec possibilité de forcer le $LRECL$ si besoin).

### 3.2 Page de code EBCDIC

- **Page de code cible :** **IBM-1147** (EBCDIC France étendu).
- Décodage des champs alphanumériques `PIC X(n)` de IBM-1147 vers UTF-8.

### 3.3 Types de données COBOL supportés

1. **`PIC X(n)` (Alphanumérique) :** Décodage EBCDIC IBM-1147 $\rightarrow$ Chaîne UTF-8.
2. **`PIC 9(n)` / `PIC S9(n)V9(m)` (Zoned Decimal / Display) :**
   - 1 octet par chiffre en EBCDIC.
   - Gestion du signe par overpunch sur le dernier octet (ex. : `C`/`F` positif, `D` négatif).
   - Prise en compte de la virgule implicite `V` (formatage virgule `,` en CSV).
3. **`PIC S9(n)V9(m) COMP-3` (Packed Decimal / BCD) :**
   - Deux chiffres par octet (demi-octets / nibbles), le dernier demi-octet portant le signe (`C` ou `F` = positif, `D` = négatif).
   - Taille en octets = $\lceil (n + m + 1) / 2 \rceil$.
   - Conversion en nombre décimal formaté (ex. : `1250,75`).
4. **`PIC S9(n) COMP` / `COMP-4` / `COMP-5` (Binaire Big-Endian) :**
   - 1 à 4 chiffres $\rightarrow$ 2 octets (16-bit integer signé).
   - 5 à 9 chiffres $\rightarrow$ 4 octets (32-bit integer signé).
   - 10 à 18 chiffres $\rightarrow$ 8 octets (64-bit BigInt signé).

### 3.4 Résolution des `REDEFINES`

- Pas de `REDEFINES` imbriqués, pas de clauses `OCCURS` à gérer dans le périmètre initial.
- Lecture du tronc commun pour chaque enregistrement :
  - Extraction du champ **Code Chaîne** (4 octets).
  - Si configuré, extraction du champ **TYP-ENR**.
- Recherche de la branche de structure associée dans la configuration du modèle de fichier.
- Décodage du reste de l'enregistrement avec le schéma actif.
- Si le code n'est pas reconnu : ligne stockée dans un groupe de rejets / anomalie (format brut hexadécimal/texte) sans faire échouer le traitement.

---

## 4. Architecture Applicative

- **Framework :** [Nuxt 4](https://nuxt.com/) (Vue 3 + Vite)
- **Composants & Design :** [Nuxt UI v4](https://ui.nuxt.com/) (via serveurs MCP Nuxt & Nuxt UI)
- **Backend (Nitro / Node.js) :**
  - `basic-ftp` : Client FTP z/OS en mode binaire.
  - Moteur de parsing COBOL & décodage binaire bufferisé (`Buffer` Node.js).
  - Routes API Nitro :
    - `/api/admin/ftp-config` : Paramètres de connexion FTP (host, port, user, option guillemets z/OS).
    - `/api/admin/copybooks` : CRUD copybooks et schémas.
    - `/api/admin/chains` : Configuration des Codes Chaîne et TYP-ENR.
    - `/api/admin/models` : Configuration des modèles de fichiers DSN.
    - `/api/incidents` : Historique des incidents, import/conversion FTP, téléchargement CSV / ZIP.
- **Stockage :** Fichiers locaux dans un dossier `data/` (configurations JSON + historique des incidents et CSV générés).
