import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, canonicalPackageGraph } from "../src/lib/cairo-release";

test("canonical package graph removes machine paths and sorts nodes and edges", () => {
  const graph = canonicalPackageGraph(
    {
      packages: [
        {
          name: "privacy",
          version: "0.1.0",
          source: "git+https://example.invalid/privacy#abc",
          dependencies: [{ name: "starknet" }, { name: "core" }, { name: "core" }],
        },
        {
          name: "gigstark_escrow",
          version: "0.1.0",
          source: "path+file:///private/tmp/random/contracts/Scarb.toml",
          dependencies: [{ name: "privacy" }],
        },
      ],
    },
    "gigstark_escrow",
  );

  assert.deepEqual(graph, [
    {
      name: "gigstark_escrow",
      version: "0.1.0",
      source: "workspace",
      dependencies: ["privacy"],
    },
    {
      name: "privacy",
      version: "0.1.0",
      source: "git+https://example.invalid/privacy#abc",
      dependencies: ["core", "starknet"],
    },
  ]);
});

test("canonical JSON is independent of object key insertion order", () => {
  assert.equal(
    canonicalJson({ z: 1, nested: { b: true, a: [2, 1] } }),
    canonicalJson({ nested: { a: [2, 1], b: true }, z: 1 }),
  );
});
