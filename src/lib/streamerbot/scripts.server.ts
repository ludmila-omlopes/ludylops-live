import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  streamerbotScriptDefinitions,
  type StreamerbotScriptRecord,
} from "@/lib/streamerbot/scripts-catalog";

function readStreamerbotSource(filename: string) {
  const filePath = path.join(process.cwd(), "streamerbot", filename);
  return readFileSync(filePath, "utf8");
}

export function listStreamerbotScripts(): StreamerbotScriptRecord[] {
  const availableFiles = new Set(
    readdirSync(path.join(process.cwd(), "streamerbot")).filter((entry) => entry.endsWith(".cs")),
  );

  return streamerbotScriptDefinitions
    .filter((definition) => availableFiles.has(definition.filename))
    .map((definition) => ({
      ...definition,
      source: readStreamerbotSource(definition.filename),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}
