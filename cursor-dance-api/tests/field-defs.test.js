import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NUMERIC_LIMITS,
  ENUM_OPTIONS,
  BOOLEAN_FIELDS,
  STRING_FIELDS,
  ARRAY_FIELDS,
  AI_SCHEME_PATCH_FIELDS,
  FIELD_LABELS,
  AI_TASK_MODES,
  VALID_PROPOSAL_MODES,
} from "../src/field-defs.js";

describe("NUMERIC_LIMITS", () => {
  it("all limits are [min, max] tuples", () => {
    for (const [name, limits] of Object.entries(NUMERIC_LIMITS)) {
      assert.ok(Array.isArray(limits), `${name} should be an array`);
      assert.equal(limits.length, 2, `${name} should have exactly 2 elements`);
      assert.ok(limits[0] < limits[1], `${name}: min should be less than max`);
    }
  });
});

describe("ENUM_OPTIONS", () => {
  it("all options are non-empty arrays", () => {
    for (const [name, options] of Object.entries(ENUM_OPTIONS)) {
      assert.ok(Array.isArray(options), `${name} should be an array`);
      assert.ok(options.length > 0, `${name} should not be empty`);
    }
  });
});

describe("AI_SCHEME_PATCH_FIELDS", () => {
  it("contains all field categories", () => {
    for (const key of Object.keys(NUMERIC_LIMITS)) {
      assert.ok(AI_SCHEME_PATCH_FIELDS.has(key), `numeric field ${key} missing`);
    }
    for (const key of Object.keys(ENUM_OPTIONS)) {
      assert.ok(AI_SCHEME_PATCH_FIELDS.has(key), `enum field ${key} missing`);
    }
    for (const key of BOOLEAN_FIELDS) {
      assert.ok(AI_SCHEME_PATCH_FIELDS.has(key), `boolean field ${key} missing`);
    }
    for (const key of STRING_FIELDS) {
      assert.ok(AI_SCHEME_PATCH_FIELDS.has(key), `string field ${key} missing`);
    }
    for (const key of ARRAY_FIELDS) {
      assert.ok(AI_SCHEME_PATCH_FIELDS.has(key), `array field ${key} missing`);
    }
  });
});

describe("FIELD_LABELS", () => {
  it("has labels for all patch fields", () => {
    for (const field of AI_SCHEME_PATCH_FIELDS) {
      assert.ok(FIELD_LABELS[field], `missing label for: ${field}`);
    }
  });
});

describe("VALID_PROPOSAL_MODES", () => {
  it("contains expected modes", () => {
    assert.ok(VALID_PROPOSAL_MODES.has("modify_action"));
    assert.ok(VALID_PROPOSAL_MODES.has("generate_theme"));
    assert.ok(VALID_PROPOSAL_MODES.has("explain_config"));
    assert.ok(VALID_PROPOSAL_MODES.has("tune_proposal"));
  });
});

describe("AI_TASK_MODES", () => {
  it("maps all valid proposal modes", () => {
    for (const mode of VALID_PROPOSAL_MODES) {
      assert.ok(AI_TASK_MODES[mode], `missing task mode label for: ${mode}`);
    }
  });
});
