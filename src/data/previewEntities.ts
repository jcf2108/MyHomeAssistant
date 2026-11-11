import type { HaEntity, LovelaceConfig } from '../types/ha';

const COVER_MIDNIGHT_CITY =
  'data:image/svg+xml;utf8,' +
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

/**
 * Données synthétiques d'aperçu hors connexion (aucune instance réelle ni jeton).
 */
export const PREVIEW_ENTITIES: Record<string, HaEntity> = {
  'media_player.ampli_salon': {
    entity_id: 'media_player.ampli_salon',
    state: 'playing',
    attributes: {
      friendly_name: 'Ampli Salon',
      device_class: 'receiver',
      icon: 'mdi:audio-video',
      media_title: 'Midnight City',
      media_artist: 'M83',
      entity_picture: COVER_MIDNIGHT_CITY,
      volume_level: 0.42,
      is_volume_muted: false,
      source: 'TV eARC',
      source_list: ['TV eARC', 'Spotify', 'Vinyle'],
      supported_features: 19469,
    },
  },
  'media_player.tele_salon': {
    entity_id: 'media_player.tele_salon',
    state: 'on',
    attributes: {
      friendly_name: 'Télé Salon',
      device_class: 'tv',
      icon: 'mdi:television',
      source: 'HDMI 1',
      source_list: ['HDMI 1', 'Netflix', 'YouTube'],
      is_volume_muted: false,
      supported_features: 3468,
    },
  },
  'light.suspension_salon': {
    entity_id: 'light.suspension_salon',
    state: 'on',
    attributes: {
      friendly_name: 'Suspension',
      icon: 'mdi:ceiling-light',
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
      icon: 'mdi:desk-lamp',
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
      friendly_name: 'Bandeau TV',
      icon: 'mdi:led-strip-variant',
      brightness: 140,
      color_temp_kelvin: 2700,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
      supported_color_modes: ['rgb'],
      color_mode: 'rgb',
      rgb_color: [96, 165, 250],
    },
  },
  'switch.machine_cafe': {
    entity_id: 'switch.machine_cafe',
    state: 'off',
    attributes: {
      friendly_name: 'Prise TV',
      device_class: 'outlet',
      icon: 'mdi:power-plug',
    },
  },
  'cover.volet_salon': {
    entity_id: 'cover.volet_salon',
    state: 'open',
    attributes: {
      friendly_name: 'Volet Salon',
      icon: 'mdi:window-shutter',
      current_position: 75,
    },
  },
  'climate.thermostat_salon': {
    entity_id: 'climate.thermostat_salon',
    state: 'heat',
    attributes: {
      friendly_name: 'Chauffage',
      current_temperature: 20.5,
      temperature: 21,
      min_temp: 16,
      max_temp: 25,
      target_temp_step: 0.5,
      hvac_modes: ['off', 'heat', 'auto'],
    },
  },
  'scene.ambiance_cinema': {
    entity_id: 'scene.ambiance_cinema',
    state: 'scène',
    attributes: {
      friendly_name: 'Cinéma',
      icon: 'mdi:movie-open',
    },
  },
  'script.extinction_totale': {
    entity_id: 'script.extinction_totale',
    state: 'off',
    attributes: {
      friendly_name: 'Nuit',
      icon: 'mdi:weather-night',
    },
  },
};

export const PREVIEW_LOVELACE_CONFIG: LovelaceConfig = {
  title: 'Aperçu',
  views: [
    {
      title: 'Aperçu',
      path: 'default_view',
      type: 'sections',
      sections: [
        {
          type: 'grid',
          cards: [
            { type: 'heading', heading: 'Salon' },
            {
              type: 'tile',
              entity: 'light.suspension_salon',
              features: [{ type: 'light-brightness' }],
            },
            { type: 'tile', entity: 'light.lampe_bureau' },
            { type: 'tile', entity: 'light.bandeau_tv' },
            { type: 'tile', entity: 'switch.machine_cafe' },
            { type: 'tile', entity: 'cover.volet_salon' },
            { type: 'tile', entity: 'climate.thermostat_salon' },
          ],
        },
        {
          type: 'grid',
          cards: [
            { type: 'heading', heading: 'Scènes & Multimédia' },
            { type: 'tile', entity: 'scene.ambiance_cinema' },
            { type: 'tile', entity: 'script.extinction_totale' },
            { type: 'tile', entity: 'media_player.ampli_salon' },
            { type: 'tile', entity: 'media_player.tele_salon' },
          ],
        },
      ],
    },
  ],
};
