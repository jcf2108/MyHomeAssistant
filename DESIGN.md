---
name: MyHomeAssistant
description: Panneau compagnon Windows 11 Quick Settings & Media Flyout en surface Mica/Acrylic anthracite pour Home Assistant.
colors:
  fluent-sky: "#60a5fa"
  fluent-sky-hover: "#7bb6fc"
  accent-ink: "#09111e"
  warm-kelvin: "#fbbf24"
  cool-daylight: "#7dd3fc"
  online-emerald: "#34d399"
  signal-coral: "#f87171"
  desktop-stage: "#0e1015"
  flyout-anthracite: "#1c1e24"
  flyout-acrylic: "rgba(26, 29, 36, 0.80)"
  media-module: "rgba(36, 41, 52, 0.85)"
  control-track: "#282d37"
  control-hover: "#313744"
  control-active: "#3a4150"
  inactive-slate: "#525b6c"
  specular-rim: "rgba(255, 255, 255, 0.10)"
  subtle-divider: "rgba(255, 255, 255, 0.06)"
  chalk-primary: "#f3f5f8"
  slate-secondary: "#b4bcc9"
  muted-ink: "#949eae"
typography:
  headline:
    fontFamily: "\"Segoe UI Variable Text\", \"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: "\"Segoe UI Variable Text\", \"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "\"Segoe UI Variable Text\", \"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "\"Segoe UI Variable Text\", \"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.25
    fontFeature: "'tnum'"
rounded:
  flyout: "12px"
  module: "10px"
  control: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.fluent-sky}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.fluent-sky-hover}"
  button-secondary:
    backgroundColor: "{colors.control-track}"
    textColor: "{colors.chalk-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  tile-scene:
    backgroundColor: "{colors.control-track}"
    textColor: "{colors.chalk-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0px 12px"
  tile-scene-active:
    backgroundColor: "{colors.fluent-sky}"
    textColor: "{colors.accent-ink}"
  input-field:
    backgroundColor: "{colors.control-track}"
    textColor: "{colors.chalk-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  pill-badge:
    backgroundColor: "{colors.control-track}"
    textColor: "{colors.slate-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: MyHomeAssistant

## Overview

**Creative North Star: "L'Extension Système Invisible"**

MyHomeAssistant est conçu pour se fondre dans la barre système de Windows 11 avec la retenue, la densité tactile et la réactivité immédiate des *Quick Settings* et du *Media Flyout* natifs. Plutôt que de reproduire un tableau de bord web domotique bavard ou un mur de cartes imbriquées, le système traite chaque entité Home Assistant comme un réglage matériel du poste de travail : une mini-pilule oblongue en lévitation discrète au-dessus de l'horloge qui s'ouvre en 180 ms en un châssis Acrylic anthracite structuré.

Toute l'interface obéit à une discipline radicale de brièveté : aucun paragraphe explicatif, aucun sous-titre redondant, aucun libellé d'en-tête superflu (*eyebrow*). La compréhension passe en moins d'une seconde par la teinte physique réelle d'une lampe allumée, la pochette de l'album en cours, une icône au trait constant (`1.75px`) et un mot-clé de un à trois mots accompagné d'une mesure tabulaire.

**Key Characteristics:**
- Réfraction Mica/Acrylic sombre (`blur(28px) saturate(165%)`) bordée d'un filet spéculaire périphérique de `1px` et d'un éclat interne supérieur.
- Langage chromatique fonctionnel où le bleu Fluent indique l'action système/audio tandis que l'ambre et le spectre RVB traduisent exclusivement l'état réel des luminaires allumés.
- Pistes de contrôle affleurantes et tuiles d'action compactes (`36px`) sans jamais imbriquer de cartes dans des cartes.
- Zéro surcharge textuelle : étiquettes limitées à 1–3 mots, valeurs numériques en chasse fixe (`tabular-nums`) et contrôles natifs (`select`, `range`, `switch`) intégralement redessinés.

## Colors

La palette associe une base anthracite froide translucide fidèle à Windows 11 sombre à un accent bleu lumineux haute lisibilité et des teintes physiques réservées aux états lumineux actifs.

### Primary
- **Bleu Ciel Fluent** (`fluent-sky`): Utilisé pour le bouton de lecture principal, la jauge de volume, les onglets actifs, les interrupteurs engagés et la confirmation d'activation d'une scène.
- **Bleu Ciel Fluent Survol** (`fluent-sky-hover`): Éclaircissement subtil au survol des contrôles primaires sans dérive de teinte.
- **Encre Nuit sur Accent** (`accent-ink`): Encre très sombre appliquée systématiquement sur tout fond rempli de Bleu Ciel Fluent ou d'ambre lumineux afin de garantir un contraste supérieur à `8.5:1`.

### Secondary
- **Ambre Kelvin Chaud** (`warm-kelvin`): Représente les températures de couleur chaudes (`2200K–3500K`), les variateurs Kelvin et les favoris épinglés.
- **Lumière du Jour Froide** (`cool-daylight`): Traduit visuellement les éclairages froids (`4500K–6500K`) sur les pistes et boutons de lampes allumées.

### Tertiary
- **Émeraude En Ligne** (`online-emerald`): Signale la connexion WebSocket active à Home Assistant et la présence du jeton dans le Coffre Windows.
- **Corail Signal** (`signal-coral`): Réservé aux erreurs d'authentification, à l'état hors ligne, à la sourdine audio et à la suppression du jeton.

### Neutral
- **Châssis Acrylic Anthracite** (`flyout-acrylic` / `flyout-anthracite`): Fond principal translucide de la mini-pilule et du panneau déployé.
- **Module Média Surélevé** (`media-module`): Surface légèrement plus dense isolant le bloc Media Flyout en tête de panneau.
- **Piste de Contrôle** (`control-track`), **Survol** (`control-hover`) & **Pressé** (`control-active`): Surfaces affleurantes des variateurs de lampes, tuiles de scènes, champs de saisie et listes déroulantes.
- **Ardoise Éteinte** (`inactive-slate`): Teinte neutre appliquée aux curseurs des lampes éteintes afin de supprimer tout accent saturé au repos.
- **Craie Primaire** (`chalk-primary`), **Ardoise Secondaire** (`slate-secondary`) & **Encre Atténuée** (`muted-ink`): Hiérarchie typographique calibrée pour maintenir un contraste supérieur à `4.5:1` sur toutes les pistes sombres.
- **Filet Spéculaire** (`specular-rim`) & **Séparateur Subtil** (`subtle-divider`): Contours optiques de `1px` structurant le châssis et les sections sans alourdir la grille.

### Named Rules
**The Active-Only Chromatic Rule.** Les couleurs vives (`fluent-sky`, `warm-kelvin`, teintes RVB) n'apparaissent jamais sur un équipement éteint : une lampe à `0%` replie son curseur et son bouton en ardoise neutre (`inactive-slate`).

**The Dark-Ink-On-Fill Rule.** Tout contrôle plein coloré (`fluent-sky` ou teinte de lampe active) bascule son icône et son texte en `accent-ink` sombre au lieu de blanc pur pour préserver une netteté irréprochable.

## Typography

**Display Font:** Segoe UI Variable Text (avec repli Segoe UI et sans-serif système)
**Body Font:** Segoe UI Variable Text (avec repli Segoe UI et sans-serif système)

**Character:** Une seule famille sans-serif humaniste native Windows assure l'ensemble des niveaux avec une échelle resserrée (`10px` à `14px`), privilégiant la lisibilité immédiate à distance normale d'écran et la stabilité géométrique des chiffres.

### Hierarchy
- **Headline** (`600`, `14px`, `1.35`): Titre du média en cours de lecture et états vides principaux.
- **Title** (`600`, `12px`, `1.35`): En-tête de fenêtre (`Maison`, `Paramètres`) et titres de sections (`Lumières`, `Scènes`) sans jamais les précéder d'un sur-titre.
- **Body** (`500`, `12px`, `1.4`): Noms courts des pièces, tuiles de scènes, sélecteurs d'enceintes et champs de configuration.
- **Label** (`500`, `11px`, `1.25`, `tabular-nums`): Pourcentages de volume et de luminosité, valeurs Kelvin (`3100K`), compteurs (`2/4`) et numéros de version.

### Named Rules
**The Three-Word Ceiling Rule.** Les libellés d'interface, boutons et tuiles se limitent à un maximum de un à trois mots ; aucun paragraphe d'aide ni sous-titre explicatif n'est toléré dans les écrans opérationnels.

**The Tabular Measurement Rule.** Toute valeur susceptible de varier en direct (volume, intensité, Kelvin, compteurs, horloge) active `font-variant-numeric: tabular-nums` pour interdire tout tremblement horizontal lors du glissement d'un curseur.

## Layout

L'interface repose sur deux gabarits fixes liés par un point d'ancrage commun (par défaut à `12px` au-dessus de la zone de notification Windows, déplaçable librement sur tout moniteur) :
- **Mini-Pilule repliée (`316px × 52px`)** : barre horizontale unique combinant poignée de déplacement, vignette ou favoris rapides, actions directes, bouton d'ouverture et jauge inférieure continue de `2.5px`.
- **Flyout déployé (`420px` par défaut, redimensionnable librement de `320px` à `1400px`)** : pile verticale structurée regroupant l'en-tête (`40px`), la barre de sortie volume, les onglets de vues Lovelace éventuels, et les sections en sous-grille modulaire dense (`6` à `16` colonnes : **3 à 8 tuiles carrées `aspect-square` non rognées par ligne** pour les Scènes, la Musique et les Jeux, `2` à `4` tuiles horizontales/sélecteurs et `1` à `2` lecteurs multimédias larges) coiffées du pied d'état (`32px`).

## Elevation & Depth

La profondeur combine la translucidité Acrylic (`backdrop-filter: blur(28px) saturate(165%)`) du châssis principal avec une stratification tonale franche des contrôles internes et un éclat spéculaire supérieur simulant l'éclairage directionnel de Windows 11.

### Shadow Vocabulary
- **Châssis Flyout & Pilule** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 16px 40px rgba(0, 0, 0, 0.56), 0 4px 12px rgba(0, 0, 0, 0.34)`): Élévation flottante au-dessus des fenêtres applicatives du bureau accompagnée de son reflet de crête interne de `1px`.
- **Module Média Interne** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06)`): Micro-relief supérieur distinguant le bloc lecteur multimédia des sections de réglages rapides.
- **Curseur de Variateur** (`box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45)`): Ombre courte détachant l'anneau tactile de `16px` de sa piste de `4px`.

### Named Rules
**The Specular Crest Rule.** Toute fenêtre flottante combine une bordure externe translucide (`1px`) et un reflet interne supérieur (`inset 0 1px 0`), sans jamais utiliser de halo coloré diffus à décalage nul.

## Shapes

Le vocabulaire géométrique suit la hiérarchie concentrique de Windows 11 :
- **Pilule complète (`9999px`)** pour le widget replié, les pastilles d'état (`En ligne`, `Aperçu`), les puces Kelvin/RVB et les interrupteurs à bascule.
- **Coins extérieurs Flyout (`12px`)** pour l'enveloppe principale du panneau déployé.
- **Coins intermédiaires (`10px`)** pour le module Media Flyout logé en partie haute.
- **Coins de contrôle (`8px`)** uniformisés sur l'ensemble des boutons carrés, vignettes d'album (`48px × 48px`), pistes de lumières, tuiles de scènes, listes déroulantes et champs de formulaire.

## Components

### Buttons
- **Shape:** Coins arrondis nets (`8px`) dans le Flyout ; circulaires (`9999px`) à l'intérieur de la Mini-Pilule pour épouser sa silhouette oblongue.
- **Primary:** Fond `fluent-sky`, texte et icône `accent-ink`, transition de couleur et léger retrait tactile (`scale(0.95)`) à l'appui ; état désactivé en surface mate (`#2a303c`) et texte `muted-ink` sans perte d'opacité globale.
- **Hover / Focus:** Survol en `fluent-sky-hover` (primaire) ou `control-hover` (secondaire) en `150ms` ; anneau `:focus-visible` de `2px` en `fluent-sky` décalé de `2px`.
- **Secondary / Ghost:** Boutons d'icône (`32px × 32px` ou `28px × 28px`) sur fond `control-track` ou transparent avec survol `control-track`.

### Chips
- **Style:** Pastilles compactes (`9999px`) associant soit une icône d'état (`En ligne`, `Aperçu`), soit une pastille chromatique de `8px` et la lecture Kelvin/RVB (`3100K`, `RVB`) sur fond sombre (`#1e222b`).
- **State:** Un clic sur une puce Kelvin/RVB la bascule en `fluent-sky` / `accent-ink` et déploie en ligne le variateur thermique et les présélections chromatiques.

### Cards / Containers
- **Corner Style:** `12px` sur l'enveloppe Flyout, `10px` sur le module Média, `8px` sur les bandes de lumières.
- **Background:** Châssis `flyout-acrylic`, module Média `media-module`, pistes `control-track` sans jamais imbriquer de sous-cartes supplémentaires.
- **Shadow Strategy:** Ombre portée profonde réservée au seul conteneur racine `.flyout-surface` ; séparation interne par filets horizontaux (`subtle-divider`).
- **Border:** Filet continu de `1px` (`specular-rim` à l'extérieur, `rgba(255,255,255,0.08)` sur le module Média).
- **Internal Padding:** `12px` à `14px` par section avec espacement vertical resserré (`6px`) entre éléments d'un même groupe.

### Inputs / Fields
- **Style:** Champs texte et listes déroulantes `appearance-none` sur fond `control-track`, bordure `1px` translucide, rayon `8px` et chevron SVG dessiné (`1.75px`) aligné à droite.
- **Focus:** Bordure active en `fluent-sky` et curseur texte (`caret-color`) assorti.
- **Error / Disabled:** Bandeau synthétique `signal-coral` à `15%` d'opacité en cas d'échec d'authentification ; interrupteurs `role="switch"` dotés d'une bordure constante de `1px` évitant tout saut géométrique.

### Navigation
- **Style:** Bascule instantanée (`100ms`) par segment à `3` onglets (`Serveur`, `Entités`, `Système`) dans la vue Paramètres, avec retour direct en en-tête et accès permanent par l'icône d'engrenage du pied de panneau.

### Adaptive Mini-Pill & Chromatic Sliders
- **Mini-Pilule Adaptative :** Bascule automatiquement entre le mini-lecteur (pochette ronde `36px`, piste, lecture/suivant, jauge de volume inférieure de `2.5px`) lorsqu'un média joue, et `3` raccourcis favoris actionnables en un clic dès que la lecture cesse.
- **Variateurs Continus (`.fluent-range`) :** Piste fine de `4px` remplie proportionnellement par la couleur active (`fluent-sky` pour l'audio, teinte Kelvin/RVB pour une lampe allumée, `inactive-slate` à l'arrêt) et curseur annulaire de `16px` à centre `flyout-anthracite` qui s'agrandit par `transform: scale(1.12)` au survol sans animer aucune propriété de layout.

## Do's and Don'ts

### Do:
- **Do** limiter chaque intitulé, bouton et tuile à 1–3 mots accompagnés d'une icône SVG au trait `1.75px`.
- **Do** ancrer l'animation d'ouverture du Flyout sur `transform-origin: bottom right` avec la courbe `cubic-bezier(0.16, 1, 0.3, 1)` en `180ms` depuis une opacité déjà pleine.
- **Do** teinter dynamiquement chaque variateur de lumière allumée avec sa couleur Kelvin ou RVB réelle tout en maintenant les lampes éteintes en gris-ardoise neutre (`#525b6c`).
- **Do** habiller tous les éléments natifs du navigateur (`<select>`, `<input type="range">`, barres de défilement, sélection de texte) aux couleurs du système.

### Don't:
- **Don't** ajouter de sur-titres en petites capitales (*kickers* / *eyebrows*), de paragraphes d'introduction ou de sous-titres descriptifs sous les en-têtes.
- **Don't** imbriquer des cartes dans d'autres cartes à l'intérieur des sections du Flyout.
- **Don't** animer les propriétés de mise en page (`width`, `height`, `border-width`, `padding`) ni appliquer d'effet d'échelle au survol des images de pochettes (`<img>`).
- **Don't** intégrer d'URL privée, de jeton Home Assistant ou d'identifiant d'entité personnel en dur dans les composants.
