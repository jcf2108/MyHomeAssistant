import type {
  HaAreaEntry,
  HaDeviceRegistryEntry,
  HaEntity,
  HaEntityRegistryEntry,
  LovelaceBadgeItem,
  LovelaceCardConfig,
  LovelaceCondition,
  LovelaceConfig,
  LovelaceFeatureConfig,
  LovelaceViewConfig,
} from '../types/ha';

export interface NormalizedTileBadge {
  entityId: string;
  name?: string;
  icon?: string;
}

export interface NormalizedTileItem {
  key: string;
  entityId: string;
  name?: string;
  icon?: string;
  imageUrl?: string;
  showBanner?: boolean;
  cardType: string;
  fullWidth: boolean;
  features: LovelaceFeatureConfig[];
}

export interface NormalizedOverviewSection {
  key: string;
  title?: string;
  icon?: string;
  bannerImageUrl?: string;
  badges: NormalizedTileBadge[];
  items: NormalizedTileItem[];
}

export interface LovelaceRegistryContext {
  areas?: HaAreaEntry[];
  entityRegistry?: Record<string, HaEntityRegistryEntry>;
  deviceRegistry?: Record<string, HaDeviceRegistryEntry>;
}

const AUTO_OVERVIEW_DOMAINS = new Set([
  'media_player',
  'light',
  'switch',
  'cover',
  'climate',
  'fan',
  'scene',
  'script',
  'button',
  'lock',
  'camera',
]);

function evaluateConditions(
  conditions: LovelaceCondition[] | undefined,
  entities: Record<string, HaEntity>,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  for (const cond of conditions) {
    if (!cond.entity) continue;
    const current = entities[cond.entity]?.state;
    if (cond.state !== undefined) {
      const allowed = Array.isArray(cond.state) ? cond.state : [cond.state];
      if (!current || !allowed.includes(current)) return false;
    }
    if (cond.state_not !== undefined) {
      const forbidden = Array.isArray(cond.state_not) ? cond.state_not : [cond.state_not];
      if (current && forbidden.includes(current)) return false;
    }
  }
  return true;
}

function parseBadges(
  rawBadges: Array<string | LovelaceBadgeItem> | undefined,
): NormalizedTileBadge[] {
  if (!Array.isArray(rawBadges)) return [];
  const out: NormalizedTileBadge[] = [];
  for (const b of rawBadges) {
    if (typeof b === 'string') {
      out.push({ entityId: b });
    } else if (b && typeof b === 'object' && typeof b.entity === 'string') {
      out.push({ entityId: b.entity, name: b.name, icon: b.icon });
    }
  }
  return out;
}

function extractCardImage(
  card: LovelaceCardConfig,
  entities: Record<string, HaEntity>,
): string | undefined {
  if (typeof card.image === 'string' && card.image.trim()) {
    return card.image.trim();
  }
  if (typeof card.picture === 'string' && card.picture.trim()) {
    return card.picture.trim();
  }
  if (typeof card.camera_image === 'string' && entities[card.camera_image]) {
    return entities[card.camera_image].attributes.entity_picture;
  }
  const imgEntity =
    typeof card.image_entity === 'string' ? card.image_entity : undefined;
  if (imgEntity && entities[imgEntity]) {
    return entities[imgEntity].attributes.entity_picture;
  }
  return undefined;
}

function isCardFullWidth(card: LovelaceCardConfig, entityId: string): boolean {
  const t = (card.type || '').toLowerCase();
  const domain = entityId.split('.')[0];

  if (
    t === 'media-control' ||
    t === 'thermostat' ||
    t === 'humidifier' ||
    t === 'weather-forecast' ||
    t === 'picture-entity' ||
    t === 'picture-glance' ||
    t.includes('media-player')
  ) {
    return true;
  }

  const cols = card.grid_options?.columns ?? card.layout_options?.grid_columns;
  if (cols === 'full' || (typeof cols === 'number' && cols >= 9)) {
    return true;
  }

  if (Array.isArray(card.features) && card.features.length > 0) {
    return true;
  }

  if ((domain === 'media_player' || domain === 'camera') && t !== 'button') {
    return true;
  }

  return false;
}

function collectAreaEntities(
  areaId: string,
  entities: Record<string, HaEntity>,
  ctx?: LovelaceRegistryContext,
): NormalizedTileItem[] {
  const entityReg = ctx?.entityRegistry || {};
  const deviceReg = ctx?.deviceRegistry || {};
  const out: NormalizedTileItem[] = [];

  for (const ent of Object.values(entities)) {
    const domain = ent.entity_id.split('.')[0];
    if (!AUTO_OVERVIEW_DOMAINS.has(domain)) continue;
    if (ent.state === 'unavailable') continue;

    const reg = entityReg[ent.entity_id];
    if (reg?.hidden_by || reg?.disabled_by || reg?.entity_category) continue;
    const resolvedArea =
      reg?.area_id || (reg?.device_id ? deviceReg[reg.device_id]?.area_id : null) || null;
    if (resolvedArea !== areaId) continue;

    out.push({
      key: `area-card-${areaId}-${ent.entity_id}`,
      entityId: ent.entity_id,
      name: reg?.name || undefined,
      icon: reg?.icon || undefined,
      cardType: 'tile',
      fullWidth: domain === 'media_player' || domain === 'camera',
      features: [],
    });
  }

  return out;
}

/**
 * Aplatit récursivement une liste de cartes Lovelace (stacks, grids, entities, picture-*, area, custom cards)
 * en sous-sections ordonnées fidèles à l'affichage Home Assistant.
 */
function collectCardsIntoSections(
  cards: LovelaceCardConfig[],
  entities: Record<string, HaEntity>,
  defaultTitle: string | undefined,
  prefixKey: string,
  ctx?: LovelaceRegistryContext,
): NormalizedOverviewSection[] {
  const sections: NormalizedOverviewSection[] = [];
  let currentSection: NormalizedOverviewSection = {
    key: `${prefixKey}-0`,
    title: defaultTitle,
    badges: [],
    items: [],
  };

  const pushCurrentIfNotEmpty = () => {
    if (
      currentSection.items.length > 0 ||
      currentSection.badges.length > 0 ||
      Boolean(currentSection.bannerImageUrl)
    ) {
      sections.push(currentSection);
    }
  };

  cards.forEach((card, idx) => {
    if (!card || typeof card !== 'object') return;
    const type = String(card.type || '').toLowerCase();

    // 1. Carte d'en-tête Home Assistant Sections ('heading')
    if (type === 'heading') {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
        currentSection = {
          key: `${prefixKey}-h-${idx}`,
          title: card.heading || card.title,
          icon: card.icon,
          badges: parseBadges(card.badges),
          items: [],
        };
      } else {
        currentSection.title = card.heading || card.title || currentSection.title;
        currentSection.icon = card.icon || currentSection.icon;
        currentSection.badges = [
          ...currentSection.badges,
          ...parseBadges(card.badges),
        ];
      }
      return;
    }

    // 2. Carte conditionnelle
    if (type === 'conditional') {
      if (evaluateConditions(card.conditions, entities) && card.card) {
        const nested = collectCardsIntoSections(
          [card.card],
          entities,
          undefined,
          `${prefixKey}-cond-${idx}`,
          ctx,
        );
        for (const ns of nested) {
          currentSection.items.push(...ns.items);
        }
      }
      return;
    }

    // 3. Carte Pièce Home Assistant ('area') avec photo éventuelle de la pièce
    if (type === 'area' && typeof card.area === 'string') {
      const matchedArea = ctx?.areas?.find((a) => a.area_id === card.area);
      const areaItems = collectAreaEntities(card.area, entities, ctx);
      if (areaItems.length > 0 || matchedArea?.picture) {
        pushCurrentIfNotEmpty();
        sections.push({
          key: `${prefixKey}-area-${idx}`,
          title: card.name || card.title || matchedArea?.name || card.area,
          icon: card.icon || matchedArea?.icon || undefined,
          bannerImageUrl: matchedArea?.picture || extractCardImage(card, entities),
          badges: [],
          items: areaItems,
        });
        currentSection = {
          key: `${prefixKey}-after-area-${idx}`,
          badges: [],
          items: [],
        };
      }
      return;
    }

    // 4. Conteneurs (grid, horizontal-stack, vertical-stack)
    if (Array.isArray(card.cards) && card.cards.length > 0) {
      if (card.title && currentSection.items.length > 0) {
        sections.push(currentSection);
        currentSection = {
          key: `${prefixKey}-stack-${idx}`,
          title: card.title,
          badges: [],
          items: [],
        };
      } else if (card.title && !currentSection.title) {
        currentSection.title = card.title;
      }

      const nested = collectCardsIntoSections(
        card.cards,
        entities,
        undefined,
        `${prefixKey}-sub-${idx}`,
        ctx,
      );
      nested.forEach((ns, nIdx) => {
        if (
          nIdx === 0 &&
          !ns.bannerImageUrl &&
          (!ns.title || ns.title === currentSection.title)
        ) {
          currentSection.items.push(...ns.items);
        } else {
          pushCurrentIfNotEmpty();
          currentSection = ns;
        }
      });
      return;
    }

    // 5. Cartes multi-entités ('entities', 'glance', 'picture-glance', etc.)
    if (Array.isArray(card.entities) && card.entities.length > 0) {
      const cardImg = extractCardImage(card, entities);
      const groupItems: NormalizedTileItem[] = [];
      card.entities.forEach((entry, eIdx) => {
        if (typeof entry === 'string') {
          groupItems.push({
            key: `${prefixKey}-${idx}-e-${eIdx}`,
            entityId: entry,
            cardType: type || 'entities',
            fullWidth: entry.startsWith('media_player.') || entry.startsWith('camera.'),
            features: [],
          });
        } else if (entry && typeof entry === 'object' && typeof entry.entity === 'string') {
          groupItems.push({
            key: `${prefixKey}-${idx}-e-${eIdx}`,
            entityId: entry.entity,
            name: entry.name,
            icon: entry.icon,
            cardType: type || 'entities',
            fullWidth:
              entry.entity.startsWith('media_player.') ||
              entry.entity.startsWith('camera.'),
            features: [],
          });
        }
      });

      if (groupItems.length > 0) {
        if (card.title || cardImg) {
          pushCurrentIfNotEmpty();
          sections.push({
            key: `${prefixKey}-ent-${idx}`,
            title: card.title,
            bannerImageUrl: cardImg,
            badges: [],
            items: groupItems,
          });
          currentSection = {
            key: `${prefixKey}-after-${idx}`,
            badges: [],
            items: [],
          };
        } else {
          currentSection.items.push(...groupItems);
        }
      }
      return;
    }

    // 6. Toute tuile / carte mono-entité ('tile', 'button', 'picture-entity', 'light', 'media-control', 'thermostat', 'custom:*', etc.)
    if (typeof card.entity === 'string' && card.entity.includes('.')) {
      const domain = card.entity.split('.')[0];
      const cardImg = extractCardImage(card, entities);
      const showBanner =
        type === 'picture-entity' ||
        type === 'picture' ||
        domain === 'camera' ||
        domain === 'image';

      currentSection.items.push({
        key: `${prefixKey}-tile-${idx}`,
        entityId: card.entity,
        name: card.name || card.title,
        icon: card.icon,
        imageUrl: cardImg,
        showBanner,
        cardType: type || 'tile',
        fullWidth: showBanner || isCardFullWidth(card, card.entity),
        features: Array.isArray(card.features) ? card.features : [],
      });
    }
  });

  pushCurrentIfNotEmpty();
  return sections;
}

export function normalizeLovelaceView(
  view: LovelaceViewConfig | undefined,
  entities: Record<string, HaEntity>,
  ctx?: LovelaceRegistryContext,
): { badges: NormalizedTileBadge[]; sections: NormalizedOverviewSection[] } {
  if (!view) return { badges: [], sections: [] };

  const topBadges = parseBadges(view.badges);
  const allSections: NormalizedOverviewSection[] = [];

  if (Array.isArray(view.sections) && view.sections.length > 0) {
    view.sections.forEach((sec, sIdx) => {
      if (!sec.cards || sec.cards.length === 0) return;
      const parsed = collectCardsIntoSections(
        sec.cards,
        entities,
        sec.title,
        `sec-${sIdx}`,
        ctx,
      );
      allSections.push(...parsed);
    });
  } else if (Array.isArray(view.cards) && view.cards.length > 0) {
    const parsed = collectCardsIntoSections(view.cards, entities, undefined, 'view', ctx);
    allSections.push(...parsed);
  }

  return { badges: topBadges, sections: allSections };
}

/**
 * Extrait la liste ordonnée et dédoublonnée de tous les entity_id présents dans l'Aperçu Lovelace.
 */
export function extractOverviewEntityIds(
  config: LovelaceConfig | null,
  entities: Record<string, HaEntity>,
  ctx?: LovelaceRegistryContext,
): string[] {
  if (!config || !Array.isArray(config.views)) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const view of config.views) {
    if (view.subview) continue;
    const { badges, sections } = normalizeLovelaceView(view, entities, ctx);
    for (const b of badges) {
      if (!seen.has(b.entityId)) {
        seen.add(b.entityId);
        ordered.push(b.entityId);
      }
    }
    for (const sec of sections) {
      for (const item of sec.items) {
        if (!seen.has(item.entityId)) {
          seen.add(item.entityId);
          ordered.push(item.entityId);
        }
      }
    }
  }
  return ordered;
}

/**
 * Reconstruit fidèlement l'Aperçu automatique par Pièce (Areas) de Home Assistant
 * lorsque l'utilisateur n'a pas enregistré de configuration Lovelace personnalisée ('config_not_found').
 */
export function buildAutoAreasOverview(
  entities: Record<string, HaEntity>,
  areas: HaAreaEntry[],
  entityRegistry: Record<string, HaEntityRegistryEntry>,
  deviceRegistry: Record<string, HaDeviceRegistryEntry>,
): NormalizedOverviewSection[] {
  const areaMap = new Map<string, HaAreaEntry>();
  for (const a of areas) {
    areaMap.set(a.area_id, a);
  }

  const grouped = new Map<string, NormalizedTileItem[]>();
  const unassigned: NormalizedTileItem[] = [];

  const sortedEntities = Object.values(entities).sort((a, b) =>
    (a.attributes.friendly_name || a.entity_id).localeCompare(
      b.attributes.friendly_name || b.entity_id,
    ),
  );

  for (const entity of sortedEntities) {
    const domain = entity.entity_id.split('.')[0];
    if (!AUTO_OVERVIEW_DOMAINS.has(domain)) continue;
    if (entity.state === 'unavailable') continue;

    const reg = entityRegistry[entity.entity_id];
    if (reg?.hidden_by || reg?.disabled_by || reg?.entity_category) continue;

    const areaId =
      reg?.area_id || (reg?.device_id ? deviceRegistry[reg.device_id]?.area_id : null) || null;

    const tile: NormalizedTileItem = {
      key: `auto-${entity.entity_id}`,
      entityId: entity.entity_id,
      name: reg?.name || undefined,
      icon: reg?.icon || undefined,
      showBanner: domain === 'camera',
      cardType: 'tile',
      fullWidth: domain === 'media_player' || domain === 'camera',
      features: [],
    };

    if (areaId && areaMap.has(areaId)) {
      const list = grouped.get(areaId) || [];
      list.push(tile);
      grouped.set(areaId, list);
    } else {
      unassigned.push(tile);
    }
  }

  const sections: NormalizedOverviewSection[] = [];
  for (const area of areas) {
    const items = grouped.get(area.area_id);
    if (items && items.length > 0) {
      sections.push({
        key: `area-${area.area_id}`,
        title: area.name,
        icon: area.icon || undefined,
        bannerImageUrl: area.picture || undefined,
        badges: [],
        items,
      });
    }
  }

  if (unassigned.length > 0 && sections.length === 0) {
    sections.push({
      key: 'area-default',
      title: 'Appareils',
      badges: [],
      items: unassigned.slice(0, 24),
    });
  } else if (unassigned.length > 0) {
    sections.push({
      key: 'area-other',
      title: 'Autres',
      badges: [],
      items: unassigned.slice(0, 12),
    });
  }

  return sections;
}
