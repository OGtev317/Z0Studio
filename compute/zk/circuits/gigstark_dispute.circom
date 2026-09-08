pragma circom 2.2.3;

include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/poseidon.circom";

template GigstarkDispute() {
    // Canonical public-signal order. Do not reorder without a new policy ID.
    signal input disputeInputCommitment;
    signal input policyId;
    signal input programMeasurementCommitment;
    signal input requiredScore;
    signal input evidenceCommitment;
    signal input resultCommitment;
    signal input outcome;
    signal input expiresAt;

    // Synthetic specimen witness. Real evidence never belongs in source control.
    signal input evidenceScore;
    signal input evidenceNonce;

    component scoreInRange = LessThan(7);
    scoreInRange.in[0] <== evidenceScore;
    scoreInRange.in[1] <== 101;
    scoreInRange.out === 1;

    component thresholdInRange = LessThan(7);
    thresholdInRange.in[0] <== requiredScore;
    thresholdInRange.in[1] <== 101;
    thresholdInRange.out === 1;

    component scoreBelowThreshold = LessThan(7);
    scoreBelowThreshold.in[0] <== evidenceScore;
    scoreBelowThreshold.in[1] <== requiredScore;
    outcome === 2 - scoreBelowThreshold.out;

    component evidenceHash = Poseidon(2);
    evidenceHash.inputs[0] <== evidenceScore;
    evidenceHash.inputs[1] <== evidenceNonce;
    evidenceHash.out === evidenceCommitment;

    component resultHash = Poseidon(6);
    resultHash.inputs[0] <== disputeInputCommitment;
    resultHash.inputs[1] <== policyId;
    resultHash.inputs[2] <== programMeasurementCommitment;
    resultHash.inputs[3] <== evidenceCommitment;
    resultHash.inputs[4] <== outcome;
    resultHash.inputs[5] <== expiresAt;
    resultHash.out === resultCommitment;
}

component main { public [
    disputeInputCommitment,
    policyId,
    programMeasurementCommitment,
    requiredScore,
    evidenceCommitment,
    resultCommitment,
    outcome,
    expiresAt
] } = GigstarkDispute();
