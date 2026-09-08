import assert from "node:assert/strict";
import test from "node:test";
import {
  assertHackathonSubmissionReady,
  assertProviderReceiptAgreement,
  parseHackathonSubmission,
  qualifyingReceiptEvidence,
} from "../src/lib/hackathon-submission";
import { STRK20_MAINNET_POOL } from "../src/lib/strk20-mainnet";

const ready = () => parseHackathonSubmission({
  transactions: ["0x1", "0x2", "0x3"], contracts: [],
  demo_video: "https://youtu.be/example", demo_url: "https://zeerostream.pages.dev",
});

test("submission gate requires three distinct hashes, public URLs, and no declared MVP contracts", () => {
  assert.doesNotThrow(() => assertHackathonSubmissionReady(ready()));
  assert.throws(() => assertHackathonSubmissionReady({ ...ready(), transactions: ["0x1", "0x2"] }), /THREE/);
  assert.throws(() => assertHackathonSubmissionReady({ ...ready(), transactions: ["0x1", "0x01", "0x3"] }), /DUPLICATE/);
  assert.throws(() => assertHackathonSubmissionReady({ ...ready(), contracts: ["0x123"] }), /MUST_NOT_DECLARE/);
  assert.throws(() => assertHackathonSubmissionReady({ ...ready(), demo_video: "" }), /VIDEO_URL/);
});

test("receipt evidence unwraps starknet.js helpers and requires accepted success plus a pool event", () => {
  const value = {
    execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L2",
    block_hash: "0xabc", block_number: 42,
    events: [{ from_address: STRK20_MAINNET_POOL }, { from_address: "0x123" }],
  };
  const evidence = qualifyingReceiptEvidence("0x1", { value }, STRK20_MAINNET_POOL);
  assert.equal(evidence.poolEventCount, 1);
  assert.equal(evidence.blockNumber, 42);
  assert.throws(() => qualifyingReceiptEvidence("0x1", { ...value, execution_status: "REVERTED" }, STRK20_MAINNET_POOL), /NOT_QUALIFYING/);
});

test("two providers must return the same immutable receipt evidence", () => {
  const evidence = qualifyingReceiptEvidence("0x1", {
    execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L1",
    block_hash: "0xabc", block_number: 42, events: [{ from_address: STRK20_MAINNET_POOL }],
  }, STRK20_MAINNET_POOL);
  assert.doesNotThrow(() => assertProviderReceiptAgreement(evidence, { ...evidence }));
  assert.throws(() => assertProviderReceiptAgreement(evidence, { ...evidence, blockNumber: 43 }), /DISAGREEMENT/);
});
