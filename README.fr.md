> **Note :** Ceci est une traduction de README.md. La version originale en anglais peut contenir des informations plus recentes que cette version.

# AS Notes (Extension VS Code pour la gestion des connaissances personnelles)

Site web : [asnotes.io](https://www.asnotes.io) | Developpeur : [App Software Ltd](https://www.appsoftware.com) | [Discord](https://discord.gg/QmwY57ts) | [Reddit](https://www.reddit.com/r/AS_Notes/) | [X](https://x.com/AppSoftwareLtd)

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/appsoftwareltd.as-notes?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![License](https://img.shields.io/badge/license-Elastic--2.0-lightgrey)](https://github.com/appsoftwareltd/as-notes/blob/main/LICENSE)
[![CI](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml)

|||
|--|--|
|Installer | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes) / [Open VSX](https://open-vsx.org/extension/appsoftwareltd/as-notes)|
|Fonctionnalites Pro | [asnotes.io/pricing](https://www.asnotes.io?attr=src_readme)|
|Documentation | [docs.asnotes.io](https://docs.asnotes.io)|
|Blog | [blog.asnotes.io](https://blog.asnotes.io)|
|Feuille de route / Tableau de projet| [docs.asnotes.io/development-roadmap](https://docs.asnotes.io/development-roadmap.html) / [github.com](https://github.com/orgs/appsoftwareltd/projects/16)|

## Qu'est-ce que AS Notes ?

**AS Notes apporte l'edition markdown et les `[[wikilinks]]` pour les notes, la documentation, les blogs et les wikis directement dans [VS Code](https://code.visualstudio.com/) et les editeurs compatibles (par exemple [Antigravity](https://antigravity.google/), [Cursor](https://cursor.com/), [Windsurf](https://windsurf.com/)).**

**Capturez des idees, liez des concepts, ecrivez et restez concentre, sans quitter votre editeur.**

AS Notes fournit des outils de productivite qui transforment votre IDE favori en un systeme de gestion des connaissances personnelles (PKMS), incluant un panneau de retroliens, la gestion des taches, un journal, un tableau kanban, des outils d'edition markdown, des diagrammes Mermaid, le support des mathematiques LaTeX et la publication similaire a Jekyll / Hugo.

(Video d'introduction d'1 minute)

[![Demo AS Notes](https://img.youtube.com/vi/bwYopQ1Sc5o/maxresdefault.jpg)](https://www.youtube.com/watch?v=bwYopQ1Sc5o)

(Video de demonstration d'1 minute)

[![Demo AS Notes](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## Pourquoi VS Code ?

Beaucoup d'entre nous utilisent VS Code et des editeurs compatibles quotidiennement, et meme lorsque nous utilisons un outil separe pour les notes et la gestion des connaissances, nous finissons souvent par ecrire la documentation, les blogs et les wikis dans notre IDE. AS Notes fournit les outils pour tout faire dans votre IDE.

Quelques avantages cles de la gestion des notes dans VS Code en plus de ceux fournis directement par AS Notes :

- Compatibilite multiplateforme + Web (via Workspaces)
- Acceptation dans les environnements de travail restreints ou d'autres outils de gestion des connaissances peuvent ne pas etre autorises
- Enorme bibliotheque d'extensions utilisable aux cotes d'AS Notes pour etendre encore les capacites
- Moteur d'agent IA integre (GitHub CoPilot / Claude, etc.) que vous pouvez utiliser pour travailler avec vos notes
- Fonctionnalites d'edition de texte et d'interface de pointe
- Coloration syntaxique
- Et toutes les autres fonctionnalites de VS Code

## Fonctionnalites d'AS Notes

### General

- Axe sur la confidentialite : AS Notes n'envoie aucune de vos donnees ni telemetrie nulle part
- Compatible avec le controle de version (Git et GitOps)
- Indexation legere de vos notes (sqlite3 WASM local)

- Performances efficaces sur de grandes bases de connaissances (environ 20k fichiers markdown)

### Wikilinks

- `[[wikilinks]]` style Logseq / Roam / Obsidian avec prise en charge des liens imbriques, par exemple `[[[[AS Notes]] Page]]`
- Les liens se resolvent vers la page cible n'importe ou dans votre workspace. Les wikilinks imbriques peuvent resoudre plusieurs cibles
- Renommer un lien met a jour le fichier cible et toutes les references correspondantes
- Suivi automatique des wikilinks / renommage des fichiers

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/wikilinks.png" alt="AS Notes backlinks wikilinks" style="max-height:200px; margin-top: 10px">

Consultez la [documentation des Wikilinks](https://docs.asnotes.io/wikilinks.html) pour plus d'informations sur les wikilinks.

### Gestion des taches

Basculez les TODOs markdown avec `Ctrl+Shift+Enter` (Windows/Linux) / `Cmd+Shift+Enter` (macOS) :

```
- [ ] Marqueur de tache ajoute
- [x] Tache marquee comme terminee
Marqueur de tache supprime
```

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/task-management-panel.png" alt="AS Notes todo panel" style="max-height:260px; margin-top: 10px; margin-bottom: 10px;">

#### Etiquettes de metadonnees de taches

Ajoutez des metadonnees structurees avec des hashtags n'importe ou sur une ligne de tache pour categoriser et organiser les taches. Les etiquettes sont retirees du texte de tache affiche ; seule la description nettoyee est montree.

| Etiquette | Description |
|---|---|
| `#P1` | Priorite 1 - Critique |
| `#P2` | Priorite 2 - Haute |
| `#P3` | Priorite 3 - Normale |
| `#W` | En attente - la tache est bloquee ou attend quelqu'un/quelque chose |
| `#D-YYYY-MM-DD` | Date d'echeance - par ex. `#D-2026-03-15` |
| `#C-YYYY-MM-DD` | Date de completion - par ex. `#C-2026-03-15` |

Exemple d'utilisation :

```markdown
- [ ] #P1 Corriger le bug critique en production
- [ ] #P2 #W En attente de l'approbation du design pour le nouveau panneau
- [x] #D-2026-03-10 Soumettre le rapport trimestriel
```

Plusieurs etiquettes peuvent etre combinees. Une seule etiquette de priorite est utilisee ; s'il y en a plusieurs, la premiere l'emporte.

#### Gestion des taches

L'icone **AS Notes** dans la barre d'activite ouvre la barre laterale Taches, qui affiche toutes les taches dans votre workspace.

**Regrouper par** - choisissez comment les taches sont regroupees :

| Vue | Description |
|---|---|
| **Page** | Taches regroupees alphabetiquement par page source |
| **Priorite** | Taches regroupees par niveau de priorite (P1 -> P2 -> P3 -> Sans priorite), triees par date d'echeance au sein de chaque groupe |
| **Date d'echeance** | Taches regroupees par date d'echeance |
| **Date de completion** | Taches regroupees par date de completion |

**Filtres :**

- **TODO UNIQUEMENT** - afficher uniquement les taches incompletes (active par defaut)
- **EN ATTENTE UNIQUEMENT** - afficher uniquement les taches avec l'etiquette `#W`
- **Filtrer par page** - tapez pour limiter les taches aux pages dont le nom contient le texte de recherche (insensible a la casse)

### Panneau de retroliens

Le panneau de retroliens affiche les references a la page. Les references sont capturees par mention de page, indentation style outliner sous un autre wikilink ou imbrication dans un autre wikilink. Le suivi des retroliens capture le contexte environnant, fonctionne pour les references futures (pages avec des wikilinks mais pas encore creees) et se met a jour en temps reel avec les changements d'index.

Ouvrez l'onglet editeur de retroliens a cote de votre onglet actuel avec : `Ctrl+Alt+B` (Windows/Linux) / `Cmd+Alt+B` (macOS)

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/as-notes-backlink-panel.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

#### Modes d'affichage

Le panneau prend en charge deux modes d'affichage, alternables via un bouton dans l'en-tete du panneau :

- **Plat par page** (par defaut) - toutes les instances de retroliens triees alphabetiquement par nom de page source. Fournit une vue chronologique lineaire ou les fichiers de journal sont tries chronologiquement.
- **Regroupe par chaine** - retroliens regroupes par leur motif de chaine (la sequence de noms de pages), avec des en-tetes repliables. Utile pour l'exploration basee sur les concepts.

Le mode par defaut est configure via `as-notes.backlinkGroupByChain` (par defaut `false`).

Un controle separe bascule la **verbosite du contexte** - compact (une ligne, tronque) ou etendu (texte complet visible). Par defaut configure via `as-notes.backlinkWrapContext` (par defaut `false`).

#### Affichage chaine en premier

- **Regroupement par motif** - les retroliens sont regroupes par leur motif de chaine (par ex. tous les `[[Project]] -> [[Tasks]] -> [[NGINX]]` de differents fichiers apparaissent dans un groupe).
- **Mentions autonomes** - les references directes `[[wikilink]]` apparaissent comme des chaines a lien unique, triees en premier.
- **Contexte de plan** - si un wikilink est indente sous un autre wikilink, la hierarchie complete est montree comme une chaine (par ex. `Page A -> Page B -> Page C`), avec chaque lien cliquable.
- **Numeros de ligne par lien** - chaque lien de chaine affiche son numero de ligne (par ex. `[L12]`) pour une navigation precise.
- **Contexte de ligne** - chaque instance de chaine montre le texte de la ligne environnante avec le wikilink en surbrillance, donnant un contexte immediat sans ouvrir le fichier.
- **Regroupement insensible a la casse** - `[[server]]` et `[[Server]]` produisent le meme motif de chaine.

#### Menu contextuel - Voir les retroliens

Faites un clic droit sur n'importe quel wikilink dans l'editeur pour ouvrir les retroliens de cette page specifique :

- Fonctionne avec les alias - si le wikilink pointe vers un alias, les retroliens de la page canonique sont affiches.
- Fonctionne avec les references futures - les pages qui n'existent pas encore montrent tous les liens entrants.

### Tableau Kanban

AS Notes dispose d'un tableau Kanban integre soutenu par des fichiers markdown qui peuvent etre utilises et edites comme n'importe quelle autre page dans AS Notes.

Utilisez le tableau Kanban pour suivre les projets a long terme. Les taches standard peuvent etre utilisees dans les fichiers de cartes Kanban comme dans n'importe quelle autre note AS Notes.

### Journal quotidien

Appuyez sur **Ctrl+Alt+J** (Cmd+Alt+J sur macOS) pour creer ou ouvrir la page du journal du jour.

Les fichiers de journal sont crees sous le format `YYYY-MM-DD.md` dans un dossier dedie `journals/` (configurable). Les nouvelles pages sont generees a partir du modele `Journal.md` dans le dossier de modeles (par defaut : `templates/`). Editez `Journal.md` pour ajouter vos propres sections et indicateurs. Tous les espaces reserves de modeles sont pris en charge ; consultez [Modeles](#modeles-pro).

Un panneau **Calendrier** dans la barre laterale affiche le mois en cours avec des indicateurs de journal. Cliquez sur n'importe quel jour pour ouvrir son entree de journal. Consultez [Calendrier](#calendrier) pour plus de details.

> **Note :** Le journal quotidien necessite un workspace initialise (repertoire `.asnotes/`). Consultez [Premiers pas](#premiers-pas).

### Compatibilite avec d'autres PKMS Markdown

AS Notes peut fonctionner aux cotes de bases de connaissances creees dans Obsidian ou Logseq en raison de structures de fichiers similaires. Notez qu'il existe des differences de format et de comportement.

### Commandes slash

Tapez `/` dans n'importe quel fichier markdown pour ouvrir un menu de commandes rapides. Continuez a taper pour filtrer la liste, appuyez sur Entree pour executer une commande, ou appuyez sur Echap pour fermer et laisser le `/` en place. Les commandes slash sont supprimees dans les blocs de code delimites, les segments de code en ligne et le front matter YAML.

#### Commandes standard

| Commande | Action |
|---|---|
| **Today** | Insere un wikilink pour la date du jour, par ex. `[[2026-03-06]]` |
| **Date Picker** | Ouvre une zone de saisie de date pre-remplie avec la date du jour. Editez la date ou appuyez sur Entree pour l'inserer comme wikilink |
| **Code (inline)** | Insere `` ` `` `` ` `` avec le curseur place entre les backticks |
| **Code (multiline)** | Insere un bloc de code delimite avec le curseur apres l'ouverture ` ``` ` - tapez l'identifiant de langage (par ex. `js`) et appuyez sur Entree |

#### Commandes de publication *(front matter)*

Ces commandes basculent ou alternent des champs lies a la publication dans le front matter YAML du fichier. Consultez [Publier un site statique](#publier-un-site-statique) pour plus de details.

| Commande | Action |
|---|---|
| **Public** | Bascule `public: true` / `public: false` dans le front matter |
| **Layout** | Alterne `layout` entre `docs`, `blog` et `minimal` dans le front matter |
| **Retina** | Bascule `retina: true` / `retina: false` dans le front matter |
| **Assets** | Bascule `assets: true` / `assets: false` dans le front matter |

#### Commandes de carte Kanban *(fichiers de carte kanban uniquement)*

La commande suivante n'apparait que lors de l'edition d'un fichier de carte kanban (`kanban/card_*.md`).

| Commande | Action |
|---|---|
| **Card: Entry Date** | Insere un en-tete `## entry YYYY-MM-DD` au curseur, pre-rempli avec la date du jour |

#### Commandes de tache *(lignes de tache uniquement)*

Ces commandes n'apparaissent que lorsque le curseur est sur une ligne de tache (`- [ ]` ou `- [x]`). Les etiquettes sont inserees apres la case a cocher et apres tout hashtag existant sur la ligne.

| Commande | Action |
|---|---|
| **Task: Priority 1** | Insere `#P1` au debut du texte de la tache. Remplace toute etiquette de priorite existante (`#P1`-`#P9`) sur la ligne |
| **Task: Priority 2** | Insere `#P2`, remplacant toute etiquette de priorite existante |
| **Task: Priority 3** | Insere `#P3`, remplacant toute etiquette de priorite existante |
| **Task: Waiting** | Bascule `#W` au debut du texte de la tache (insere si absente, supprime si presente) |
| **Task: Due Date** | Ouvre une saisie de date pre-remplie avec la date du jour (YYYY-MM-DD). Insere `#D-YYYY-MM-DD` au debut du texte de la tache. Remplace toute etiquette de date d'echeance existante |
| **Task: Completion Date** | Ouvre une saisie de date pre-remplie avec la date du jour (YYYY-MM-DD). Insere `#C-YYYY-MM-DD` au debut du texte de la tache. Remplace toute etiquette de date de completion existante |
| **Convert to Kanban Card** *(Pro)* | Marque la tache comme terminee, cree une carte Kanban dans le couloir **TODO** avec le titre de la tache (sans etiquettes), la priorite et la date d'echeance correspondantes, et le drapeau **Waiting** defini. Disponible uniquement sur les taches non cochees |

Les etiquettes de priorite et d'attente fonctionnent en bascule : utiliser la meme etiquette a nouveau la supprime. Utiliser une priorite differente remplace l'existante. Les etiquettes de date d'echeance et de completion remplacent toute etiquette existante du meme type.

#### Commandes Pro

Les commandes Pro sont disponibles avec une licence Pro. Les utilisateurs gratuits les voient listees avec **(Pro)** ajoute dans le menu.

| Commande | Action |
|---|---|
| **Template** | Ouvre une liste de selection rapide des modeles du dossier de modeles et insere le modele selectionne au curseur. Prend en charge les espaces reserves (consultez [Modeles](#modeles-pro)) |
| **Table** | Demande le nombre de colonnes et de lignes, puis insere un tableau markdown formate |
| **Table: Format** | Normalise toutes les largeurs de colonnes dans le tableau environnant au contenu de cellule le plus long |
| **Table: Add Column(s)** | Demande le nombre, puis ajoute des colonnes apres la colonne actuelle du curseur |
| **Table: Add Row(s)** | Demande le nombre, puis ajoute des lignes apres la ligne actuelle du curseur |
| **Table: Remove Row (Current)** | Supprime la ligne au curseur (refuse l'en-tete/separateur) |
| **Table: Remove Column (Current)** | Supprime la colonne au curseur (refuse les tableaux a une seule colonne) |
| **Table: Remove Row(s) Above** | Demande le nombre, puis supprime les lignes de donnees au-dessus du curseur (limite a celles disponibles) |
| **Table: Remove Row(s) Below** | Demande le nombre, puis supprime les lignes en dessous du curseur (limite a celles disponibles) |
| **Table: Remove Column(s) Right** | Demande le nombre, puis supprime les colonnes a droite du curseur (limite a celles disponibles) |
| **Table: Remove Column(s) Left** | Demande le nombre, puis supprime les colonnes a gauche du curseur (limite a celles disponibles, preserve l'indentation) |

### Glisser-deposer des fichiers / Copier + Coller

Glissez des fichiers depuis votre gestionnaire de fichiers vers l'editeur markdown, ou collez des images depuis le presse-papiers : l'editeur markdown integre de VS Code gere la copie et l'insertion du lien automatiquement.

AS Notes configure le parametre de workspace integre `markdown.copyFiles.destination` pour que les fichiers glisses/colles soient enregistres dans un dossier de ressources dedie plutot qu'a cote de votre fichier markdown.

| Parametre | Defaut | Description |
|---|---|---|
| `as-notes.assetPath` | `assets/images` | Dossier relatif au workspace ou les fichiers glisses/colles sont enregistres |

Le parametre est applique automatiquement lorsque AS Notes est initialise ou lorsque la valeur change. Le dossier de destination est cree par VS Code lors de la premiere utilisation.

**Conseils :**

- **Indicateur de position de depot :** Maintenez **Shift** enfonce en glissant un fichier pour voir un guide de position du curseur avant de deposer, utile pour placer le lien avec precision dans votre texte.

### Apercu d'image au survol

Survolez n'importe quel lien d'image dans un fichier markdown pour voir un apercu de l'image en ligne. L'implementation standard est fournie par l'extension markdown integree de VS Code et ne necessite aucune configuration : elle fonctionne aussi bien avec les liens standard `![alt](path)` qu'avec les images glissees/collees. Le mode editeur markdown en ligne inclut un affichage d'images ameliore.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/image-preview.png" alt="AS Notes Image Preview" style="max-height:300px; margin-top: 10px; margin-bottom: 10px;">

#### Autocompletion des blocs de code

L'autocompletion des blocs de code fonctionne dans **tous** les fichiers markdown ; le mode outliner n'est pas requis.

Lorsque vous tapez `` ``` `` (avec un langage optionnel, par ex. `` ```javascript ``) et appuyez sur **Entree**, AS Notes insere automatiquement le `` ``` `` de fermeture et place le curseur a l'interieur du bloc. Sur une ligne a puce, le contenu est indente pour correspondre a la continuation de liste markdown.

L'extension detecte les paires de delimiteurs existantes : si les backticks sont deja equilibres (c.-a-d. qu'il y a un delimiteur de fermeture correspondant a la meme indentation), Entree insere simplement une nouvelle ligne au lieu d'un second squelette.

En mode outliner, appuyer sur Entree sur une ligne de fermeture `` ``` `` qui appartient a un bloc de code a puce insere une nouvelle puce a l'indentation du parent.

## Fonctionnalites Pro d'AS Notes

Une **licence Pro** deverrouille les fonctionnalites premium. Lorsqu'une cle valide est active, la barre d'etat affiche **AS Notes (Pro)**.

Pour obtenir une cle de licence, visitez [asnotes.io](https://www.asnotes.io/pricing)

**Entrer votre cle de licence :**

- Executez **AS Notes: Enter Licence Key** depuis la Palette de Commandes (`Ctrl+Shift+P`), c'est le moyen le plus rapide.
- Ou ouvrez les Parametres VS Code (`Ctrl+,`), recherchez `as-notes.licenceKey` et collez votre cle.

### Style Markdown en editeur en ligne, Mermaid et rendu LaTeX (Pro)

AS Notes Pro inclut un style markdown en ligne optionnel de type Typora, le rendu des diagrammes Mermaid et LaTeX dans les onglets de l'editeur VS Code (ou editeur compatible). Les caracteres de syntaxe Markdown standard (`**`, `##`, `[]()`, etc.) sont remplaces par leurs equivalents visuels pendant que vous tapez.

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/asnotes-inline-editor-markdown-styling-mermaid-andlatex-rendering.png" alt="Inline Editor Markdown Styling, Mermaid and LaTeX Rendering" style="max-height:400px; margin-top: 10px">

Consultez [Style Markdown en editeur en ligne, Mermaid et rendu LaTeX](https://docs.asnotes.io/inline-markdown-editing-mermaid-and-latex-rendering.html) pour plus d'informations.

AS Notes inclut un editeur Markdown en ligne integre qui rend le formatage directement dans l'editeur de texte, similaire a Typora.

**Visibilite a trois etats :**

| Etat | Quand | Ce que vous voyez |
|---|---|---|
| **Rendu** | Le curseur est ailleurs | Texte formate propre (syntaxe masquee) |
| **Fantome** | Le curseur est sur la ligne | Caracteres de syntaxe avec opacite reduite |
| **Brut** | Le curseur est dans le constructeur | Code source Markdown complet |

**Constructeurs pris en charge :**

Gras, italique, barre, en-tetes (H1-H6), code en ligne, liens, images, citations, lignes horizontales, listes non ordonnees/de taches, blocs de code (avec etiquettes de langage), frontmatter YAML, tableaux GFM, codes courts emoji (`:smile:` etc.), diagrammes Mermaid (SVG en ligne), LaTeX/mathematiques (KaTeX/MathJax), mentions GitHub et references d'issues.

**Basculer :** Utilisez la commande **AS Notes: Toggle Inline Editor** ou cliquez sur l'icone de l'oeil dans la barre de titre de l'editeur. L'etat de bascule est persiste par workspace.

**Conscience du mode outliner :** Lorsque le mode outliner est actif, les marqueurs de puces et la syntaxe des cases a cocher sont stylises en ligne (les puces sont rendues comme des puces stylisees, les cases a cocher sont rendues avec puce et graphique de case a cocher) aux cotes de la structure outliner.

| Parametre | Defaut | Description |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | Activer/desactiver le rendu en ligne |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | Opacite pour les caracteres de syntaxe en etat fantome |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | Ouvrir les liens en un seul clic (au lieu de Ctrl+Clic) |

Consultez [Parametres](#parametres) pour la liste complete des parametres de l'editeur en ligne.

### Modeles (Pro)

Creez des modeles de notes reutilisables sous forme de fichiers markdown dans un dossier de modeles dedie (par defaut : `templates/`). Inserez-les n'importe ou via la commande slash `/Template`.

**Configuration :** Les modeles sont crees automatiquement lors de l'initialisation d'un workspace. Un modele par defaut `Journal.md` est inclus pour les entrees de journal quotidiennes.

**Creer des modeles :** Ajoutez n'importe quel fichier `.md` au dossier de modeles. Les sous-repertoires sont pris en charge ; les modeles dans les sous-dossiers apparaissent comme `dossier/nom` dans le selecteur.

**Inserer un modele :** Tapez `/` dans n'importe quel fichier markdown, selectionnez **Template**, puis choisissez dans la liste. Le contenu du modele est insere a la position du curseur avec tous les espaces reserves remplaces.

**Espaces reserves :**

| Espace reserve     | Description                                                    | Exemple                               |
|--------------------|----------------------------------------------------------------|---------------------------------------|
| `{{date}}`         | Date actuelle (YYYY-MM-DD)                                     | `2026-03-18`                          |
| `{{time}}`         | Heure actuelle (HH:mm:ss)                                     | `14:30:45`                            |
| `{{datetime}}`     | Date et heure completes (YYYY-MM-DD HH:mm:ss)                 | `2026-03-18 14:30:45`                 |
| `{{filename}}`     | Nom du fichier actuel sans extension                           | `My Page`                             |
| `{{title}}`        | Alias de `{{filename}}`                                        | `My Page`                             |
| `{{cursor}}`       | Position du curseur apres l'insertion                          | *(le curseur atterrit ici)*           |
| Format de date personnalise | Toute combinaison de jetons `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss` | `{{DD/MM/YYYY}}` devient `18/03/2026` |

Pour afficher un litteral `{{date}}` dans le modele, echappez-le avec une barre oblique inversee : `\{{date}}`.

**Modele de journal :** Le fichier `Journal.md` dans le dossier de modeles est utilise comme modele pour les nouvelles entrees de journal quotidiennes. Editez-le pour personnaliser les futures pages de journal.

### Commandes de tableau

Toutes les operations de tableau dans le menu de commandes slash (`/`) sont des fonctionnalites Pro. Les utilisateurs gratuits les voient listees avec **(Pro)** ajoute ; elles sont visibles mais bloquees jusqu'a ce qu'une licence soit activee.

Consultez [Commandes slash](#commandes-slash) pour la liste complete des commandes de tableau.

### Notes chiffrees (Pro)

Les utilisateurs Pro peuvent stocker des notes sensibles dans des fichiers chiffres. Tout fichier avec l'extension `.enc.md` est traite comme une note chiffree ; il est exclu de l'index de recherche et l'extension ne le lit jamais comme texte brut.

**Premiers pas avec le chiffrement :**

1. Executez **AS Notes: Set Encryption Key** depuis la Palette de Commandes. Votre phrase de passe est stockee de maniere securisee dans le trousseau du systeme d'exploitation (VS Code SecretStorage) ; elle n'est jamais ecrite sur le disque ni dans les fichiers de configuration.
2. Creez une note chiffree avec **AS Notes: Create Encrypted Note** (ou **AS Notes: Create Encrypted Journal Note** pour une entree de journal datee).
3. Ecrivez votre note dans l'editeur. Quand vous voulez la verrouiller, executez **AS Notes: Encrypt [All|Current] Note(s)** ; tous les fichiers `.enc.md` en texte brut sont chiffres sur place.
4. Pour lire une note, executez **AS Notes: [All|Current] Note(s)** ; les fichiers sont dechiffres sur place avec votre phrase de passe stockee.

**Details du chiffrement :**

- Algorithme : AES-256-GCM avec un nonce aleatoire de 12 octets par chiffrement
- Derivation de cle : PBKDF2-SHA256 (100 000 iterations) a partir de votre phrase de passe
- Format de fichier : marqueur sur une seule ligne `ASNOTES_ENC_V1:<base64url payload>`, utilise pour aider a prevenir les commits accidentels via un hook pre-commit Git.

**Commandes :**

- `AS Notes: Set Encryption Key` - enregistrer la phrase de passe dans le trousseau du systeme
- `AS Notes: Clear Encryption Key` - supprimer la phrase de passe stockee
- `AS Notes: Create Encrypted Note` - creer un nouveau fichier `.enc.md` nomme dans le dossier de notes
- `AS Notes: Create Encrypted Journal Note` - creer l'entree de journal du jour en `.enc.md`
- `AS Notes: Encrypt All Notes` - chiffrer tous les fichiers `.enc.md` en texte brut
- `AS Notes: Decrypt All Notes` - dechiffrer tous les fichiers `.enc.md` chiffres
- `AS Notes: Encrypt Current Note` - chiffrer le fichier `.enc.md` actif (lit le contenu non enregistre de l'editeur)
- `AS Notes: Decrypt Current Note` - dechiffrer le fichier `.enc.md` actif (lit depuis le disque)

### Mode Outliner

Activez le **Mode Outliner** (parametre `as-notes.outlinerMode` ou commande **AS Notes: Toggle Outliner Mode**) pour transformer l'editeur en outliner base sur les puces. Chaque ligne commence par `-` et des raccourcis clavier personnalises vous maintiennent dans le flux :

| Touche | Action |
|---|---|
| **Entree** | Insere une nouvelle puce avec la meme indentation. Les lignes de tache (`- [ ]`) continuent comme taches non cochees. |
| **Tab** | Indente la puce d'un niveau (limite a un niveau plus profond que la puce au-dessus). |
| **Shift+Tab** | Desindente la puce d'un niveau. |
| **Ctrl+Shift+Entree** | Alterne : puce simple -> `- [ ]` -> `- [x]` -> puce simple. |
| **Ctrl+V / Cmd+V** | Collage multiligne : chaque ligne du presse-papiers devient une puce separee. |

## Premiers pas

Pour un exemple de base de connaissances, clonez <https://github.com/appsoftwareltd/as-notes-demo-notes> et suivez les instructions pour l'initialiser.

### Initialiser un workspace

AS Notes s'active lorsqu'il trouve un repertoire `.asnotes/` a la racine de votre workspace ou dans le sous-repertoire `rootDirectory` configure (similaire a `.git/` ou `.obsidian/`). Sans lui, l'extension fonctionne en **mode passif** ; les commandes affichent une notification amicale vous invitant a initialiser, et la barre d'etat vous invite a configurer.

Pour initialiser :

1. Ouvrez la Palette de Commandes (`Ctrl+Shift+P`)
2. Executez **AS Notes: Initialise Workspace**

Cela cree le repertoire `.asnotes/`, construit un index SQLite de tous les fichiers markdown et active toutes les fonctionnalites. Le fichier d'index (`.asnotes/index.db`) est exclu de git via un `.gitignore` genere automatiquement.

### Utiliser AS Notes aux cotes du code source

AS Notes fonctionne bien comme base de connaissances au sein d'un projet logiciel. Vous pouvez maintenir des notes, des journaux et de la documentation dans un sous-repertoire (par ex. `docs/` ou `notes/`) tandis que le reste du depot contient du code source. Lorsqu'un repertoire racine est configure, toutes les fonctionnalites d'AS Notes (surbrillance des wikilinks, autocompletion, tooltips au survol, commandes slash) sont limitees a ce repertoire. Les fichiers markdown en dehors, comme un `README.md` a la racine du workspace, ne sont pas affectes du tout.

Lors de l'initialisation, la commande **Initialise Workspace** vous demandera de choisir un emplacement :

- **Racine du workspace** - l'option par defaut, utilise tout le workspace
- **Choisir un sous-repertoire** - ouvre un selecteur de dossiers limite a votre workspace

Le chemin choisi est enregistre comme parametre de workspace `as-notes.rootDirectory`. Lorsqu'il est defini, toutes les donnees d'AS Notes vivent dans ce repertoire : `.asnotes/`, `.asnotesignore`, journaux, modeles, notes, tableaux kanban et l'index. Le scan, la surveillance des fichiers et l'indexation sont limites a ce repertoire, donc les fichiers en dehors ne sont pas affectes.

Si `as-notes.rootDirectory` est deja configure avant d'executer **Initialise Workspace**, la commande utilise directement le chemin configure.

> **Attention :** Si vous changez `rootDirectory` apres l'initialisation, vous devez deplacer manuellement le repertoire de notes (y compris `.asnotes/`) vers le nouvel emplacement et recharger la fenetre. L'extension affichera un avertissement lorsque le parametre change.

### Reconstruire l'index

Si l'index devient obsolete ou corrompu, executez **AS Notes: Rebuild Index** depuis la Palette de Commandes. Cela supprime et recree l'index complet avec un indicateur de progression.

### Nettoyer le workspace

Si l'extension est dans un mauvais etat (par ex. erreurs WASM persistantes apres un crash), executez **AS Notes: Clean Workspace** depuis la Palette de Commandes. Cela :

- Supprime le repertoire `.asnotes/` (base de donnees d'index, logs, configuration du hook Git)
- Libere tout l'etat en memoire et passe en mode passif

`.asnotesignore` a la racine d'AS Notes est preserve intentionnellement. Executez **AS Notes: Initialise Workspace** ensuite pour repartir de zero.

### Exclure des fichiers de l'index

Lorsque AS Notes initialise un workspace, il cree un fichier `.asnotesignore` dans le repertoire racine d'AS Notes. Ce fichier utilise la [syntaxe de motifs `.gitignore`](https://git-scm.com/docs/gitignore) et controle quels fichiers et repertoires sont exclus de l'index d'AS Notes.

**Contenu par defaut :**

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

Les motifs sans `/` initial correspondent a n'importe quelle profondeur : `logseq/` exclut `logseq/pages/foo.md` et `vaults/work/logseq/pages/foo.md` de la meme facon. Prefixez avec `/` pour ancrer un motif uniquement a la racine d'AS Notes (par ex. `/logseq/`).

Editez `.asnotesignore` a tout moment. AS Notes surveille le fichier et re-scanne l'index automatiquement lorsqu'il change : les fichiers nouvellement ignores sont supprimes de l'index et les fichiers des-ignores sont ajoutes.

> **Note :** `.asnotesignore` est un fichier editable par l'utilisateur et versionne. AS Notes ne l'ecrasera jamais apres la creation initiale.

---

## Depannage

### Performances reduites sous gestion d'outils de synchronisation de fichiers

Il a ete observe que l'editeur VS Code peut sembler plus lent lorsque le repertoire est sous gestion de certains outils de synchronisation (par ex. MS OneDrive, Google Drive, Dropbox, etc.).

Les repertoires AS Notes peuvent etre geres via la synchronisation, bien que Git soit recommande car il ne surveille pas les fichiers comme le font les outils de synchronisation et dispose de fonctionnalites completes de resolution de conflits.

### "Ce fichier n'est pas encore indexe"

Le panneau de retroliens affiche ce message lorsque le fichier actuel n'est pas dans l'index d'AS Notes. Causes courantes :

- **Parametres `files.exclude` / `search.exclude` de VS Code** - AS Notes utilise `vscode.workspace.findFiles()` pour decouvrir les fichiers markdown, qui respecte ces parametres VS Code. Les fichiers dans les dossiers exclus (par ex. `logseq/version-files/`) sont silencieusement omis du scan et ne seront jamais indexes. Verifiez **Settings -> Files: Exclude** et **Settings -> Search: Exclude** si un fichier que vous attendez est manquant.
- **Motifs `.asnotesignore`** - Les fichiers correspondant aux motifs dans `.asnotesignore` a la racine d'AS Notes sont exclus de l'index. Voir [Exclure des fichiers de l'index](#exclure-des-fichiers-de-lindex) ci-dessus.
- **Fichier pas encore enregistre** - Les nouveaux fichiers non enregistres ne sont pas indexes tant qu'ils ne sont pas enregistres sur le disque pour la premiere fois.

Pour resoudre, verifiez les parametres de votre workspace et le fichier `.asnotesignore`. Si le fichier devrait etre indexe, assurez-vous qu'il ne correspond a aucun motif d'exclusion, puis executez **AS Notes: Rebuild Index** depuis la Palette de Commandes.

## Developpement

Le depot est structure comme un monorepo avec trois paquets :

| Paquet | Description |
|---|---|
| `common/` | Bibliotheque partagee d'analyse de wikilinks (`Wikilink`, `WikilinkService`, `MarkdownItWikilinkPlugin`) |
| `vs-code-extension/` | L'extension VS Code |
| `publish/` | Utilitaire CLI qui convertit un cahier AS Notes (markdown + wikilinks) en HTML statique |

Le code source de la documentation reside dans `docs-src/` (un workspace AS Notes). L'outil `publish` le convertit en `docs/`.

### Extension VS Code

```bash
cd vs-code-extension
npm install
npm run build    # Construire l'extension
npm run watch    # Mode surveillance (reconstruit sur les modifications)
npm test         # Executer les tests unitaires
npm run lint     # Verification de types
```

### Publier vers HTML depuis AS Notes (Conversion HTML)

Le convertisseur est publie comme paquet npm :

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

Consultez [Publier un site statique](https://docs.asnotes.io/publishing-a-static-site.html) pour la documentation complete.

### Debogage

Appuyez sur **F5** dans VS Code pour lancer l'Hote de Developpement d'Extension avec l'extension chargee.

La version de debogage a priorite sur l'installation du Marketplace, donc les deux peuvent coexister.

VS Code se souvient du dernier dossier ouvert dans l'Hote de Developpement d'Extension. La [base de connaissances de demonstration](https://github.com/appsoftwareltd/as-notes-demo-notes) est concue pour couvrir les scenarios d'utilisation courants.

### Tests

Les tests unitaires utilisent [vitest](https://vitest.dev/) et couvrent l'analyseur de wikilinks, la recherche basee sur les offsets, le calcul de segments, le CRUD du service d'index, l'extraction de titres, le flux de donnees de detection de renommage et l'indexation de liens imbriques. Executez avec `npm test`.

### Publication

Les versions sont publiees manuellement sur le VS Code Marketplace, puis une Release GitHub est automatiquement creee lorsqu'un tag de version est pousse.

**Etape 1 - incrementer la version**

Mettez a jour `version` dans `package.json` et ajoutez une entree dans `CHANGELOG.md`.

**Etape 2 - publier sur le VS Code Marketplace**

```bash
cd .\vs-code-extension\
npm run build
npx @vscode/vsce package
npx @vscode/vsce login appsoftwareltd   # entrez le token PAT si l'authentification a expire
npx @vscode/vsce publish
```

**Etape 3 - taguer et pousser**

```bash
cd ..
git add .
git commit -m "Release v2.3.2"   # changer la version
git tag v2.3.2                   # changer la version
git push origin main --tags
```

Pousser le tag declenche le [workflow de Release](.github/workflows/release.yml), qui cree automatiquement une Release GitHub avec des notes de version generees automatiquement et le lien d'installation du VS Code Marketplace.

### Publier le CLI npm (`asnotes-publish`)

**Etape 1 - incrementer la version**

Mettez a jour `version` dans `publish/package.json`.

**Etape 2 - construire et publier**

```bash
cd publish
npm run build
npm login
npm publish
```

**Etape 3 - verifier**

```bash
npx asnotes-publish --help
```

## Agent Skills

Un [agent skill](https://skills.sh/) est disponible pour AS Notes. Installez-le pour donner a votre assistant IA (GitHub Copilot, Claude, etc.) une connaissance complete de l'extension : syntaxe des wikilinks, commandes, parametres, raccourcis clavier et plus encore.

```bash
npx skills add appsoftwareltd/as-notes/skills/as-notes-agent-use
```

Une fois installe, votre assistant IA peut repondre aux questions sur AS Notes, vous aider a configurer les parametres, expliquer les fonctionnalites et vous assister dans votre flux de travail de prise de notes.

## Avertissement

Ce logiciel est fourni "tel quel", sans garantie d'aucune sorte, expresse ou implicite. Les auteurs et contributeurs n'acceptent aucune responsabilite pour toute perte, corruption ou dommage aux donnees, fichiers ou systemes resultant de l'utilisation ou de la mauvaise utilisation de cette extension, y compris mais sans s'y limiter les operations qui creent, renomment, deplacent ou modifient des fichiers dans votre workspace.

**Vous etes seul responsable du maintien de sauvegardes de vos donnees.** Il est fortement recommande d'utiliser le controle de version (par ex. git) ou une autre strategie de sauvegarde pour toutes les notes ou fichiers que vous gerez avec cette extension.

Cette extension est sous licence [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](LICENSE).

Vous etes libre d'utiliser, de partager et d'adapter cette extension a des **fins non commerciales** avec attribution. L'utilisation commerciale necessite une licence commerciale separee. Consultez [LICENSE](LICENSE) pour les conditions completes ou contactez-nous a <https://www.appsoftware.com/contact>.
