use snforge_std::{ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp};
use starknet::{ContractAddress, SyscallResultTrait};
use starkware_utils_testing::test_utils::{assert_panic_with_felt_error, cheat_caller_address_once};
use super::super::compute_verifier::{
    COMPUTE_OUTCOME_BUYER, GigstarkZkResult, IGigstarkComputeVerifierDispatcher,
    IGigstarkComputeVerifierDispatcherTrait, IGigstarkComputeVerifierSafeDispatcher,
    IGigstarkComputeVerifierSafeDispatcherTrait, errors,
};

const ADMIN: felt252 = 'COMPUTE_ADMIN';
const AUDIENCE: felt252 = 'ESCROW_AUDIENCE';
const POLICY_ID: felt252 = 'COMPUTE_POLICY';
const PROGRAM_COMMITMENT: felt252 = 'DISPUTE_PROGRAM_V1';
const COMPUTE_POLICY_HASH: felt252 = 'DISPUTE_POLICY_V1';
const REQUIRED_SCORE: u8 = 80;
const JOB_ID: felt252 = 'ESCROW_DISPUTE_1';
const INPUT_COMMITMENT: felt252 = 'BOUND_ESCROW_INPUT';
const POLICY_START: u64 = 900;
const POLICY_END: u64 = 1_200;
const NOW: u64 = 1_000;

#[derive(Copy, Drop)]
struct ComputeContext {
    verifier_address: ContractAddress,
}

#[generate_trait]
impl ComputeContextImpl of ComputeContextTrait {
    fn verifier(self: @ComputeContext) -> IGigstarkComputeVerifierDispatcher {
        IGigstarkComputeVerifierDispatcher { contract_address: *self.verifier_address }
    }

    #[feature("safe_dispatcher")]
    fn safe_verifier(self: @ComputeContext) -> IGigstarkComputeVerifierSafeDispatcher {
        IGigstarkComputeVerifierSafeDispatcher { contract_address: *self.verifier_address }
    }

    fn result(self: @ComputeContext, oyster_receipt_commitment: u256) -> GigstarkZkResult {
        GigstarkZkResult {
            policy_id: POLICY_ID,
            audience: audience(),
            job_id: JOB_ID,
            input_commitment: INPUT_COMMITMENT,
            evidence_commitment: 111_u256,
            result_commitment: 222_u256,
            outcome: COMPUTE_OUTCOME_BUYER,
            expires_at: NOW + 50,
            oyster_receipt_commitment,
        }
    }

    fn consume(self: @ComputeContext, result: GigstarkZkResult) -> u8 {
        let proof = proof_for(result, 'VALID_ZK_PROOF', result.input_commitment);
        cheat_caller_address_once(
            contract_address: *self.verifier_address, caller_address: audience(),
        );
        self.verifier().consume_result(JOB_ID, INPUT_COMMITMENT, result, proof.span())
    }
}

fn setup() -> ComputeContext {
    let groth16_class = declare(contract: "MockGroth16VerifierBN254")
        .unwrap_syscall()
        .contract_class();
    let (groth16_address, _) = groth16_class.deploy(@array![]).unwrap_syscall();
    let verifier_class = declare(contract: "GigstarkComputeVerifier")
        .unwrap_syscall()
        .contract_class();
    let (verifier_address, _) = verifier_class.deploy(@array![ADMIN]).unwrap_syscall();
    let verifier = IGigstarkComputeVerifierDispatcher { contract_address: verifier_address };
    cheat_caller_address_once(
        contract_address: verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    verifier
        .set_policy(
            POLICY_ID,
            audience(),
            PROGRAM_COMMITMENT,
            COMPUTE_POLICY_HASH,
            REQUIRED_SCORE,
            POLICY_START,
            POLICY_END,
            groth16_address,
        );
    start_cheat_block_timestamp(verifier_address, NOW);
    ComputeContext { verifier_address }
}

fn audience() -> ContractAddress {
    AUDIENCE.try_into().unwrap()
}

fn proof_for(
    result: GigstarkZkResult, marker: felt252, input_commitment: felt252,
) -> Array<felt252> {
    array![
        marker,
        input_commitment,
        result.policy_id,
        PROGRAM_COMMITMENT,
        REQUIRED_SCORE.into(),
        result.evidence_commitment.low.into(),
        result.evidence_commitment.high.into(),
        result.result_commitment.low.into(),
        result.result_commitment.high.into(),
        result.outcome.into(),
        result.expires_at.into(),
    ]
}

#[test]
fn test_direct_zk_proof_is_consumed_once() {
    let context = setup();
    let result = context.result(333_u256);
    let nullifier = context.verifier().get_result_nullifier(result);
    assert_eq!(context.consume(result), COMPUTE_OUTCOME_BUYER);
    assert(context.verifier().is_nullifier_used(nullifier), 'NULLIFIER_UNUSED');
}

#[test]
fn test_oyster_receipt_is_optional_for_settlement() {
    let context = setup();
    assert_eq!(context.consume(context.result(0)), COMPUTE_OUTCOME_BUYER);
}

#[test]
#[feature("safe_dispatcher")]
fn test_rejected_zk_proof_fails() {
    let context = setup();
    let result = context.result(0);
    let proof = proof_for(result, 'INVALID_ZK_PROOF', result.input_commitment);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: audience(),
    );
    let rejected = context
        .safe_verifier()
        .consume_result(JOB_ID, INPUT_COMMITMENT, result, proof.span());
    assert_panic_with_felt_error(rejected, errors::PROOF_REJECTED);
}

#[test]
#[feature("safe_dispatcher")]
fn test_public_signal_substitution_fails() {
    let context = setup();
    let result = context.result(0);
    let proof = proof_for(result, 'VALID_ZK_PROOF', 'SUBSTITUTED_INPUT');
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: audience(),
    );
    let rejected = context
        .safe_verifier()
        .consume_result(JOB_ID, INPUT_COMMITMENT, result, proof.span());
    assert_panic_with_felt_error(rejected, errors::PUBLIC_SIGNAL_MISMATCH);
}

#[test]
#[feature("safe_dispatcher")]
fn test_compute_nullifier_replay_fails() {
    let context = setup();
    let result = context.result(0);
    context.consume(result);
    let proof = proof_for(result, 'VALID_ZK_PROOF', result.input_commitment);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: audience(),
    );
    let replay = context
        .safe_verifier()
        .consume_result(JOB_ID, INPUT_COMMITMENT, result, proof.span());
    assert_panic_with_felt_error(replay, errors::NULLIFIER_USED);
}

#[test]
#[feature("safe_dispatcher")]
fn test_wrong_job_and_input_fail_before_proof() {
    let context = setup();
    let result = context.result(0);
    let proof = proof_for(result, 'VALID_ZK_PROOF', result.input_commitment);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: audience(),
    );
    let wrong_job = context
        .safe_verifier()
        .consume_result('ANOTHER_JOB', INPUT_COMMITMENT, result, proof.span());
    assert_panic_with_felt_error(wrong_job, errors::JOB_MISMATCH);

    let proof = proof_for(result, 'VALID_ZK_PROOF', result.input_commitment);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: audience(),
    );
    let wrong_input = context
        .safe_verifier()
        .consume_result(JOB_ID, 'OTHER_INPUT', result, proof.span());
    assert_panic_with_felt_error(wrong_input, errors::INPUT_MISMATCH);
}

#[test]
#[feature("safe_dispatcher")]
fn test_revoked_policy_fails() {
    let context = setup();
    let result = context.result(0);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    context.verifier().set_policy_active(POLICY_ID, false);
    let proof = proof_for(result, 'VALID_ZK_PROOF', result.input_commitment);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: audience(),
    );
    let rejected = context
        .safe_verifier()
        .consume_result(JOB_ID, INPUT_COMMITMENT, result, proof.span());
    assert_panic_with_felt_error(rejected, errors::POLICY_INACTIVE);
}

#[test]
#[feature("safe_dispatcher")]
fn test_expired_result_fails() {
    let context = setup();
    let mut result = context.result(0);
    result.expires_at = NOW;
    let proof = proof_for(result, 'VALID_ZK_PROOF', result.input_commitment);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: audience(),
    );
    let rejected = context
        .safe_verifier()
        .consume_result(JOB_ID, INPUT_COMMITMENT, result, proof.span());
    assert_panic_with_felt_error(rejected, errors::RESULT_EXPIRED);
}

#[test]
fn test_oyster_binding_is_independent_of_receipt_hash() {
    let context = setup();
    let without_receipt = context.result(0);
    let with_receipt = context.result(333_u256);
    assert_eq!(
        context.verifier().get_oyster_binding(without_receipt),
        context.verifier().get_oyster_binding(with_receipt),
    );
}

#[test]
#[feature("safe_dispatcher")]
fn test_policy_id_cannot_be_reconfigured() {
    let context = setup();
    let policy = context.verifier().get_policy(POLICY_ID);
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    let rejected = context
        .safe_verifier()
        .set_policy(
            POLICY_ID,
            audience(),
            'SUBSTITUTED_PROGRAM',
            COMPUTE_POLICY_HASH,
            REQUIRED_SCORE,
            POLICY_START,
            POLICY_END,
            policy.zk_verifier,
        );
    assert_panic_with_felt_error(rejected, errors::INVALID_POLICY);
}
