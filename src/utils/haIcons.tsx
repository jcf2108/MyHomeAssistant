import React from 'react';
import {
  Activity,
  ArrowUpDown,
  BatteryCharging,
  Blinds,
  Bot,
  Camera,
  CloudSun,
  Disc3,
  DoorClosed,
  DoorOpen,
  Droplets,
  Fan,
  Film,
  Flame,
  Gauge,
  Home,
  Image,
  Lamp,
  Lightbulb,
  Lock,
  LockOpen,
  Moon,
  Music,
  Play,
  Plug,
  Power,
  Radio,
  ShieldCheck,
  Sliders,
  Snowflake,
  Sofa,
  Sparkles,
  Speaker,
  Sun,
  Thermometer,
  ToggleLeft,
  ToggleRight,
  Tv,
  User,
  Volume2,
  Wifi,
  Zap,
} from 'lucide-react';
import type { HaEntity } from '../types/ha';
import { getLightVisualColor } from './color';

export function renderHaEntityIcon(
  entity: HaEntity | undefined,
  customIcon?: string,
  className = 'h-4 w-4',
): React.ReactNode {
  const iconStr = (customIcon || entity?.attributes.icon || '').toLowerCase();
  const domain = entity ? entity.entity_id.split('.')[0] : '';
  const dc = String(entity?.attributes.device_class || '').toLowerCase();
  const state = (entity?.state || '').toLowerCase();

  // 1. Correspondances explicites d'icônes Material Design (mdi:*) courantes dans Home Assistant
  if (iconStr) {
    if (iconStr.includes('television') || iconStr.includes('mdi:tv') || iconStr.includes('monitor')) {
      return <Tv className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('amplifier') || iconStr.includes('audio-video') || iconStr.includes('receiver')) {
      return <Radio className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('speaker') || iconStr.includes('cast-audio') || iconStr.includes('soundbar')) {
      return <Speaker className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('music') || iconStr.includes('spotify')) {
      return <Music className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('movie') || iconStr.includes('theater') || iconStr.includes('cinema') || iconStr.includes('filmstrip')) {
      return <Film className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('lamp') || iconStr.includes('chandelier') || iconStr.includes('ceiling-light') || iconStr.includes('floor-lamp')) {
      return <Lamp className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('light') || iconStr.includes('led-strip')) {
      return <Lightbulb className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('blind') || iconStr.includes('shutter') || iconStr.includes('curtain') || iconStr.includes('roller-shade') || iconStr.includes('garage')) {
      return <Blinds className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('fire') || iconStr.includes('radiator') || iconStr.includes('heating')) {
      return <Flame className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('snowflake') || iconStr.includes('air-conditioner')) {
      return <Snowflake className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('thermometer') || iconStr.includes('temperature')) {
      return <Thermometer className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('water') || iconStr.includes('humidity')) {
      return <Droplets className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('flash') || iconStr.includes('lightning') || iconStr.includes('solar') || iconStr.includes('meter-electric')) {
      return <Zap className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('plug') || iconStr.includes('power-socket')) {
      return <Plug className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('power')) {
      return <Power className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('fan')) {
      return <Fan className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('robot-vacuum') || iconStr.includes('vacuum')) {
      return <Bot className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('weather-night') || iconStr.includes('moon') || iconStr.includes('sleep') || iconStr.includes('bed')) {
      return <Moon className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('sun') || iconStr.includes('white-balance-sunny')) {
      return <Sun className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('sofa') || iconStr.includes('couch')) {
      return <Sofa className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('home')) {
      return <Home className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('shield')) {
      return <ShieldCheck className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('door')) {
      return state === 'on' || state === 'open' ? (
        <DoorOpen className={className} strokeWidth={1.75} />
      ) : (
        <DoorClosed className={className} strokeWidth={1.75} />
      );
    }
    if (iconStr.includes('lock')) {
      return state === 'unlocked' ? (
        <LockOpen className={className} strokeWidth={1.75} />
      ) : (
        <Lock className={className} strokeWidth={1.75} />
      );
    }
    if (iconStr.includes('volume')) {
      return <Volume2 className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('wifi') || iconStr.includes('network')) {
      return <Wifi className={className} strokeWidth={1.75} />;
    }
    if (iconStr.includes('camera') || iconStr.includes('cctv') || iconStr.includes('video')) {
      return <Camera className={className} strokeWidth={1.75} />;
    }
  }

  // 2. Correspondances par domaine et device_class Home Assistant
  switch (domain) {
    case 'light':
      return <Lightbulb className={className} strokeWidth={1.75} />;
    case 'switch':
      return dc === 'outlet' ? (
        <Plug className={className} strokeWidth={1.75} />
      ) : (
        <Power className={className} strokeWidth={1.75} />
      );
    case 'input_boolean':
      return state === 'on' ? (
        <ToggleRight className={className} strokeWidth={1.75} />
      ) : (
        <ToggleLeft className={className} strokeWidth={1.75} />
      );
    case 'media_player':
      if (dc === 'tv') return <Tv className={className} strokeWidth={1.75} />;
      if (dc === 'receiver') return <Radio className={className} strokeWidth={1.75} />;
      if (dc === 'speaker') return <Speaker className={className} strokeWidth={1.75} />;
      return <Disc3 className={className} strokeWidth={1.75} />;
    case 'cover':
      return <Blinds className={className} strokeWidth={1.75} />;
    case 'climate':
      if (state === 'heat') return <Flame className={className} strokeWidth={1.75} />;
      if (state === 'cool') return <Snowflake className={className} strokeWidth={1.75} />;
      return <Thermometer className={className} strokeWidth={1.75} />;
    case 'fan':
      return <Fan className={className} strokeWidth={1.75} />;
    case 'lock':
      return state === 'unlocked' ? (
        <LockOpen className={className} strokeWidth={1.75} />
      ) : (
        <Lock className={className} strokeWidth={1.75} />
      );
    case 'vacuum':
      return <Bot className={className} strokeWidth={1.75} />;
    case 'scene':
      return <Sparkles className={className} strokeWidth={1.75} />;
    case 'script':
    case 'button':
    case 'input_button':
      return <Play className={className} strokeWidth={1.75} />;
    case 'weather':
      return <CloudSun className={className} strokeWidth={1.75} />;
    case 'person':
      return <User className={className} strokeWidth={1.75} />;
    case 'camera':
      return <Camera className={className} strokeWidth={1.75} />;
    case 'image':
      return <Image className={className} strokeWidth={1.75} />;
    case 'select':
    case 'input_select':
    case 'number':
    case 'input_number':
      return <Sliders className={className} strokeWidth={1.75} />;
    case 'binary_sensor':
      if (dc === 'door' || dc === 'window' || dc === 'opening' || dc === 'garage_door') {
        return state === 'on' ? (
          <DoorOpen className={className} strokeWidth={1.75} />
        ) : (
          <DoorClosed className={className} strokeWidth={1.75} />
        );
      }
      return <Activity className={className} strokeWidth={1.75} />;
    case 'sensor':
      if (dc === 'temperature') return <Thermometer className={className} strokeWidth={1.75} />;
      if (dc === 'humidity' || dc === 'moisture') return <Droplets className={className} strokeWidth={1.75} />;
      if (dc === 'power' || dc === 'energy' || dc === 'voltage' || dc === 'current') {
        return <Zap className={className} strokeWidth={1.75} />;
      }
      if (dc === 'battery') return <BatteryCharging className={className} strokeWidth={1.75} />;
      return <Gauge className={className} strokeWidth={1.75} />;
    default:
      return <ArrowUpDown className={className} strokeWidth={1.75} />;
  }
}

export function isHaEntityActive(entity: HaEntity): boolean {
  const domain = entity.entity_id.split('.')[0];
  const s = entity.state.toLowerCase();
  if (s === 'unavailable' || s === 'unknown' || s === 'off' || s === 'closed' || s === 'standby') {
    return false;
  }
  if (domain === 'scene' || domain === 'button' || domain === 'input_button') {
    return false;
  }
  if (domain === 'sensor' || domain === 'weather' || domain === 'select' || domain === 'input_select' || domain === 'number' || domain === 'input_number') {
    return false;
  }
  if (domain === 'lock') {
    return s === 'locked';
  }
  return s === 'on' || s === 'playing' || s === 'open' || s === 'opening' || s === 'heat' || s === 'cool' || s === 'heat_cool' || s === 'auto' || s === 'cleaning' || s === 'home';
}

export function getHaTileAccentColor(entity: HaEntity): string | null {
  if (!isHaEntityActive(entity)) return null;
  const domain = entity.entity_id.split('.')[0];
  const s = entity.state.toLowerCase();

  if (domain === 'light') {
    return getLightVisualColor(entity);
  }
  if (domain === 'climate') {
    if (s === 'heat') return '#fbbf24';
    if (s === 'cool') return '#7dd3fc';
    return '#60a5fa';
  }
  if (domain === 'lock') {
    return '#34d399';
  }
  if (domain === 'binary_sensor') {
    return '#fbbf24';
  }
  return '#60a5fa';
}

export function formatHaStateShort(entity: HaEntity): string {
  const domain = entity.entity_id.split('.')[0];
  const s = entity.state;
  const sl = s.toLowerCase();
  const dc = String(entity.attributes.device_class || '').toLowerCase();

  if (sl === 'unavailable') return 'Indisponible';
  if (sl === 'unknown') return 'Inconnu';

  if (domain === 'light') {
    if (sl !== 'on') return 'Éteint';
    if (typeof entity.attributes.brightness === 'number') {
      return `${Math.round((entity.attributes.brightness / 255) * 100)}%`;
    }
    return 'Allumé';
  }

  if (domain === 'switch' || domain === 'input_boolean' || domain === 'fan') {
    if (sl === 'on') {
      if (domain === 'fan' && typeof entity.attributes.percentage === 'number') {
        return `${entity.attributes.percentage}%`;
      }
      return 'Allumé';
    }
    return 'Éteint';
  }

  if (domain === 'media_player') {
    if (sl === 'playing') {
      const title = entity.attributes.media_title;
      if (typeof title === 'string' && title.trim()) return title;
      return 'En lecture';
    }
    if (sl === 'paused') return 'En pause';
    if (sl === 'idle' || sl === 'on') {
      if (typeof entity.attributes.source === 'string' && entity.attributes.source.trim()) {
        return entity.attributes.source;
      }
      return 'Allumé';
    }
    if (sl === 'standby') return 'Veille';
    return 'Éteint';
  }

  if (domain === 'cover') {
    const pos = entity.attributes.current_position;
    if (sl === 'closed') return 'Fermé';
    if (sl === 'opening') return 'Ouverture';
    if (sl === 'closing') return 'Fermeture';
    if (typeof pos === 'number' && pos > 0 && pos < 100) return `${pos}%`;
    return 'Ouvert';
  }

  if (domain === 'climate') {
    const cur = entity.attributes.current_temperature;
    const target = entity.attributes.temperature;
    if (sl === 'off') {
      return typeof cur === 'number' ? `Arrêt • ${cur}°` : 'Arrêt';
    }
    if (typeof target === 'number' && typeof cur === 'number') {
      return `${cur}° → ${target}°`;
    }
    if (typeof target === 'number') return `${target}°C`;
    if (typeof cur === 'number') return `${cur}°C`;
    return s;
  }

  if (domain === 'lock') {
    return sl === 'locked' ? 'Verrouillé' : 'Déverrouillé';
  }

  if (domain === 'scene') return 'Activer';
  if (domain === 'script') return sl === 'on' ? 'En cours' : 'Lancer';
  if (domain === 'button' || domain === 'input_button') return 'Appuyer';

  if (domain === 'binary_sensor') {
    if (dc === 'door' || dc === 'window' || dc === 'opening' || dc === 'garage_door') {
      return sl === 'on' ? 'Ouvert' : 'Fermé';
    }
    if (dc === 'motion' || dc === 'occupancy' || dc === 'presence') {
      return sl === 'on' ? 'Détecté' : 'RAS';
    }
    return sl === 'on' ? 'Actif' : 'Inactif';
  }

  if (domain === 'weather') {
    const temp = entity.attributes.temperature;
    const weatherLabels: Record<string, string> = {
      sunny: 'Ensoleillé',
      'clear-night': 'Nuit claire',
      partlycloudy: 'Éclaircies',
      cloudy: 'Nuageux',
      rainy: 'Pluie',
      pouring: 'Averses',
      snowy: 'Neige',
      fog: 'Brouillard',
      windy: 'Vent',
      lightning: 'Orage',
    };
    const label = weatherLabels[sl] || s;
    return typeof temp === 'number' ? `${temp}° • ${label}` : label;
  }

  if (domain === 'person') {
    if (sl === 'home') return 'Maison';
    if (sl === 'not_home') return 'Absent';
    return s;
  }

  if (domain === 'camera') {
    if (sl === 'streaming') return 'Direct';
    if (sl === 'recording') return 'Enreg.';
    if (sl === 'idle') return 'En veille';
    return s;
  }

  const unit = entity.attributes.unit_of_measurement;
  if (unit) {
    const num = Number(s);
    if (!Number.isNaN(num) && s.trim() !== '') {
      const rounded = Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
      return `${rounded} ${unit}`;
    }
    return `${s} ${unit}`;
  }

  return s;
}

export function isDomainToggleable(domain: string): boolean {
  return (
    domain === 'light' ||
    domain === 'switch' ||
    domain === 'input_boolean' ||
    domain === 'fan' ||
    domain === 'scene' ||
    domain === 'script' ||
    domain === 'button' ||
    domain === 'input_button' ||
    domain === 'cover' ||
    domain === 'lock' ||
    domain === 'media_player'
  );
}
