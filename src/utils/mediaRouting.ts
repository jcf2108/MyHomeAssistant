import type { HaEntity } from '../types/ha';

// Bitmask officiel Home Assistant MediaPlayerEntityFeature
export const HA_MEDIA_SUPPORT_PAUSE = 1;
export const HA_MEDIA_SUPPORT_VOLUME_SET = 4;
export const HA_MEDIA_SUPPORT_VOLUME_MUTE = 8;
export const HA_MEDIA_SUPPORT_PREVIOUS_TRACK = 16;
export const HA_MEDIA_SUPPORT_NEXT_TRACK = 32;
export const HA_MEDIA_SUPPORT_TURN_ON = 128;
export const HA_MEDIA_SUPPORT_TURN_OFF = 256;
export const HA_MEDIA_SUPPORT_VOLUME_STEP = 1024;
export const HA_MEDIA_SUPPORT_SELECT_SOURCE = 2048;
export const HA_MEDIA_SUPPORT_STOP = 4096;
export const HA_MEDIA_SUPPORT_PLAY = 16384;

export type AudioDeviceRole = 'amp' | 'tv' | 'speaker' | 'source';

const AMP_PATTERN =
  /ampli|avr|denon|marantz|yamaha|onkyo|pioneer|nad\b|arcam|anthem|home[\s_-]?cinema|barre[\s_-]?de[\s_-]?son|soundbar|receiver|sonos[\s_-]?arc|sonos[\s_-]?beam/i;

const TV_PATTERN =
  /\btv\b|télé|tele\b|oled|qled|bravia|webos|tizen|samsung|lg[\s_-]|philips|panasonic|hisense|tcl\b|android[\s_-]?tv|google[\s_-]?tv/i;

const SPEAKER_PATTERN =
  /sonos|enceinte|speaker|homepod|nest[\s_-]?(audio|mini|hub)|echo\b|symfonisk|bose|kef|devialet/i;

export function classifyAudioRole(entity: HaEntity): AudioDeviceRole {
  const dc = String(entity.attributes.device_class || '').toLowerCase();
  const icon = String(entity.attributes.icon || '').toLowerCase();
  const haystack = `${entity.entity_id} ${entity.attributes.friendly_name || ''}`;

  if (
    dc === 'receiver' ||
    icon.includes('amplifier') ||
    icon.includes('audio-video') ||
    AMP_PATTERN.test(haystack)
  ) {
    return 'amp';
  }

  if (dc === 'tv' || icon.includes('television') || TV_PATTERN.test(haystack)) {
    return 'tv';
  }

  if (dc === 'speaker' || icon.includes('speaker') || SPEAKER_PATTERN.test(haystack)) {
    return 'speaker';
  }

  return 'source';
}

export function isMediaEntityPoweredOn(entity: HaEntity): boolean {
  const s = entity.state.toLowerCase();
  return s !== 'off' && s !== 'standby' && s !== 'unavailable' && s !== 'unknown';
}

export function supportsVolumeSet(entity: HaEntity): boolean {
  const f = entity.attributes.supported_features;
  if (typeof f === 'number') {
    return (f & HA_MEDIA_SUPPORT_VOLUME_SET) !== 0;
  }
  return typeof entity.attributes.volume_level === 'number';
}

export function supportsVolumeStep(entity: HaEntity): boolean {
  const f = entity.attributes.supported_features;
  if (typeof f === 'number') {
    return (f & HA_MEDIA_SUPPORT_VOLUME_STEP) !== 0;
  }
  return false;
}

export function supportsVolumeMute(entity: HaEntity): boolean {
  const f = entity.attributes.supported_features;
  if (typeof f === 'number') {
    return (f & HA_MEDIA_SUPPORT_VOLUME_MUTE) !== 0;
  }
  return typeof entity.attributes.is_volume_muted === 'boolean';
}

export function canControlEntityVolume(entity: HaEntity): boolean {
  const f = entity.attributes.supported_features;
  if (typeof f === 'number') {
    return (f & (HA_MEDIA_SUPPORT_VOLUME_SET | HA_MEDIA_SUPPORT_VOLUME_STEP)) !== 0;
  }
  return typeof entity.attributes.volume_level === 'number';
}

/**
 * Ordonne les media_players en privilégiant ceux présents dans l'Aperçu Lovelace de l'utilisateur.
 */
function sortByOverviewPriority(
  players: HaEntity[],
  overviewEntitySet: Set<string>,
): HaEntity[] {
  return [...players].sort((a, b) => {
    const aIn = overviewEntitySet.has(a.entity_id) ? 0 : 1;
    const bIn = overviewEntitySet.has(b.entity_id) ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return (a.attributes.friendly_name || a.entity_id).localeCompare(
      b.attributes.friendly_name || b.entity_id,
    );
  });
}

/**
 * Résout intelligemment la sortie matérielle qui diffuse réellement le son (ex: Ampli vs Télé) :
 * 1. Si l'utilisateur a verrouillé une sortie explicite -> cette entité.
 * 2. En mode 'auto' :
 *    a) Si un Ampli / Barre de son est allumé (on / playing / idle / paused) -> l'Ampli a la priorité
 *       (car dans un salon TV + Ampli ARC/eARC/Optique, quand l'ampli est allumé c'est lui qui gère le son).
 *    b) Sinon, un lecteur matériel (TV / Enceinte / Ampli) en cours de lecture ('playing') avec contrôle de volume.
 *    c) Sinon, une Télé allumée ('on' / 'idle' / 'paused' — cas classique TNT / HDMI / Box où la TV est 'on').
 *    d) Sinon, tout lecteur en 'playing' supportant le volume, puis le premier appareil compatible volume.
 */
export function resolveVolumeTarget(
  allPlayers: HaEntity[],
  overviewEntityIds: string[],
  volumeTargetMode: string,
): HaEntity | null {
  if (allPlayers.length === 0) return null;

  if (volumeTargetMode && volumeTargetMode !== 'auto') {
    const explicit = allPlayers.find((p) => p.entity_id === volumeTargetMode);
    if (explicit) return explicit;
  }

  const overviewSet = new Set(overviewEntityIds);
  const ordered = sortByOverviewPriority(allPlayers, overviewSet);
  const volumeCapable = ordered.filter(canControlEntityVolume);
  const pool = volumeCapable.length > 0 ? volumeCapable : ordered;

  // 1. Ampli / Receiver allumé
  const activeAmp = pool.find(
    (p) => classifyAudioRole(p) === 'amp' && isMediaEntityPoweredOn(p),
  );
  if (activeAmp) return activeAmp;

  // 2. TV ou Enceinte actuellement en 'playing'
  const playingHardware = pool.find(
    (p) =>
      p.state === 'playing' &&
      (classifyAudioRole(p) === 'tv' || classifyAudioRole(p) === 'speaker'),
  );
  if (playingHardware) return playingHardware;

  // 3. Télé allumée (même si son état HA est 'on' ou 'idle' pendant une diffusion HDMI/Box)
  const activeTv = pool.find(
    (p) => classifyAudioRole(p) === 'tv' && isMediaEntityPoweredOn(p),
  );
  if (activeTv) return activeTv;

  // 4. Tout media_player en 'playing' supportant le volume
  const anyPlaying = pool.find((p) => p.state === 'playing');
  if (anyPlaying) return anyPlaying;

  // 5. Toute enceinte active ('on' / 'idle' / 'paused')
  const activeSpeaker = pool.find(
    (p) => classifyAudioRole(p) === 'speaker' && isMediaEntityPoweredOn(p),
  );
  if (activeSpeaker) return activeSpeaker;

  // 6. Tout appareil actuellement allumé
  const anyOn = pool.find(isMediaEntityPoweredOn);
  if (anyOn) return anyOn;

  return pool[0] || null;
}

/**
 * Résout le lecteur cible pour Play/Pause/Suivant/Précédent :
 * Privilégie l'appareil en cours de lecture ('playing'), puis 'paused', puis le choix utilisateur.
 */
export function resolvePlaybackTarget(
  allPlayers: HaEntity[],
  overviewEntityIds: string[],
  preferredPlayerId: string,
): HaEntity | null {
  if (allPlayers.length === 0) return null;
  const overviewSet = new Set(overviewEntityIds);
  const ordered = sortByOverviewPriority(allPlayers, overviewSet);

  const playing = ordered.find((p) => p.state === 'playing');
  if (playing) return playing;

  if (preferredPlayerId) {
    const preferred = ordered.find(
      (p) => p.entity_id === preferredPlayerId && isMediaEntityPoweredOn(p),
    );
    if (preferred) return preferred;
  }

  const paused = ordered.find((p) => p.state === 'paused');
  if (paused) return paused;

  const powered = ordered.find(isMediaEntityPoweredOn);
  if (powered) return powered;

  return ordered[0] || null;
}
