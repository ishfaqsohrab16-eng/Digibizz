import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const distDir = join(process.cwd(), "..", "dist");
const forbiddenPatterns = [
  "http://localhost:3000",
  "https://localhost:3000",
  "http://localhost:5000",
  "https://localhost:5000",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "http://0.0.0.0",
  "https://0.0.0.0",
];
const textExtensions = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".txt",
  ".svg",
]);
const violations = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!textExtensions.has(extname(fullPath))) {
      continue;
    }

    const content = readFileSync(fullPath, "utf8");
    const matchedPattern = forbiddenPatterns.find((pattern) =>
      content.includes(pattern)
    );

    if (matchedPattern) {
      violations.push({ file: fullPath, pattern: matchedPattern });
    }
  }
};

if (!existsSync(distDir)) {
  console.error("Production build blocked: dist folder was not generated.");
  process.exit(1);
}

walk(distDir);

if (violations.length > 0) {
  console.error("Production build blocked: localhost-style URLs found in dist.");
  for (const violation of violations) {
    console.error(`- ${violation.file} contains "${violation.pattern}"`);
  }
  process.exit(1);
}

console.log("Verified dist bundle does not contain localhost-style URLs.");
