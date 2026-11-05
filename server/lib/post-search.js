export const DEFAULT_SEARCH_LIMIT = 12;
export const MAX_SEARCH_LIMIT = 50;

const POST_TYPES = new Set(["article", "editorial", "film", "short", "exclusive", "artists"]);

export function firstQuery(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** `null` means the caller did not ask for a page size. */
export function parseLimit(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(firstQuery(raw));
  if (!Number.isInteger(n) || n < 1) return DEFAULT_SEARCH_LIMIT;
  return Math.min(n, MAX_SEARCH_LIMIT);
}

export function parseOffset(raw) {
  const n = Number(firstQuery(raw));
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

/**
 * `null` when the param is absent. An empty list means the caller named types
 * and none of them are real, so the query must match nothing.
 */
export function parseTypes(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Array.isArray(raw) ? raw.join(",") : String(raw);
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => POST_TYPES.has(part));
}

export function likePattern(term) {
  const escaped = String(term)
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

/** Case-insensitive substring match on title, meta, type, and body. */
export function searchClause(q) {
  const term = String(firstQuery(q) || "").trim();
  if (!term) return null;
  const pattern = likePattern(term);
  const sql = `(
    lower(title) LIKE ? ESCAPE '\\'
    OR lower(ifnull(meta, '')) LIKE ? ESCAPE '\\'
    OR lower(type) LIKE ? ESCAPE '\\'
    OR lower(ifnull(body, '')) LIKE ? ESCAPE '\\'
  )`;
  return { sql, params: [pattern, pattern, pattern, pattern] };
}
