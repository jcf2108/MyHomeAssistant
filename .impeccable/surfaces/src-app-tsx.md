---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["index.html","src/index.css"]
---

# Surface Brief — MyHomeAssistant (`src/App.tsx`)

## Scope and Mode
- **Surface** : Interface compagnon Windows 11 hybride Mini-Pilule flottante adaptative et Panneau Flyout déployé (`src/App.tsx`, `index.html`, `src/index.css`), incluant la vue Paramètres de connexion Home Assistant, de sélection d'entités et de mise à jour automatique.
- **Mode** : `operate`

## Audience, Job, and Task
- **Audience** : Utilisateur Home Assistant sous Windows pilotant sa maison (musique, volume, lumières, scènes) en tâche de fond sans quitter son travail ni alourdir l'écran.
- **Job** : Visualiser et contrôler le média actif (pochette, lecture, piste, enceinte `media_player`, volume molette/`Ctrl+Volume`), ajuster la luminosité et la température/couleur des lumières, déclencher des scènes en 1 clic, et configurer son serveur/jeton localement.
- **Signature Interaction** : Déploiement fluide (180 ms `cubic-bezier(0.16, 1, 0.3, 1)`) entre la Mini-Pilule adaptative déplaçable librement (pochette + Play/Pause/Suivant ou favoris rapides + volume à la molette) et le Flyout Windows 11 Quick Settings, doublé de sliders continus à retour chromatique immédiat.

## Direction contract

THESIS: MyHomeAssistant s'intègre à Windows 11 comme un véritable Quick Settings & Media Flyout natif en surface Mica/Acrylic anthracite, refusant les tableaux de bord Lovelace surchargés de cartes imbriquées et tout paragraphe d'explication superflu.

OWN-WORLD: Châssis Mica/Acrylic sombre (`#1c1e24`) rehaussé de pistes de contrôle affleurantes (`#262a33`), filet périphérique spéculaire Windows 11 de 1px (`rgba(255, 255, 255, 0.08)`), typographie `Segoe UI Variable` / sans-serif système à chiffres tabulaires (`#f3f5f8` primaire, `#a9b2c0` secondaire), accent bleu Fluent (`#60a5fa`) pour les contrôles actifs et le volume, et teintes physiques chaudes/RVB (`#fbbf24` à `#38bdf8`) réservées à l'état réel des lampes allumées.

STORY: D'un coup d'œil en bas à droite (ou à l'emplacement choisi), l'utilisateur voit la piste en cours ou ses favoris ; d'un coup de molette ou de `Ctrl + Volume`, il ajuste le son du salon ; d'un clic, il déplie le Flyout pour changer d'enceinte, doser une lumière en Kelvin/couleur ou lancer une scène, en moins d'une seconde et sans texte parasite.

FIRST VIEWPORT: En mode replié, une pilule horizontale compacte à poignée de déplacement libre affichant soit la miniature d'album, le titre court (1–3 mots), `Play/Pause`, `Suivant` et la jauge de volume au survol/molette, soit 3 actions favorites rapides et le bouton d'ouverture. En mode déployé (360px de large), le bloc Media Flyout supérieur (pochette, transport, sélecteur `media_player`, slider volume), suivi des pistes Lumières (bascule, slider intensité et pastilles Kelvin/couleur inline) et de la grille de tuiles Scènes 1-clic, coiffés d'une barre de pied sobre donnant accès aux Paramètres et à l'état WebSocket/MAJ.

FORM: Canon — Flyout Windows 11 Fluent (Quick Settings & Media Flyout natif), seed key `0cfc688b` (code-led).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
