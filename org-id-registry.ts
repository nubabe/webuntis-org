import { existsSync, readFileSync, writeFileSync } from "node:fs";

const REGISTRY_FILE_PATH = "org-ids.json";

export interface OrgIdRegistry {
  readonly [key: string]: string;
}

export const loadOrgIds = (): OrgIdRegistry =>
  existsSync(REGISTRY_FILE_PATH) ? JSON.parse(readFileSync(REGISTRY_FILE_PATH, "utf8")) : {};

export const saveOrgIds = (registry: OrgIdRegistry): void =>
  writeFileSync(REGISTRY_FILE_PATH, `${JSON.stringify(registry, null, 2)}\n`);

export interface EnsureOrgIdsResult {
  readonly registry: OrgIdRegistry;
  readonly addedCount: number;
}

/** Assigns an org-id (via `generateIds`) to every key that doesn't already have one; existing ids are kept as-is. */
export const ensureOrgIds = (
  keys: ReadonlyArray<string>,
  registry: OrgIdRegistry,
  generateIds: (count: number) => ReadonlyArray<string>,
): EnsureOrgIdsResult => {
  const missing = keys.filter((key) => !(key in registry));
  if (missing.length === 0) return { registry, addedCount: 0 };

  const newIds = generateIds(missing.length);
  const additions = Object.fromEntries(missing.map((key, i) => [key, newIds[i]]));
  return { registry: { ...registry, ...additions }, addedCount: missing.length };
};
