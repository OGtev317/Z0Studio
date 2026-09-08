import { readFileSync, writeFileSync } from "node:fs";

const [requestPath, responsePath, outputPath] = process.argv.slice(2);
if (!requestPath || !responsePath || !outputPath) {
  throw new Error("usage: prepare-input.mjs REQUEST RESPONSE OUTPUT");
}

const request = JSON.parse(readFileSync(requestPath, "utf8"));
const response = JSON.parse(readFileSync(responsePath, "utf8"));

const circuitInput = {
  disputeInputCommitment: response.dispute_input_commitment,
  policyId: response.policy_id,
  programMeasurementCommitment: response.program_measurement_commitment,
  requiredScore: response.required_score,
  evidenceCommitment: response.evidence_commitment,
  resultCommitment: response.result_commitment,
  outcome: response.outcome,
  expiresAt: response.expires_at,
  evidenceScore: request.evidence_score,
  evidenceNonce: request.evidence_nonce,
};

writeFileSync(outputPath, `${JSON.stringify(circuitInput, null, 2)}\n`);
