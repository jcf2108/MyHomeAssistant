export type HaConnectionStatus =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'auth_error'
  | 'disconnected';

export type SupportedDomain = 'media_player' | 'light' | 'scene' | 'script';

export interface HaEntityAttributes {
  friendly_name?: string;
  icon?: string;
  // media_player
  media_title?: string;
  media_artist?: string;
  media_album_name?: string;
  entity_picture?: string;
  volume_level?: number;
  is_volume_muted?: boolean;
  source?: string;
  source_list?: string[];
  supported_features?: number;
  // light
  brightness?: number; // 0..255
  color_temp_kelvin?: number;
  min_color_temp_kelvin?: number;
  max_color_temp_kelvin?: number;
  rgb_color?: [number, number, number];
  supported_color_modes?: string[];
  color_mode?: string;
  [key: string]: unknown;
}

export interface HaEntity {
  entity_id: string;
  state: string;
  attributes: HaEntityAttributes;
  last_changed?: string;
  last_updated?: string;
}

export interface AppSettings {
  haUrl: string;
  activeMediaPlayerId: string;
  enabledMediaPlayers: string[];
  enabledLights: string[];
  enabledScenes: string[];
  pillFavorites: string[]; // up to 3 entity_ids shown on collapsed pill when idle
  pcMediaGraceSeconds: number;
  volumeStepPct: number;
  autoCheckUpdates: boolean;
  previewMode: boolean;
}

export type NativeKeyCommand =
  | 'play_pause'
  | 'next'
  | 'previous'
  | 'stop'
  | 'volume_up'
  | 'volume_down'
  | 'volume_mute';

export type TrayAction = 'toggle_expand' | 'open_settings' | 'reset_position';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  version?: string;
  installing: boolean;
  error?: string;
}
