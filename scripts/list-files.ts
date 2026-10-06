import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Every file under dir, recursively, as paths joined onto dir.
export function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((path) => join(dir, path))
    .filter((path) => statSync(path).isFile());
}
