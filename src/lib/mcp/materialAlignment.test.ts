import assert from "node:assert/strict";
import test from "node:test";
import { validateMaterialAlignment } from "./materialAlignment";

test("creates a map material request when a lesson references a map without a map material", () => {
  const result = validateMaterialAlignment(
    [{ type: "text", content: "Observe the map below and identify the mountain range." }],
    [],
    [],
  );

  assert.equal(result.materialRequests.length, 1);
  assert.equal(result.materialRequests[0].metadata?.requested_material_type, "map");
  assert.equal(result.issues.some((issue) => issue.message.includes("map")), true);
});

test("requires a diagram or chart when a lesson mentions a diagram", () => {
  const result = validateMaterialAlignment(
    [{ type: "text", content: "Use the schema diagram to compare both processes." }],
    [],
    [],
  );

  assert.equal(result.materialRequests[0].metadata?.requested_material_type, "diagram");
  assert.equal(result.issues[0].status, "warning");
});

test("warns when formula is mentioned but no formula block exists", () => {
  const result = validateMaterialAlignment(
    [{ type: "text", content: "Apply the formula to calculate the area." }],
    [],
    [],
  );

  assert.equal(result.issues.some((issue) => issue.check_category === "schema_validity"), true);
});

test("passes material alignment when referenced map material is present", () => {
  const result = validateMaterialAlignment(
    [{ type: "text", content: "Observe the map below." }],
    [{ material_type: "map", required: true }],
    [],
  );

  assert.equal(result.materialRequests.length, 0);
  assert.equal(result.issues[0].status, "pass");
});
