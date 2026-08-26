const PUNCTUATION = /[^a-z0-9\s]/g;
const DIACRITICS = /[\u0300-\u036f]/g;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(/&/g, " and ")
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
}
