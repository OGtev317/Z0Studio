use core::num::traits::Zero;
use privacy::objects::OpenNoteDeposit;
use snforge_std::{
    ContractClassTrait, CustomToken, DeclareResultTrait, Token, TokenTrait, declare,
    start_cheat_block_timestamp,
};
use starknet::{ContractAddress, SyscallResultTrait};
use starkware_utils_testing::test_utils::{
    Deployable, TokenConfig, TokenHelperTrait, assert_panic_with_felt_error,
    cheat_caller_address_once,
};
use super::super::gigstark_passport::PASSPORT_PURPOSE_SUBSCRIPTION_ROLE;
use super::super::subscriptions::{
    IGigstarkSubscriptionsDispatcher, IGigstarkSubscriptionsDispatcherTrait,
    IGigstarkSubscriptionsSafeDispatcher, IGigstarkSubscriptionsSafeDispatcherTrait,
    MAX_PREPAID_PERIODS, SUB_OP_CANCEL, SUB_OP_CLAIM, SUB_OP_EXPIRE, SUB_OP_PREPAY, SUB_OP_START,
    SUB_ROLE_CREATOR, SUB_ROLE_MEMBER, SUB_ROLE_NONE, SUB_STATUS_CANCELLED, SUB_STATUS_EXPIRED,
    errors as subscription_errors,
};
use super::super::test_contracts::{
    IMockAuthorizationControlDispatcher, IMockAuthorizationControlDispatcherTrait,
};
use super::super::{GigstarkPassportProof, empty_gigstark_passport_proof};

const PRIVACY_POOL: felt252 = 'PRIVACY_POOL';
const MEMBER_COMMITMENT: felt252 = 'MEMBER_ROLE';
const CREATOR_COMMITMENT: felt252 = 'CREATOR_ROLE';
const SUBSCRIPTION_ID: felt252 = 'SUBSCRIPTION_ONE';
const TIER: felt252 = 'STUDIO_TIER';
const AMOUNT: u128 = 25;
const PERIOD_END: u64 = 2_000;

#[derive(Copy, Drop)]
struct SubscriptionContext {
    subscription_address: ContractAddress,
    verifier_address: ContractAddress,
    token: Token,
}

#[generate_trait]
impl SubscriptionContextImpl of SubscriptionContextTrait {
    fn contract(self: @SubscriptionContext) -> IGigstarkSubscriptionsDispatcher {
        IGigstarkSubscriptionsDispatcher { contract_address: *self.subscription_address }
    }

    #[feature("safe_dispatcher")]
    fn safe_contract(self: @SubscriptionContext) -> IGigstarkSubscriptionsSafeDispatcher {
        IGigstarkSubscriptionsSafeDispatcher { contract_address: *self.subscription_address }
    }

    fn invoke(
        self: @SubscriptionContext,
        operation: u8,
        actor_role: u8,
        token: ContractAddress,
        amount: u128,
        member_commitment: felt252,
        creator_commitment: felt252,
        tier: felt252,
        period_ends_at: u64,
        periods: u8,
        note_id: felt252,
        proof: GigstarkPassportProof,
    ) -> Span<OpenNoteDeposit> {
        cheat_caller_address_once(
            contract_address: *self.subscription_address, caller_address: privacy_pool(),
        );
        self
            .contract()
            .privacy_invoke(
                operation,
                SUBSCRIPTION_ID,
                actor_role,
                token,
                amount,
                member_commitment,
                creator_commitment,
                tier,
                period_ends_at,
                periods,
                note_id,
                proof,
            )
    }

    fn authorize(
        self: @SubscriptionContext,
        operation: u8,
        payload: felt252,
        commitment: felt252,
        digest: felt252,
    ) -> GigstarkPassportProof {
        let statement = self.contract().get_action_statement(SUBSCRIPTION_ID, operation, payload);
        IMockAuthorizationControlDispatcher { contract_address: *self.verifier_address }
            .set_authorized(commitment, statement, digest, true);
        mock_proof(digest)
    }

    fn start(self: @SubscriptionContext) {
        self.token.supply(address: *self.subscription_address, amount: AMOUNT);
        self
            .invoke(
                SUB_OP_START,
                SUB_ROLE_NONE,
                self.token.contract_address(),
                AMOUNT,
                MEMBER_COMMITMENT,
                CREATOR_COMMITMENT,
                TIER,
                PERIOD_END,
                1,
                0,
                empty_gigstark_passport_proof(),
            );
    }
}

fn setup() -> SubscriptionContext {
    let verifier_class = declare(contract: "MockAuthorizationVerifier")
        .unwrap_syscall()
        .contract_class();
    let (verifier_address, _) = verifier_class.deploy(@array![]).unwrap_syscall();
    let contract_class = declare(contract: "GigstarkSubscriptions")
        .unwrap_syscall()
        .contract_class();
    let (subscription_address, _) = contract_class
        .deploy(@array![PRIVACY_POOL, verifier_address.into()])
        .unwrap_syscall();
    let token_config = TokenConfig {
        name: "Subscription Token",
        symbol: "SUB",
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
    SubscriptionContext { subscription_address, verifier_address, token }
}

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

fn mock_proof(digest: felt252) -> GigstarkPassportProof {
    let mut proof = empty_gigstark_passport_proof();
    proof.policy_id = 'MOCK_SUB_POLICY';
    proof.purpose = PASSPORT_PURPOSE_SUBSCRIPTION_ROLE;
    proof.proof_commitment = digest;
    proof
}

#[test]
#[feature("safe_dispatcher")]
fn test_one_period_creator_claim_and_double_claim_failure() {
    let context = setup();
    context.start();
    let proof = context.authorize(SUB_OP_CLAIM, 'CREATOR_NOTE', CREATOR_COMMITMENT, 'CLAIM_ONE');
    let deposits = context
        .invoke(
            SUB_OP_CLAIM, SUB_ROLE_CREATOR, Zero::zero(), 0, 0, 0, 0, 0, 0, 'CREATOR_NOTE', proof,
        );
    assert_eq!(deposits.len(), 1);
    assert_eq!(*deposits[0].amount, AMOUNT);

    let duplicate_proof = context
        .authorize(SUB_OP_CLAIM, 'SECOND_NOTE', CREATOR_COMMITMENT, 'CLAIM_TWO');
    cheat_caller_address_once(
        contract_address: context.subscription_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_contract()
        .privacy_invoke(
            SUB_OP_CLAIM,
            SUBSCRIPTION_ID,
            SUB_ROLE_CREATOR,
            Zero::zero(),
            0,
            0,
            0,
            0,
            0,
            0,
            'SECOND_NOTE',
            duplicate_proof,
        );
    assert_panic_with_felt_error(result, subscription_errors::NO_CLAIMABLE_PERIOD);
}

#[test]
#[feature("safe_dispatcher")]
fn test_cross_purpose_receipt_fails_at_subscription_boundary() {
    let context = setup();
    context.start();
    let mut proof = context
        .authorize(SUB_OP_CLAIM, 'WRONG_PURPOSE_NOTE', CREATOR_COMMITMENT, 'WRONG_PURPOSE_SUB');
    proof.purpose = 1;
    cheat_caller_address_once(
        contract_address: context.subscription_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_contract()
        .privacy_invoke(
            SUB_OP_CLAIM,
            SUBSCRIPTION_ID,
            SUB_ROLE_CREATOR,
            Zero::zero(),
            0,
            0,
            0,
            0,
            0,
            0,
            'WRONG_PURPOSE_NOTE',
            proof,
        );
    assert_panic_with_felt_error(result, subscription_errors::INVALID_PROOF_PURPOSE);
}

#[test]
#[feature("safe_dispatcher")]
fn test_prepayment_bound_is_three_periods() {
    let context = setup();
    context.start();
    context.token.supply(address: context.subscription_address, amount: AMOUNT * 2);
    let proof = context.authorize(SUB_OP_PREPAY, 2, MEMBER_COMMITMENT, 'PREPAY_TWO');
    context
        .invoke(
            SUB_OP_PREPAY,
            SUB_ROLE_MEMBER,
            context.token.contract_address(),
            AMOUNT * 2,
            0,
            0,
            0,
            PERIOD_END * 3,
            2,
            0,
            proof,
        );
    assert_eq!(
        context.contract().get_subscription(SUBSCRIPTION_ID).prepaid_periods, MAX_PREPAID_PERIODS,
    );
    assert_eq!(context.contract().get_subscription(SUBSCRIPTION_ID).period_ends_at, PERIOD_END * 3);

    context.token.supply(address: context.subscription_address, amount: AMOUNT);
    let overflow_proof = context.authorize(SUB_OP_PREPAY, 1, MEMBER_COMMITMENT, 'PREPAY_OVER');
    cheat_caller_address_once(
        contract_address: context.subscription_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_contract()
        .privacy_invoke(
            SUB_OP_PREPAY,
            SUBSCRIPTION_ID,
            SUB_ROLE_MEMBER,
            context.token.contract_address(),
            AMOUNT,
            0,
            0,
            0,
            0,
            1,
            0,
            overflow_proof,
        );
    assert_panic_with_felt_error(result, subscription_errors::PREPAY_BOUND);
}

#[test]
#[feature("safe_dispatcher")]
fn test_cancellation_halts_new_prepayment() {
    let context = setup();
    context.start();
    let cancel_proof = context.authorize(SUB_OP_CANCEL, 0, MEMBER_COMMITMENT, 'CANCEL');
    context.invoke(SUB_OP_CANCEL, SUB_ROLE_MEMBER, Zero::zero(), 0, 0, 0, 0, 0, 0, 0, cancel_proof);
    assert_eq!(context.contract().get_subscription(SUBSCRIPTION_ID).status, SUB_STATUS_CANCELLED);

    context.token.supply(address: context.subscription_address, amount: AMOUNT);
    let prepay_proof = context.authorize(SUB_OP_PREPAY, 1, MEMBER_COMMITMENT, 'AFTER_CANCEL');
    cheat_caller_address_once(
        contract_address: context.subscription_address, caller_address: privacy_pool(),
    );
    let result = context
        .safe_contract()
        .privacy_invoke(
            SUB_OP_PREPAY,
            SUBSCRIPTION_ID,
            SUB_ROLE_MEMBER,
            context.token.contract_address(),
            AMOUNT,
            0,
            0,
            0,
            0,
            1,
            0,
            prepay_proof,
        );
    assert_panic_with_felt_error(result, subscription_errors::INVALID_STATE);
}

#[test]
#[feature("safe_dispatcher")]
fn test_expiry_requires_period_end() {
    let context = setup();
    context.start();
    cheat_caller_address_once(
        contract_address: context.subscription_address, caller_address: privacy_pool(),
    );
    let early = context
        .safe_contract()
        .privacy_invoke(
            SUB_OP_EXPIRE,
            SUBSCRIPTION_ID,
            SUB_ROLE_NONE,
            Zero::zero(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            empty_gigstark_passport_proof(),
        );
    assert_panic_with_felt_error(early, subscription_errors::NOT_EXPIRED);

    start_cheat_block_timestamp(context.subscription_address, PERIOD_END);
    context
        .invoke(
            SUB_OP_EXPIRE,
            SUB_ROLE_NONE,
            Zero::zero(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            empty_gigstark_passport_proof(),
        );
    assert_eq!(context.contract().get_subscription(SUBSCRIPTION_ID).status, SUB_STATUS_EXPIRED);
}

#[test]
#[feature("safe_dispatcher")]
fn test_wrong_pool_caller_fails() {
    let context = setup();
    let result = context
        .safe_contract()
        .privacy_invoke(
            SUB_OP_START,
            SUBSCRIPTION_ID,
            SUB_ROLE_NONE,
            context.token.contract_address(),
            AMOUNT,
            MEMBER_COMMITMENT,
            CREATOR_COMMITMENT,
            TIER,
            PERIOD_END,
            1,
            0,
            empty_gigstark_passport_proof(),
        );
    assert_panic_with_felt_error(result, subscription_errors::ONLY_PRIVACY_POOL);
}
