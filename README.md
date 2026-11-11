# MyHomeAssistant

Compagnon Home Assistant léger pour **Windows 10/11**, conçu avec **Tauri v2 (Rust + WebView2)** et une interface inspirée des **Quick Settings & Media Flyout Windows 11**.

## Fonctionnalités

- **Mini-pilule flottante adaptative** :
  - Positionnée initialement en bas à droite au-dessus de l'horloge système (`SPI_GETWORKAREA`), **déplaçable librement** sur n'importe quel écran avec sauvegarde automatique de la position.
  - Affiche en mode compact la pochette et les contrôles `Play/Pause` + `Suivant` lorsqu'un lecteur Home Assistant joue, ou jusqu'à **3 raccourcis favoris** le reste du temps.
  - **Sans vol de focus (`WS_EX_NOACTIVATE`)** : cliquer sur un contrôle ne fait pas perdre le focus à votre logiciel actif, et les jeux plein écran ou notifications Windows recouvrent naturellement la pilule.
- **Panneau Flyout déployable en 1 clic** :
  - **Musique & Volume** : transport complet, sélection de l'enceinte `media_player` et de la source, contrôle du volume au slider ou à la molette souris.
  - **Lumières** : bascule On/Off, intensité lumineuse, température Kelvin (`2200K–6500K`) et présélections RVB en temps réel via WebSocket (`/api/websocket`).
  - **Scènes & Scripts** : tuiles d'activation instantanée en 1 clic.
- **Touches Multimédias & `Ctrl + Volume` intelligents** :
  - Les touches multimédias physiques (`Play/Pause`, `Suivant`, `Précédent`) ne pilotent Home Assistant **que lorsqu'aucun média ne tourne sur le PC** (détection WinRT SMTC + Core Audio Peak Meter, avec délai de priorité intelligent si un média PC vient tout juste d'être mis en pause).
  - `Ctrl + Volume +/- / Mute` règle exclusivement le volume Home Assistant sans modifier le volume Windows local.
- **Zéro secret embarqué** :
  - Aucune URL, aucun jeton ni aucune entité personnelle n'est présent dans le code source.
  - Le *Long-Lived Access Token* saisi dans **Paramètres → Serveur** est chiffré localement dans le **Gestionnaire d'identifiants Windows** (*Windows Credential Manager*).
- **Mises à jour automatiques** :
  - Chaque push sur `main` compile, incrémente la version et publie une release signée sur GitHub Releases ; l'application installée vérifie et installe les nouveautés automatiquement en tâche de fond.

## Développement local

```bash
npm install
npm run dev      # Aperçu Web sur http://127.0.0.1:1420
npx tauri dev    # Exécution native Tauri (Windows)
```

## Activer les mises à jour automatiques sur GitHub

1. Dans les paramètres du dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**.
2. Créez le secret `TAURI_SIGNING_PRIVATE_KEY` contenant la clé privée correspondant à `plugins.updater.pubkey` dans [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json).
3. Chaque déploiement sur la branche `main` déclenchera `.github/workflows/build-windows.yml` et publiera automatiquement l'installateur `.exe` ainsi que `latest.json`.
