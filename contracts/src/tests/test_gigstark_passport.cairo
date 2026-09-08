use core::num::traits::Zero;
use privacy::objects::OpenNoteDeposit;
use snforge_std::signature::stark_curve::{
    StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl,
};
use snforge_std::{
    ContractClassTrait, CustomToken, DeclareResultTrait, Token, TokenTrait, declare,
    start_cheat_block_timestamp,
};
use starknet::{ContractAddress, SyscallResultTrait};
use starkware_utils_testing::test_utils::{
    Deployable, TokenConfig, TokenHelperTrait, assert_panic_with_felt_error,
    cheat_caller_address_once,
};
use super::super::gigstark_passport::{
    IGigstarkPassportVerifierDispatcher, IGigstarkPassportVerifierDispatcherTrait,
    IGigstarkPassportVerifierSafeDispatcher, IGigstarkPassportVerifierSafeDispatcherTrait,
    PASSPORT_PURPOSE_ESCROW_ROLE, errors as passport_errors,
};
use super::super::{
    GigstarkPassportProof, IGigstarkEscrowDispatcher, IGigstarkEscrowDispatcherTrait,
    IGigstarkEscrowSafeDispatcher, IGigstarkEscrowSafeDispatcherTrait, OP_CONFIRM_DELIVERY,
    OP_DEPOSIT, OP_SUBMIT_DELIVERY, ROLE_BUYER, ROLE_NONE, ROLE_SELLER,
    empty_gigstark_passport_proof, errors as escrow_errors,
};

const PRIVACY_POOL: felt252 = 'PRIVACY_POOL';
const COMPUTE_VERIFIER: felt252 = 'COMPUTE_VERIFIER';
const ADMIN: felt252 = 'PASSPORT_ADMIN';
const POLICY_ID: felt252 = 'GIGSTARK_ESCROW_POLICY';
const CREDENTIAL_CLASS: felt252 = 'GIGSTARK_ROLE';
const BUYER_COMMITMENT: felt252 = 'BUYER_ROLE';
const SELLER_COMMITMENT: felt252 = 'SELLER_ROLE';
const ESCROW_ID: felt252 = 'PASSPORT_ESCROW';
const DELIVERY: felt252 = 'DELIVERY_HASH';
const AMOUNT: u128 = 100;
const NOW: u64 = 1_000;
const POLICY_START: u64 = 900;
const POLICY_END: u64 = 1_200;
const DEADLINE: u64 = 1_100;
const STARK_CURVE_ORDER: felt252 =
    0x800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2f;
const STARK_CURVE_HALF_ORDER: felt252 =
    0x4000000000000087fffffffffffffffdbc08936e573d9190f335120d6e32697;

#[derive(Copy, Drop)]
struct PassportContext {
    escrow_address: ContractAddress,
    verifier_address: ContractAddress,
    token: Token,
    attestor: StarkCurveKeyPair,
}

#[generate_trait]
impl PassportContextImpl of PassportContextTrait {
    fn escrow(self: @PassportContext) -> IGigstarkEscrowDispatcher {
        IGigstarkEscrowDispatcher { contract_address: *self.escrow_address }
    }

    #[feature("safe_dispatcher")]
    fn safe_escrow(self: @PassportContext) -> IGigstarkEscrowSafeDispatcher {
        IGigstarkEscrowSafeDispatcher { contract_address: *self.escrow_address }
    }

    fn passport(self: @PassportContext) -> IGigstarkPassportVerifierDispatcher {
        IGigstarkPassportVerifierDispatcher { contract_address: *self.verifier_address }
    }

    #[feature("safe_dispatcher")]
    fn safe_passport(self: @PassportContext) -> IGigstarkPassportVerifierSafeDispatcher {
        IGigstarkPassportVerifierSafeDispatcher { contract_address: *self.verifier_address }
    }

    fn deposit(self: @PassportContext) {
        self.token.supply(address: *self.escrow_address, amount: AMOUNT);
        cheat_caller_address_once(
            contract_address: *self.escrow_address, caller_address: privacy_pool(),
        );
        let deposits = self
            .escrow()
            .privacy_invoke(
                OP_DEPOSIT,
                ESCROW_ID,
                ROLE_NONE,
                self.token.contract_address(),
                AMOUNT,
                BUYER_COMMITMENT,
                SELLER_COMMITMENT,
                0,
                DEADLINE,
                0,
                empty_gigstark_passport_proof(),
            );
        assert(deposits.is_empty(), 'DEPOSIT_NOT_EMPTY');
    }

    fn signed_proof(
        self: @PassportContext,
        role_commitment: felt252,
        action_statement: felt252,
        audience: ContractAddress,
        nullifier: felt252,
        expires_at: u64,
    ) -> GigstarkPassportProof {
        let mut proof = GigstarkPassportProof {
            policy_id: POLICY_ID,
            audience,
            purpose: PASSPORT_PURPOSE_ESCROW_ROLE,
            credential_class: CREDENTIAL_CLASS,
            scope_nullifier: nullifier,
            proof_commitment: 'OPAQUE_ZK_COMMITMENT',
            issued_at: NOW - 1,
            expires_at,
            signature_r: 0,
            signature_s: 0,
        };
        let digest = self
            .passport()
            .get_authorization_digest(role_commitment, action_statement, proof);
        let (signature_r, signature_s) = self.attestor.sign(digest).unwrap();
        proof.signature_r = signature_r;
        proof.signature_s = canonical_s(signature_s);
        proof
    }

    fn invoke_delivery(
        self: @PassportContext, proof: GigstarkPassportProof,
    ) -> Span<OpenNoteDeposit> {
        cheat_caller_address_once(
            contract_address: *self.escrow_address, caller_address: privacy_pool(),
        );
        self
            .escrow()
            .privacy_invoke(
                OP_SUBMIT_DELIVERY,
                ESCROW_ID,
                ROLE_SELLER,
                Zero::zero(),
                0,
                0,
                0,
                DELIVERY,
                0,
                0,
                proof,
            )
    }
}

fn setup() -> PassportContext {
    let attestor = StarkCurveKeyPairImpl::from_secret_key('ATTESTOR_SECRET');
    let verifier_class = declare(contract: "GigstarkPassportVerifier")
        .unwrap_syscall()
        .contract_class();
    let (verifier_address, _) = verifier_class.deploy(@array![ADMIN]).unwrap_syscall();

    let escrow_class = declare(contract: "GigstarkEscrow").unwrap_syscall().contract_class();
    let (escrow_address, _) = escrow_class
        .deploy(@array![PRIVACY_POOL, COMPUTE_VERIFIER, verifier_address.into()])
        .unwrap_syscall();

    cheat_caller_address_once(
        contract_address: verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    IGigstarkPassportVerifierDispatcher { contract_address: verifier_address }
        .set_policy(
            POLICY_ID,
            escrow_address,
            PASSPORT_PURPOSE_ESCROW_ROLE,
            CREDENTIAL_CLASS,
            POLICY_START,
            POLICY_END,
            attestor.public_key,
        );
    let configured_policy = IGigstarkPassportVerifierDispatcher {
        contract_address: verifier_address,
    }
        .get_policy(POLICY_ID);
    assert(!configured_policy.active, 'POLICY_NOT_STAGED');
    cheat_caller_address_once(
        contract_address: verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    IGigstarkPassportVerifierDispatcher { contract_address: verifier_address }
        .set_policy_active(POLICY_ID, true);

    start_cheat_block_timestamp(escrow_address, NOW);
    start_cheat_block_timestamp(verifier_address, NOW);

    let token_config = TokenConfig {
        name: "Gigstark Passport Token",
        symbol: "GPT",
        decimals: 18,
        initial_supply: 0,
        owner: 'TOKEN_OWNER'.try_into().unwrap(),
    };
    let deployed_token = token_config.deploy();
    let token = Token::Custom(
        CustomToken {
            contract_address: deployed_token.address,
            balances_variable_selector: selector!("ERC20_balances"),
        },
    );

    PassportContext { escrow_address, verifier_address, token, attestor }
}

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
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
fn test_valid_passport_receipt_authorizes_seller_delivery() {
    let context = setup();
    context.deposit();
    let statement = context.escrow().get_action_statement(ESCROW_ID, OP_SUBMIT_DELIVERY, DELIVERY);
    let proof = context
        .signed_proof(
            SELLER_COMMITMENT, statement, context.escrow_address, 'SELLER_DELIVERY_ONCE', NOW + 50,
        );
    context.invoke_delivery(proof);
    assert(
        context.passport().is_nullifier_used(POLICY_ID, 'SELLER_DELIVERY_ONCE'),
        'NULLIFIER_NOT_USED',
    );
}

#[test]
#[feature("safe_dispatcher")]
fn test_wrong_audience_fails() {
    let context = setup();
    context.deposit();
    let statement = context.escrow().get_action_statement(ESCROW_ID, OP_SUBMIT_DELIVERY, DELIVERY);
    let proof = context
        .signed_proof(
            SELLER_COMMITMENT,
            statement,
            'WRONG_AUDIENCE'.try_into().unwrap(),
            'WRONG_AUDIENCE_NULLIFIER',
            NOW + 50,
        );
    cheat_caller_address_once(
        contract_address: context.escrow_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_escrow()
        .privacy_invoke(
            OP_SUBMIT_DELIVERY,
            ESCROW_ID,
            ROLE_SELLER,
            Zero::zero(),
            0,
            0,
            0,
            DELIVERY,
            0,
            0,
            proof,
        );
    assert_panic_with_felt_error(result, passport_errors::AUDIENCE_MISMATCH);
}

#[test]
#[feature("safe_dispatcher")]
fn test_wrong_role_fails_signature_binding() {
    let context = setup();
    context.deposit();
    let statement = context.escrow().get_action_statement(ESCROW_ID, OP_SUBMIT_DELIVERY, DELIVERY);
    let proof = context
        .signed_proof(
            BUYER_COMMITMENT, statement, context.escrow_address, 'WRONG_ROLE_NULLIFIER', NOW + 50,
        );
    cheat_caller_address_once(
        contract_address: context.escrow_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_escrow()
        .privacy_invoke(
            OP_SUBMIT_DELIVERY,
            ESCROW_ID,
            ROLE_SELLER,
            Zero::zero(),
            0,
            0,
            0,
            DELIVERY,
            0,
            0,
            proof,
        );
    assert_panic_with_felt_error(result, passport_errors::INVALID_SIGNATURE);
}

#[test]
#[feature("safe_dispatcher")]
fn test_cross_purpose_receipt_fails_at_escrow_boundary() {
    let context = setup();
    context.deposit();
    let statement = context.escrow().get_action_statement(ESCROW_ID, OP_SUBMIT_DELIVERY, DELIVERY);
    let mut proof = context
        .signed_proof(
            SELLER_COMMITMENT,
            statement,
            context.escrow_address,
            'WRONG_PURPOSE_NULLIFIER',
            NOW + 50,
        );
    proof.purpose = 2;
    cheat_caller_address_once(
        contract_address: context.escrow_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_escrow()
        .privacy_invoke(
            OP_SUBMIT_DELIVERY,
            ESCROW_ID,
            ROLE_SELLER,
            Zero::zero(),
            0,
            0,
            0,
            DELIVERY,
            0,
            0,
            proof,
        );
    assert_panic_with_felt_error(result, escrow_errors::INVALID_PROOF_PURPOSE);
}

#[test]
#[feature("safe_dispatcher")]
fn test_expired_receipt_fails() {
    let context = setup();
    context.deposit();
    let statement = context.escrow().get_action_statement(ESCROW_ID, OP_SUBMIT_DELIVERY, DELIVERY);
    let proof = context
        .signed_proof(
            SELLER_COMMITMENT, statement, context.escrow_address, 'EXPIRED_NULLIFIER', NOW,
        );
    cheat_caller_address_once(
        contract_address: context.escrow_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_escrow()
        .privacy_invoke(
            OP_SUBMIT_DELIVERY,
            ESCROW_ID,
            ROLE_SELLER,
            Zero::zero(),
            0,
            0,
            0,
            DELIVERY,
            0,
            0,
            proof,
        );
    assert_panic_with_felt_error(result, passport_errors::RECEIPT_EXPIRED);
}

#[test]
#[feature("safe_dispatcher")]
fn test_revoked_policy_fails() {
    let context = setup();
    context.deposit();
    let statement = context.escrow().get_action_statement(ESCROW_ID, OP_SUBMIT_DELIVERY, DELIVERY);
    let proof = context
        .signed_proof(
            SELLER_COMMITMENT, statement, context.escrow_address, 'REVOKED_NULLIFIER', NOW + 50,
        );
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    context.passport().set_policy_active(POLICY_ID, false);

    cheat_caller_address_once(
        contract_address: context.escrow_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_escrow()
        .privacy_invoke(
            OP_SUBMIT_DELIVERY,
            ESCROW_ID,
            ROLE_SELLER,
            Zero::zero(),
            0,
            0,
            0,
            DELIVERY,
            0,
            0,
            proof,
        );
    assert_panic_with_felt_error(result, passport_errors::POLICY_INACTIVE);
}

#[test]
#[feature("safe_dispatcher")]
fn test_policy_id_is_immutable_after_configuration() {
    let context = setup();
    cheat_caller_address_once(
        contract_address: context.verifier_address, caller_address: ADMIN.try_into().unwrap(),
    );
    let result = context
        .safe_passport()
        .set_policy(
            POLICY_ID,
            context.escrow_address,
            PASSPORT_PURPOSE_ESCROW_ROLE,
            CREDENTIAL_CLASS,
            POLICY_START,
            POLICY_END,
            context.attestor.public_key,
        );
    assert_panic_with_felt_error(result, passport_errors::POLICY_EXISTS);
}

#[test]
#[feature("safe_dispatcher")]
fn test_scope_nullifier_replay_fails_across_actions() {
    let context = setup();
    context.deposit();
    let delivery_statement = context
        .escrow()
        .get_action_statement(ESCROW_ID, OP_SUBMIT_DELIVERY, DELIVERY);
    let delivery_proof = context
        .signed_proof(
            SELLER_COMMITMENT,
            delivery_statement,
            context.escrow_address,
            'SHARED_NULLIFIER',
            NOW + 50,
        );
    context.invoke_delivery(delivery_proof);

    let confirm_statement = context
        .escrow()
        .get_action_statement(ESCROW_ID, OP_CONFIRM_DELIVERY, 0);
    let confirm_proof = context
        .signed_proof(
            BUYER_COMMITMENT,
            confirm_statement,
            context.escrow_address,
            'SHARED_NULLIFIER',
            NOW + 50,
        );
    cheat_caller_address_once(
        contract_address: context.escrow_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_escrow()
        .privacy_invoke(
            OP_CONFIRM_DELIVERY,
            ESCROW_ID,
            ROLE_BUYER,
            Zero::zero(),
            0,
            0,
            0,
            0,
            0,
            0,
            confirm_proof,
        );
    assert_panic_with_felt_error(result, passport_errors::NULLIFIER_USED);
}
