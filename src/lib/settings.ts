import 'server-only';
import { cache } from 'react';
import { prisma } from './db';
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  type SettingDefinition,
  type SettingKey,
} from './constants';

/**
 * Platform settings.
 *
 * Stored as strings in a key/value table with a code-side definition list that
 * supplies the type, the label and — importantly — the default. An unknown key
 * in the database is ignored, and a missing row falls back to the code default,
 * so the platform still boots correctly against a partially seeded database.
 *
 * Cached per request with React `cache`, so a page that consults four settings
 * performs one query.
 */

export type SettingsMap = Record<SettingKey, string>;

const DEFAULTS: SettingsMap = Object.fromEntries(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition.defaultValue]),
) as SettingsMap;

export const getSettings = cache(async (): Promise<SettingsMap> => {
  try {
    const rows = await prisma.systemSetting.findMany();
    const map: SettingsMap = { ...DEFAULTS };

    for (const row of rows) {
      if (row.key in map) {
        map[row.key as SettingKey] = row.value;
      }
    }
    return map;
  } catch (error) {
    // A settings read must never take the whole platform down.
    console.error('[fodan][settings] falling back to defaults', error);
    return { ...DEFAULTS };
  }
});

export async function getSetting(key: SettingKey): Promise<string> {
  const settings = await getSettings();
  return settings[key];
}

export async function getBooleanSetting(key: SettingKey): Promise<boolean> {
  return (await getSetting(key)).toLowerCase() === 'true';
}

export async function getNumberSetting(key: SettingKey): Promise<number> {
  const parsed = Number.parseInt(await getSetting(key), 10);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = Number.parseInt(DEFAULTS[key], 10);
  return Number.isFinite(fallback) ? fallback : 0;
}

export interface SettingChange {
  key: SettingKey;
  from: string;
  to: string;
}

/**
 * Writes only the keys that actually changed and returns the diff, so the audit
 * entry records what moved rather than the whole settings blob.
 */
export async function updateSettings(
  updates: Partial<Record<SettingKey, string>>,
  updatedById: string,
): Promise<SettingChange[]> {
  const current = await getSettings();
  const changes: SettingChange[] = [];

  for (const [rawKey, rawValue] of Object.entries(updates)) {
    const key = rawKey as SettingKey;
    const definition = SETTING_DEFINITIONS.find((item) => item.key === key);
    if (!definition || rawValue === undefined) continue;

    const value = coerce(definition, rawValue);
    if (value === current[key]) continue;

    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        valueType: definition.valueType,
        category: definition.category,
        description: definition.description,
        updatedById,
      },
      update: { value, updatedById },
    });

    changes.push({ key, from: current[key], to: value });
  }

  return changes;
}

function coerce(definition: SettingDefinition, raw: string): string {
  switch (definition.valueType) {
    case 'boolean':
      return ['1', 'true', 'on', 'yes'].includes(raw.trim().toLowerCase())
        ? 'true'
        : 'false';
    case 'number': {
      const parsed = Number.parseInt(raw.trim(), 10);
      return Number.isFinite(parsed)
        ? String(Math.max(0, Math.min(100_000, parsed)))
        : definition.defaultValue;
    }
    default:
      return raw.trim().slice(0, 2000);
  }
}

/** Ensures every defined setting has a row. Used by the seed script. */
export async function ensureSettingRows(): Promise<number> {
  let created = 0;
  for (const definition of SETTING_DEFINITIONS) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: definition.key },
    });
    if (existing) continue;

    await prisma.systemSetting.create({
      data: {
        key: definition.key,
        value: definition.defaultValue,
        valueType: definition.valueType,
        category: definition.category,
        description: definition.description,
      },
    });
    created += 1;
  }
  return created;
}

export { SETTING_KEYS, SETTING_DEFINITIONS };
