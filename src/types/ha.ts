export type HaConnectionStatus =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'auth_error'
  | 'disconnected';

export type SupportedDomain =
  | 'media_player'
  | 'light'
  | 'switch'
  | 'scene'
  | 'script'
  | 'button'
  | 'input_button'
  | 'input_boolean'
  | 'cover'
  | 'climate'
  | 'fan'
  | 'lock'
  | 'sensor'
  | 'binary_sensor'
  | 'select'
  | 'input_select'
  | 'number'
  | 'input_number'
  | 'weather';

export interface HaEntityAttributes {
  friendly_name?: string;
  icon?: string;
  device_class?: string;
  unit_of_measurement?: string;
  // media_player
  media_title?: string;
  media_artist?: string;
  media_album_name?: string;
  entity_picture?: string;
  volume_level?: number;
  is_volume_muted?: boolean;
  source?: string;
  source_list?: string[];
  sound_mode?: string;
  supported_features?: number;
  // light
  brightness?: number; // 0..255
  color_temp_kelvin?: number;
  min_color_temp_kelvin?: number;
  max_color_temp_kelvin?: number;
  rgb_color?: [number, number, number];
  supported_color_modes?: string[];
  color_mode?: string;
  // cover
  current_position?: number;
  // climate
  temperature?: number;
  current_temperature?: number;
  min_temp?: number;
  max_temp?: number;
  target_temp_step?: number;
  hvac_modes?: string[];
  hvac_action?: string;
  // fan
  percentage?: number;
  // select / input_select
  options?: string[];
  // number / input_number
  min?: number;
  max?: number;
  step?: number;
  [key: string]: unknown;
}

export interface HaEntity {
  entity_id: string;
  state: string;
  attributes: HaEntityAttributes;
  last_changed?: string;
  last_updated?: string;
}

export interface LovelaceFeatureConfig {
  type: string;
  [key: string]: unknown;
}

export interface LovelaceCondition {
  condition?: string;
  entity?: string;
  state?: string | string[];
  state_not?: string | string[];
}

export interface LovelaceBadgeItem {
  type?: string;
  entity?: string;
  name?: string;
  icon?: string;
}

export interface LovelaceCardConfig {
  type?: string;
  entity?: string;
  entities?: Array<string | { entity: string; name?: string; icon?: string }>;
  name?: string;
  title?: string;
  heading?: string;
  heading_style?: 'title' | 'subtitle';
  icon?: string;
  color?: string;
  vertical?: boolean;
  show_entity_picture?: boolean;
  features?: LovelaceFeatureConfig[];
  cards?: LovelaceCardConfig[];
  conditions?: LovelaceCondition[];
  card?: LovelaceCardConfig;
  badges?: Array<string | LovelaceBadgeItem>;
  columns?: number;
  grid_options?: {
    columns?: number | 'full';
    rows?: number | 'auto';
  };
  layout_options?: {
    grid_columns?: number | 'full';
  };
  [key: string]: unknown;
}

export interface LovelaceSectionConfig {
  type?: string;
  title?: string;
  cards?: LovelaceCardConfig[];
  column_span?: number;
}

export interface LovelaceViewConfig {
  title?: string;
  path?: string;
  icon?: string;
  type?: string;
  subview?: boolean;
  badges?: Array<string | LovelaceBadgeItem>;
  sections?: LovelaceSectionConfig[];
  cards?: LovelaceCardConfig[];
}

export interface LovelaceConfig {
  title?: string;
  views: LovelaceViewConfig[];
}

export interface LovelaceDashboardInfo {
  id: string;
  url_path: string | null;
  title: string;
  icon?: string;
  show_in_sidebar?: boolean;
}

export interface HaAreaEntry {
  area_id: string;
  name: string;
  icon?: string | null;
}

export interface HaEntityRegistryEntry {
  entity_id: string;
  area_id?: string | null;
  device_id?: string | null;
  hidden_by?: string | null;
  disabled_by?: string | null;
  entity_category?: string | null;
  name?: string | null;
  original_name?: string | null;
  icon?: string | null;
}

export interface HaDeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
}

export interface HaOverviewMetadata {
  lovelaceConfig: LovelaceConfig | null;
  dashboards: LovelaceDashboardInfo[];
  areas: HaAreaEntry[];
  entityRegistry: Record<string, HaEntityRegistryEntry>;
  deviceRegistry: Record<string, HaDeviceRegistryEntry>;
}

export interface AppSettings {
  haUrl: string;
  /** 'auto' (Ampli actif > Télé active > Lecteur actif) ou entity_id explicite */
  volumeTargetMode: string;
  activeMediaPlayerId: string;
  selectedDashboardPath: string | null;
  selectedViewIndex: number;
  enabledMediaPlayers: string[];
  enabledLights: string[];
  enabledScenes: string[];
  pillFavorites: string[]; // jusqu'à 3 entity_ids sur la mini-pilule
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

export interface VolumeFeedbackBadge {
  targetLabel: string;
  valueLabel: string;
  pct: number | null;
}
