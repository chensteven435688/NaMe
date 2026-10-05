/** Folder names for Editor's Exclusive. Keep in sync with exclusiveCollectionName in auth.js. */

export const EXCLUSIVE_UNCATEGORIZED = "__uncategorized__";
export const EXCLUSIVE_META_MAX = 80;

export function normalizeMetaName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function collectionName(meta) {
  const raw = normalizeMetaName(meta);
  if (!raw) return "";
  const parts = raw.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    const tail = parts.slice(1).join(" — ").trim();
    if (/^\d/.test(tail) && /\d{4}/.test(tail)) return parts[0].trim();
  }
  return raw;
}

export function validateMetaName(value) {
  const name = collectionName(value);
  if (!name) return { error: "Meta name required" };
  if (name.length > EXCLUSIVE_META_MAX) {
    return { error: "Meta name must be 80 characters or fewer" };
  }
  if (name.toLowerCase() === EXCLUSIVE_UNCATEGORIZED) {
    return { error: "Choose a different meta name" };
  }
  return { name };
}
