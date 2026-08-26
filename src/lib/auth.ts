import fs from "node:fs";
import path from "node:path";

export type AuthKeys = {
  tmdbApiKey: string;
};

const EMPTY_AUTH: AuthKeys = {
  tmdbApiKey: "",
};

function authPath() {
  return process.env.AUTH_JSON_PATH ?? path.join(process.cwd(), "auth.json");
}

function asAuthKeys(value: unknown): AuthKeys {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_AUTH };
  }
  const record = value as Record<string, unknown>;
  const tmdbApiKey =
    typeof record.tmdbApiKey === "string"
      ? record.tmdbApiKey.trim()
      : typeof record.TMDB_API_KEY === "string"
        ? record.TMDB_API_KEY.trim()
        : "";
  return { tmdbApiKey };
}

export function readAuthKeys(): AuthKeys {
  const filePath = authPath();
  if (!fs.existsSync(filePath)) {
    return { ...EMPTY_AUTH };
  }
  try {
    return asAuthKeys(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return { ...EMPTY_AUTH };
  }
}

export function writeAuthKeys(partial: Partial<AuthKeys>): AuthKeys {
  const next: AuthKeys = {
    ...readAuthKeys(),
    ...Object.fromEntries(
      Object.entries(partial).map(([key, value]) => [key, value?.trim() ?? ""]),
    ),
  };
  const filePath = authPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return next;
}

export function getStoredTmdbApiKey(): string | null {
  const fromFile = readAuthKeys().tmdbApiKey;
  if (fromFile) {
    return fromFile;
  }
  const fromEnv = process.env.TMDB_API_KEY?.trim();
  return fromEnv ? fromEnv : null;
}

export const AUTH_KEY_HELP =
  "Add your TMDB key to auth.json, or paste it on the Setup screen.";
