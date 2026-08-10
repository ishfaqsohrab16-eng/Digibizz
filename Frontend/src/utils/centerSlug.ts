export interface CenterLike {
  center_id: number;
  center_name: string;
}

// Small words that are dropped when an acronym alias is generated
// ("Government Commerce College" -> "gcc").
const STOP_WORDS = new Set(["of", "the", "and", "for", "a", "an", "at", "in", "on"]);

export const normalizeSlug = (value: string | number): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Canonical slug used in the dedicated apply link of a center. */
export const centerSlug = (center: CenterLike): string =>
  normalizeSlug(center.center_name) || `center-${center.center_id}`;

/** Acronym alias built from the center name, e.g. "Govt Commerce College" -> "gcc". */
export const centerAcronym = (center: CenterLike): string => {
  const words = normalizeSlug(center.center_name)
    .split("-")
    .filter((word) => word && !STOP_WORDS.has(word));

  if (words.length < 2) return "";
  return words.map((word) => word[0]).join("");
};

/**
 * Every URL fragment that resolves to this center. The acronym is only handed
 * out when no other center produces the same one, so links stay unambiguous.
 */
export const centerSlugAliases = (center: CenterLike, allCenters: CenterLike[] = []): string[] => {
  const aliases = [centerSlug(center), String(center.center_id), `center-${center.center_id}`];
  const acronym = centerAcronym(center);

  if (acronym) {
    const collides = allCenters.some(
      (other) => other.center_id !== center.center_id && centerAcronym(other) === acronym
    );
    const shadowsAnotherCenter = allCenters.some(
      (other) => other.center_id !== center.center_id && centerSlug(other) === acronym
    );
    if (!collides && !shadowsAnotherCenter) aliases.push(acronym);
  }

  return Array.from(new Set(aliases.filter(Boolean)));
};

/** Resolve the `:centerSlug` route param to a center. Exact slugs win over acronyms. */
export const findCenterBySlug = <T extends CenterLike>(
  centers: T[],
  slug?: string
): T | undefined => {
  const target = normalizeSlug(slug || "");
  if (!target) return undefined;

  const exact = centers.find(
    (center) =>
      centerSlug(center) === target ||
      String(center.center_id) === target ||
      `center-${center.center_id}` === target
  );
  if (exact) return exact;

  return centers.find((center) => centerSlugAliases(center, centers).includes(target));
};

export const centerApplyPath = (center: CenterLike): string =>
  `/registration/${centerSlug(center)}`;

export const centerApplyUrl = (center: CenterLike, origin?: string): string => {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${centerApplyPath(center)}`;
};

export const unifiedApplyUrl = (origin?: string): string => {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/registration`;
};
