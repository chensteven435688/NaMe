#!/usr/bin/env node
/**
 * Rebuild i18n.js strings from locales/*.json
 * Usage: node scripts/rebuild-i18n.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const langs = ["en", "ko", "it", "fr", "es", "ja", "zh-Hans", "zh-Hant"];
const packs = {};

for (const lang of langs) {
  packs[lang] = JSON.parse(
    fs.readFileSync(path.join(root, "locales", `${lang}.json`), "utf8")
  );
}

function serializePack(pack, indent) {
  const pad = " ".repeat(indent);
  const pad2 = " ".repeat(indent + 2);
  const keys = Object.keys(pack);
  const lines = ["{"];
  keys.forEach((key, i) => {
    const comma = i < keys.length - 1 ? "," : "";
    lines.push(`${pad2}${JSON.stringify(key)}: ${JSON.stringify(pack[key])}${comma}`);
  });
  lines.push(`${pad}}`);
  return lines.join("\n");
}

const stringsLiteral =
  "{\n" +
  langs
    .map((lang, i) => {
      const comma = i < langs.length - 1 ? "," : "";
      return `    ${JSON.stringify(lang)}: ${serializePack(packs[lang], 4)}${comma}`;
    })
    .join("\n") +
  "\n  }";

const full = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
const start = full.indexOf("const strings = ");
const end = full.indexOf(";\n\n  let currentLang");
if (start < 0 || end < 0) throw new Error("i18n.js markers not found");

fs.writeFileSync(
  path.join(root, "i18n.js"),
  full.slice(0, start) + "const strings = " + stringsLiteral + full.slice(end)
);

console.log("Rebuilt i18n.js from locales/");
