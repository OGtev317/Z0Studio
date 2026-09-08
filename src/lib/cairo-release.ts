export type ScarbMetadataPackage = {
  name: string;
  version: string;
  source: string;
  dependencies?: Array<{ name: string }>;
};

export type ScarbMetadata = {
  packages: ScarbMetadataPackage[];
};

export type CanonicalPackage = {
  name: string;
  version: string;
  source: string;
  dependencies: string[];
};

export function canonicalPackageGraph(
  metadata: ScarbMetadata,
  workspacePackage: string,
): CanonicalPackage[] {
  return metadata.packages
    .map((entry) => ({
      name: entry.name,
      version: entry.version,
      source: normalizePackageSource(entry, workspacePackage),
      dependencies: [...new Set((entry.dependencies ?? []).map(({ name }) => name))].sort(),
    }))
    .sort((left, right) => {
      const leftKey = `${left.name}\0${left.version}\0${left.source}`;
      const rightKey = `${right.name}\0${right.version}\0${right.source}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function normalizePackageSource(
  entry: ScarbMetadataPackage,
  workspacePackage: string,
): string {
  if (entry.name === workspacePackage) return "workspace";
  if (entry.source.startsWith("path+file://")) return "path-dependency";
  return entry.source;
}
