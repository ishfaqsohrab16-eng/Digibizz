import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const envFiles = [".env", ".env.production", ".env.local", ".env.production.local"];

const parseEnvFile = (filePath) => {
  const values = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
};

const mergedEnv = {};

for (const fileName of envFiles) {
  const filePath = join(rootDir, fileName);
  if (!existsSync(filePath)) {
    continue;
  }

  Object.assign(mergedEnv, parseEnvFile(filePath));
}

const apiUrl = (process.env.VITE_BACKEND_URL || mergedEnv.VITE_BACKEND_URL || "").trim();

if (!apiUrl) {
  console.error("Production build blocked: VITE_BACKEND_URL is missing.");
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(apiUrl);
} catch (error) {
  console.error(
    `Production build blocked: VITE_BACKEND_URL is not a valid URL: ${apiUrl}`
  );
  process.exit(1);
}

const forbiddenHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

if (forbiddenHosts.has(parsedUrl.hostname)) {
  console.error(
    `Production build blocked: VITE_BACKEND_URL points to a local host: ${apiUrl}`
  );
  process.exit(1);
}

if (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "") {
  console.error(
    `Production build blocked: VITE_BACKEND_URL must be the server origin only, without a path. Received: ${apiUrl}`
  );
  process.exit(1);
}

console.log(`Validated production API origin: ${parsedUrl.origin}`);
