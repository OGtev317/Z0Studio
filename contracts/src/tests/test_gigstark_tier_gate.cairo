use snforge_std::signature::stark_curve::{
    StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl,
};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp};
use starknet::{ContractAddress, SyscallResultTrait};
use starkware_utils_testing::test_utils::{assert_panic_with_felt_error, cheat_caller_address_once};
use super::super::GigstarkPassportProof;
use super::super::gigstark_passport::{
    IGigstarkPassportVerifierDispatcher, IGigstarkPassportVerifierDispatcherTrait,
    PASSPORT_PURPOSE_TIER_ACCESS, errors as passport_errors,
};
use super::super::tier_gate::{
    IGigstarkTierGateDispatcher, IGigstarkTierGateDispatcherTrait, IGigstarkTierGateSafeDispatcher,
    IGigstarkTierGateSafeDispatcherTrait,
};

const ADMIN: felt252 = 'TIER_ADMIN';
const POLICY_ID: felt252 = 'GIGSTARK_TIER_POLICY';
const CREDENTIAL_CLASS: felt252 = 'GIGSTARK_TIER_CREDENTIAL';
const VIEWER_COMMITMENT: felt252 = 'UNLINKABLE_VIEWER';
const TIER: felt252 = 'STUDIO_TIER';
const ACCESS_SCOPE: felt252 = 'PRIVATE_RELEASE_42';
const NOW: u64 = 5_000;
const POLICY_START: u64 = 4_900;
const POLICY_END: u64 = 5_200;
const STARK_CURVE_ORDER: felt252 =
    0x800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2f;
const STARK_CURVE_HALF_ORDER: felt252 =
    0x4000000000000087fffffffffffffffdbc08936e573d9190f335120d6e32697;

#[derive(Copy, Drop)]
struct TierContext {
    gate_address: ContractAddress,
    verifier_address: ContractAddress,
    attestor: StarkCurveKeyPair,
}

#[generate_trait]
impl TierContextImpl of TierContextTrait {
    fn gate(self: @TierContext) -> IGigstarkTierGateDispatcher {
        IGigstarkTierGateDispatcher { contract_address: *self.gate_address }
    }

    #[feature("safe_dispatcher")]
    fn safe_gate(self: @TierContext) -> IGigstarkTierGateSafeDispatcher {
        IGigstarkTierGateSafeDispatcher { contract_address: *self.gate_address }
    }

    fn passport(self: @TierContext) -> IGigstarkPassportVerifierDispatcher {
        IGigstarkPassportVerifierDispatcher { contract_address: *self.verifier_address }
    }

    fn signed_proof(
        self: @TierContext, tier: felt252, access_scope: felt252, nullifier: felt252,
    ) -> GigstarkPassportProof {
        let statement = self.gate().get_access_statement(tier, access_scope);
        let mut proof = GigstarkPassportProof {
            policy_id: POLICY_ID,
            audience: *self.gate_address,
            purpose: PASSPORT_PURPOSE_TIER_ACCESS,
            credential_class: CREDENTIAL_CLASS,
            scope_nullifier: nullifier,
            proof_commitment: 'OPAQUE_TIER_PROOF',
            issued_at: NOW - 1,
            expires_at: NOW + 50,
            signature_r: 0,
            signature_s: 0,
        };
        let digest = self.passport().get_authorization_digest(VIEWER_COMMITMENT, statement, proof);
        let (signature_r, signature_s) = self.attestor.sign(digest).unwrap();
        proof.signature_r = signature_r;
        proof.signature_s = canonical_s(signature_s);
        proof
    }
}

fn setup() -> TierContext {
    let attestor = StarkCurveKeyPairImpl::from_secret_key('TIER_ATTESTOR_SECRET');
    let verifier_class = declare(contract: "GigstarkPassportVerifier")
        .unwrap_syscall()
        .contract_class();
    let (verifier_address, _) = verifier_class.deploy(@array![ADMIN]).unwrap_syscall();
    let gate_class = declare(contract: "GigstarkTierGate").unwrap_syscall().contract_class();
    let (gate_address, _) = gate_class.deploy(@array![verifier_address.into()]).unwrap_syscall();

    cheat_caller_address_once(
        contract_address: verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    IGigstarkPassportVerifierDispatcher { contract_address: verifier_address }
        .set_policy(
            POLICY_ID,
            gate_address,
            PASSPORT_PURPOSE_TIER_ACCESS,
            CREDENTIAL_CLASS,
            POLICY_START,
            POLICY_END,
            attestor.public_key,
        );
    cheat_caller_address_once(
        contract_address: verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    IGigstarkPassportVerifierDispatcher { contract_address: verifier_address }
        .set_policy_active(POLICY_ID, true);
    start_cheat_block_timestamp(verifier_address, NOW);
    start_cheat_block_timestamp(gate_address, NOW);
    TierContext { gate_address, verifier_address, attestor }
}

fn canonical_s(signature_s: felt252) -> felt252 {
    let signature_s_u256: u256 = signature_s.into();
    let half_order_u256: u256 = STARK_CURVE_HALF_ORDER.into();
    if signature_s_u256 > half_order_u256 {
        STARK_CURVE_ORDER - signature_s
    } else {
        signature_s
    }
}

#[test]
#[feature("safe_dispatcher")]
fn test_tier_proof_is_audience_bound_and_one_use() {
    let context = setup();
    let proof = context.signed_proof(TIER, ACCESS_SCOPE, 'TIER_ACCESS_ONCE');
    assert(
        context.gate().verify_access(VIEWER_COMMITMENT, TIER, ACCESS_SCOPE, proof),
        'ACCESS_NOT_AUTHORIZED',
    );
    let replay = context.safe_gate().verify_access(VIEWER_COMMITMENT, TIER, ACCESS_SCOPE, proof);
    assert_panic_with_felt_error(replay, passport_errors::NULLIFIER_USED);
}

#[test]
#[feature("safe_dispatcher")]
fn test_tier_or_scope_substitution_fails_signature_binding() {
    let context = setup();
    let proof = context.signed_proof(TIER, ACCESS_SCOPE, 'TIER_SCOPE_BINDING');
    let result = context
        .safe_gate()
        .verify_access(VIEWER_COMMITMENT, 'WRONG_TIER', ACCESS_SCOPE, proof);
    assert_panic_with_felt_error(result, passport_errors::INVALID_SIGNATURE);
}
