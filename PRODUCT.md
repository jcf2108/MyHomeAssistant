# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Tauri v2 (Rust backend + Win32/WinRT native hooks) + React + TypeScript + Vite + Tailwind CSS, distribué en dépôt public GitHub avec compilation et publication automatiques via GitHub Actions (`tauri-plugin-updater`).

## Users

- **Utilisateurs de Home Assistant sur PC Windows** souhaitant piloter instantanément leur maison connectée (musique, volume, lumières, scènes) sans ouvrir un onglet navigateur ni perdre le focus de leur activité en cours.
- **Communauté Home Assistant** installant l'application depuis le dépôt public et renseignant sa propre instance locale ou distante dans les paramètres.

## Product Purpose

`MyHomeAssistant` est un compagnon desktop Windows léger et moderne pour Home Assistant, conçu autour d'une mini-pilule flottante adaptative toujours accessible (initialement au-dessus de l'horloge système, déplaçable librement à l'écran) qui se déploie en un clic en panneau de contrôle domotique temps réel, doublé d'un routage intelligent des touches multimédias et du volume clavier.

## Positioning

Contrairement aux agents Windows orientés télémétrie PC à l'interface datée ou aux wrappers Electron lourds affichant un tableau de bord Lovelace complet :
1. **Format hybride Mini-Pilule adaptative + Panneau déployé (Flyout)** : affiche un mini-lecteur (pochette, Play/Pause, Suivant) lorsqu'un média Home Assistant est actif, ou des raccourcis favoris épurés le reste du temps, et s'ouvre en un clic.
2. **Arbitrage clavier intelligent PC / Maison** : les touches multimédias pilotent Home Assistant uniquement lorsqu'aucun média ne tourne sur le PC (avec priorité intelligente pour laisser `Play/Pause` relancer un média PC tout juste mis en pause), et `Ctrl + Volume` pilote directement le volume Home Assistant.
3. **Architecture zéro secret embarqué & auto-update transparent** : dépôt public propre sans URL, token ni entité codés en dur ; jeton d'accès stocké dans le Gestionnaire d'identifiants Windows (*Windows Credential Manager*) et mises à jour automatiques signées à chaque déploiement.

## Operating Context

- Résident permanent sur Windows 10/11 en surimpression des fenêtres applicatives classiques (navigateurs, bureautique, IDE) via `Always-on-Top` standard, déplaçable librement sur l'écran avec mémorisation de position.
- Coexistence naturelle avec les jeux plein écran et les notifications Windows (qui peuvent recouvrir la pilule sans gêne).
- Connexion permanente à faible empreinte via l'API WebSocket officielle de Home Assistant (`/api/websocket`).

## Capabilities and Constraints

- **Mini-pilule repliée (Adaptative)** :
  - Si un `media_player` Home Assistant sélectionné est actif : pochette, contrôles `Play/Pause` et `Suivant`, accès rapide au déploiement.
  - Sinon : 2 à 3 icônes de favoris épinglés + bouton de déploiement.
  - Déplacement libre à la souris sur tout l'écran (position sauvegardée localement, ancrage initial en bas à droite au-dessus de l'horloge).
- **Panneau déployé (v1)** :
  - **Musique & Volume** : Play/Pause, Précédent/Suivant, barre/slider de volume, sélection de l'enceinte ou lecteur `media_player` cible.
  - **Lumières** : bascule On/Off, réglage direct de la luminosité et de la couleur / température de couleur.
  - **Scènes & Scripts** : tuiles compactes d'activation en 1 clic.
  - **Paramètres intégrés** : saisie de l'URL Home Assistant, enregistrement sécurisé du Long-Lived Access Token, sélection/favoris des entités découvertes via WebSocket, démarrage avec Windows, vérification/installation des mises à jour.
- **Touches Multimédias & Volume** :
  - Touches média (`Play/Pause`, `Next`, `Prev`) routées vers Home Assistant uniquement si aucun média n'est en lecture sur le PC, avec mémoire courte lorsqu'un média local du PC vient tout juste d'être mis en pause afin qu'un nouvel appui relance le PC.
  - Volume Home Assistant piloté via le modificateur `Ctrl + Volume +/- / Mute` (et molette souris sur le widget).
- **Sécurité & Réseau** :
  - Aucun token d'accès, URL privée ni ID d'entité personnel intégré dans le code source ou le dépôt public.
  - Serveur de développement local lié exclusivement à `127.0.0.1` (jamais `0.0.0.0`).
- **Ergonomie & Texte (Contrainte permanente)** :
  - Zéro surcharge textuelle dans l'interface : bannir les paragraphes d'explication, sous-titres redondants et libellés longs ; privilégier des mots-clés courts (1 à 3 mots), des icônes nettes et des badges synthétiques.

## Brand Commitments

- **Nom du projet** : `MyHomeAssistant`
- **Langue de l'interface** : Français (concis, synthétique, 1 à 3 mots par libellé).
- **Référence de finition native** : S'aligner sur le niveau d'exécution des **Windows 11 Quick Settings & Media Flyout natif** (surfaces sombres de type Mica/Acrylic, coins arrondis nets de 8 à 12px, filets lumineux subtils d'élévation Windows 11, sliders fluides à retour immédiat).

## Evidence on Hand

- Dépôt greenfield `/home/ubuntu/GitHub/MyHomeAssistant` destiné à être publié en dépôt GitHub public.
- Aucune donnée d'instance Home Assistant pré-remplie : les états de démonstration/aperçu hors connexion doivent être clairement isolés du stockage réel utilisateur.

## Product Principles

1. **Action en une seconde, zéro texte superflu** : chaque contrôle (lecture, volume, lumière, scène) se lit par son icône, son état lumineux et un libellé de 1 à 3 mots maximum.
2. **Présence discrète, obéissance au contexte PC** : le compagnon reste visible au-dessus des logiciels de travail, se déplace d'un geste quand il gêne, et ne détourne jamais les touches média d'une lecture locale active sur le PC.
3. **Zéro configuration codée en dur** : tout utilisateur qui installe l'exécutable connecte son propre serveur Home Assistant et choisit ses propres entités depuis l'interface, avec stockage chiffré du jeton sur Windows.
4. **Déploiement continu sans friction** : chaque version publiée met à jour automatiquement les postes installés sans réinstallation manuelle ni perte de paramètres.
