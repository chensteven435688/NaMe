import test from "node:test";
import assert from "node:assert/strict";
import { collectionName, validateMetaName } from "../lib/exclusive-meta.js";

test("dated meta labels collapse to the category folder", () => {
  assert.equal(collectionName("Fashion — 02 Mar 2026"), "Fashion");
  assert.equal(collectionName("Fashion, Art — 06 Feb 2026"), "Fashion, Art");
  assert.equal(collectionName("Editor's note"), "Editor's note");
  assert.equal(collectionName("Spring — studio"), "Spring — studio");
});

test("meta names reject blanks and the reserved folder key", () => {
  assert.equal(validateMetaName("   ").error, "Meta name required");
  assert.equal(validateMetaName("__uncategorized__").error, "Choose a different meta name");
  assert.equal(validateMetaName("  Atelier  ").name, "Atelier");
});
