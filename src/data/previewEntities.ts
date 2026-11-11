import type { HaEntity } from '../types/ha';

const COVER_MIDNIGHT_CITY =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#17153B"/>
          <stop offset="55%" stop-color="#2E236C"/>
          <stop offset="100%" stop-color="#C84B31"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" fill="url(#sky)"/>
      <circle cx="66" cy="32" r="16" fill="#FBBF24" fill-opacity="0.92"/>
      <path d="M0 68 L22 50 L40 62 L62 42 L96 66 L96 96 L0 96 Z" fill="#121420"/>
      <rect x="14" y="64" width="6" height="32" fill="#1E2235"/>
      <rect x="26" y="56" width="8" height="40" fill="#252B42"/>
      <rect x="42" y="60" width="7" height="36" fill="#1E2235"/>
      <rect x="56" y="52" width="9" height="44" fill="#252B42"/>
      <rect x="72" y="62" width="7" height="34" fill="#1E2235"/>
    </svg>`,
  );

const COVER_VERIDIS_QUO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" fill="#14161D"/>
      <circle cx="48" cy="48" r="34" fill="#1F2430" stroke="#60A5FA" stroke-width="3"/>
      <circle cx="48" cy="48" r="22" fill="none" stroke="#FBBF24" stroke-width="2" stroke-opacity="0.75"/>
      <circle cx="48" cy="48" r="9" fill="#60A5FA"/>
      <circle cx="48" cy="48" r="3" fill="#0E1015"/>
    </svg>`,
  );

/**
 * Données synthétiques d'aperçu hors connexion (aucune instance réelle ni jeton).
 * Utilisées uniquement lorsque l'utilisateur active le mode Aperçu avant de lier son serveur.
 */
export const PREVIEW_ENTITIES: Record<string, HaEntity> = {
  'media_player.salon_sonos': {
    entity_id: 'media_player.salon_sonos',
    state: 'playing',
    attributes: {
      friendly_name: 'Salon',
      media_title: 'Midnight City',
      media_artist: 'M83',
      entity_picture: COVER_MIDNIGHT_CITY,
      volume_level: 0.42,
      is_volume_muted: false,
      source: 'Music Assistant',
      source_list: ['Music Assistant', 'Spotify', 'TV Optique'],
    },
  },
  'media_player.bureau_enceinte': {
    entity_id: 'media_player.bureau_enceinte',
    state: 'paused',
    attributes: {
      friendly_name: 'Bureau',
      media_title: 'Veridis Quo',
      media_artist: 'Daft Punk',
      entity_picture: COVER_VERIDIS_QUO,
      volume_level: 0.28,
      is_volume_muted: false,
      source: 'Spotify',
      source_list: ['Spotify', 'Radio'],
    },
  },
  'light.suspension_salon': {
    entity_id: 'light.suspension_salon',
    state: 'on',
    attributes: {
      friendly_name: 'Salon',
      brightness: 194,
      color_temp_kelvin: 3100,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
      supported_color_modes: ['color_temp', 'rgb'],
      color_mode: 'color_temp',
      rgb_color: [251, 191, 36],
    },
  },
  'light.lampe_bureau': {
    entity_id: 'light.lampe_bureau',
    state: 'on',
    attributes: {
      friendly_name: 'Bureau',
      brightness: 230,
      color_temp_kelvin: 4600,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
      supported_color_modes: ['color_temp', 'rgb'],
      color_mode: 'rgb',
      rgb_color: [125, 211, 252],
    },
  },
  'light.bandeau_tv': {
    entity_id: 'light.bandeau_tv',
    state: 'off',
    attributes: {
      friendly_name: 'TV',
      brightness: 140,
      color_temp_kelvin: 2700,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
      supported_color_modes: ['rgb'],
      color_mode: 'rgb',
      rgb_color: [168, 85, 247],
    },
  },
  'light.cuisine_plan': {
    entity_id: 'light.cuisine_plan',
    state: 'off',
    attributes: {
      friendly_name: 'Cuisine',
      brightness: 204,
      color_temp_kelvin: 4000,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
      supported_color_modes: ['color_temp'],
      color_mode: 'color_temp',
    },
  },
  'scene.ambiance_cinema': {
    entity_id: 'scene.ambiance_cinema',
    state: 'scène',
    attributes: {
      friendly_name: 'Cinéma',
    },
  },
  'scene.concentration': {
    entity_id: 'scene.concentration',
    state: 'scène',
    attributes: {
      friendly_name: 'Focus',
    },
  },
  'scene.soiree_tamisee': {
    entity_id: 'scene.soiree_tamisee',
    state: 'scène',
    attributes: {
      friendly_name: 'Soirée',
    },
  },
  'script.extinction_totale': {
    entity_id: 'script.extinction_totale',
    state: 'off',
    attributes: {
      friendly_name: 'Nuit',
    },
  },
};
