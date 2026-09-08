//! Bounded, prepaid Gigstark creator subscriptions over the STRK20 helper pattern.

use privacy::objects::OpenNoteDeposit;
use starknet::ContractAddress;
use super::GigstarkPassportProof;

pub const SUB_OP_START: u8 = 0;
pub const SUB_OP_PREPAY: u8 = 1;
pub const SUB_OP_CANCEL: u8 = 2;
pub const SUB_OP_EXPIRE: u8 = 3;
pub const SUB_OP_CLAIM: u8 = 4;

pub const SUB_ROLE_NONE: u8 = 0;
pub const SUB_ROLE_MEMBER: u8 = 1;
pub const SUB_ROLE_CREATOR: u8 = 2;

pub const SUB_STATUS_NONE: u8 = 0;
pub const SUB_STATUS_ACTIVE: u8 = 1;
pub const SUB_STATUS_CANCELLED: u8 = 2;
pub const SUB_STATUS_EXPIRED: u8 = 3;

pub const MAX_PREPAID_PERIODS: u8 = 3;
pub const SUBSCRIPTION_ACTION_DOMAIN: felt252 = 'GIGSTARK_SUBSCRIPTION_V1';

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct SubscriptionRecord {
    pub member_commitment: felt252,
    pub creator_commitment: felt252,
    pub tier: felt252,
    pub token: ContractAddress,
    pub amount_per_period: u128,
    pub period_seconds: u64,
    pub period_ends_at: u64,
    pub prepaid_periods: u8,
    pub creator_claimed_periods: u8,
    pub status: u8,
    pub action_nonce: u64,
}

#[starknet::interface]
pub trait IGigstarkSubscriptions<TContractState> {
    fn get_subscription(self: @TContractState, subscription_id: felt252) -> SubscriptionRecord;
    fn get_action_statement(
        self: @TContractState, subscription_id: felt252, operation: u8, payload: felt252,
    ) -> felt252;
    fn get_accounted_balance(self: @TContractState, token: ContractAddress) -> u256;
    fn privacy_invoke(
        ref self: TContractState,
        operation: u8,
        subscription_id: felt252,
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
    ) -> Span<OpenNoteDeposit>;
}

pub mod errors {
    pub const ZERO_PRIVACY_POOL: felt252 = 'SUB_ZERO_POOL';
    pub const ZERO_AUTH_VERIFIER: felt252 = 'SUB_ZERO_VERIFIER';
    pub const ONLY_PRIVACY_POOL: felt252 = 'SUB_ONLY_POOL';
    pub const INVALID_OPERATION: felt252 = 'SUB_BAD_OPERATION';
    pub const INVALID_DATA: felt252 = 'SUB_BAD_DATA';
    pub const INVALID_ROLE: felt252 = 'SUB_BAD_ROLE';
    pub const INVALID_STATE: felt252 = 'SUB_BAD_STATE';
    pub const INVALID_SUBSCRIPTION: felt252 = 'SUB_BAD_ID';
    pub const SUBSCRIPTION_EXISTS: felt252 = 'SUB_EXISTS';
    pub const ZERO_COMMITMENT: felt252 = 'SUB_ZERO_ROLE';
    pub const SAME_COMMITMENT: felt252 = 'SUB_SAME_ROLE';
    pub const ZERO_TOKEN: felt252 = 'SUB_ZERO_TOKEN';
    pub const ZERO_AMOUNT: felt252 = 'SUB_ZERO_AMOUNT';
    pub const INVALID_PERIOD_END: felt252 = 'SUB_BAD_PERIOD_END';
    pub const PREPAY_BOUND: felt252 = 'SUB_PREPAY_BOUND';
    pub const AMOUNT_OVERFLOW: felt252 = 'SUB_AMOUNT_OVERFLOW';
    pub const INSUFFICIENT_BALANCE: felt252 = 'SUB_INSUFFICIENT';
    pub const BALANCE_UNDERFLOW: felt252 = 'SUB_BAL_UNDERFLOW';
    pub const NOT_EXPIRED: felt252 = 'SUB_NOT_EXPIRED';
    pub const NO_CLAIMABLE_PERIOD: felt252 = 'SUB_NO_CLAIM';
    pub const ZERO_NOTE_ID: felt252 = 'SUB_ZERO_NOTE';
    pub const ZERO_AUTHORIZATION: felt252 = 'SUB_ZERO_AUTH';
    pub const NOT_AUTHORIZED: felt252 = 'SUB_NOT_AUTH';
    pub const INVALID_PROOF_PURPOSE: felt252 = 'SUB_BAD_PROOF_PURPOSE';
}

#[starknet::contract]
pub mod GigstarkSubscriptions {
    use core::num::traits::{CheckedAdd, CheckedMul, CheckedSub, Zero};
    use core::panic_with_felt252;
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use privacy::objects::OpenNoteDeposit;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use super::super::gigstark_passport::PASSPORT_PURPOSE_SUBSCRIPTION_ROLE;
    use super::super::{
        GigstarkPassportProof, IActionAuthorizationVerifierDispatcher,
        IActionAuthorizationVerifierDispatcherTrait,
    };
    use super::{
        IGigstarkSubscriptions, MAX_PREPAID_PERIODS, SUBSCRIPTION_ACTION_DOMAIN, SUB_OP_CANCEL,
        SUB_OP_CLAIM, SUB_OP_EXPIRE, SUB_OP_PREPAY, SUB_OP_START, SUB_ROLE_CREATOR, SUB_ROLE_MEMBER,
        SUB_ROLE_NONE, SUB_STATUS_ACTIVE, SUB_STATUS_CANCELLED, SUB_STATUS_EXPIRED, SUB_STATUS_NONE,
        SubscriptionRecord, errors,
    };

    #[storage]
    struct Storage {
        privacy_pool: ContractAddress,
        authorization_verifier: ContractAddress,
        subscriptions: starknet::storage::Map<felt252, SubscriptionRecord>,
        accounted_balances: starknet::storage::Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        SubscriptionStarted: SubscriptionStarted,
        PeriodsPrepaid: PeriodsPrepaid,
        SubscriptionStatusChanged: SubscriptionStatusChanged,
        CreatorPeriodClaimed: CreatorPeriodClaimed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SubscriptionStarted {
        #[key]
        pub subscription_id: felt252,
        pub tier: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PeriodsPrepaid {
        #[key]
        pub subscription_id: felt252,
        pub prepaid_periods: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SubscriptionStatusChanged {
        #[key]
        pub subscription_id: felt252,
        pub status: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CreatorPeriodClaimed {
        #[key]
        pub subscription_id: felt252,
        pub claimed_period: u8,
        pub note_id: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        privacy_pool: ContractAddress,
        authorization_verifier: ContractAddress,
    ) {
        assert(privacy_pool.is_non_zero(), errors::ZERO_PRIVACY_POOL);
        assert(authorization_verifier.is_non_zero(), errors::ZERO_AUTH_VERIFIER);
        self.privacy_pool.write(privacy_pool);
        self.authorization_verifier.write(authorization_verifier);
    }

    #[abi(embed_v0)]
    impl SubscriptionsImpl of IGigstarkSubscriptions<ContractState> {
        fn get_subscription(self: @ContractState, subscription_id: felt252) -> SubscriptionRecord {
            self.subscriptions.read(subscription_id)
        }

        fn get_action_statement(
            self: @ContractState, subscription_id: felt252, operation: u8, payload: felt252,
        ) -> felt252 {
            let subscription = self.subscriptions.read(subscription_id);
            assert(subscription.status != SUB_STATUS_NONE, errors::INVALID_SUBSCRIPTION);
            action_statement(
                get_contract_address(),
                subscription_id,
                operation,
                subscription.action_nonce,
                payload,
            )
        }

        fn get_accounted_balance(self: @ContractState, token: ContractAddress) -> u256 {
            self.accounted_balances.read(token)
        }

        fn privacy_invoke(
            ref self: ContractState,
            operation: u8,
            subscription_id: felt252,
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
            assert(get_caller_address() == self.privacy_pool.read(), errors::ONLY_PRIVACY_POOL);
            assert(subscription_id != 0, errors::INVALID_SUBSCRIPTION);
            if operation == SUB_OP_START {
                self
                    .start(
                        subscription_id,
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
            } else if operation == SUB_OP_PREPAY {
                self
                    .prepay(
                        subscription_id,
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
            } else if operation == SUB_OP_CANCEL {
                self
                    .status_action(
                        subscription_id,
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
                        cancelled: true,
                    )
            } else if operation == SUB_OP_EXPIRE {
                self
                    .status_action(
                        subscription_id,
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
                        cancelled: false,
                    )
            } else if operation == SUB_OP_CLAIM {
                self
                    .claim(
                        subscription_id,
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
            } else {
                panic_with_felt252(errors::INVALID_OPERATION)
            }
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn start(
            ref self: ContractState,
            subscription_id: felt252,
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
            assert(actor_role == SUB_ROLE_NONE && periods == 1, errors::INVALID_DATA);
            assert(note_id == 0 && proof.policy_id == 0, errors::INVALID_DATA);
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(amount != 0, errors::ZERO_AMOUNT);
            assert(member_commitment != 0 && creator_commitment != 0, errors::ZERO_COMMITMENT);
            assert(member_commitment != creator_commitment, errors::SAME_COMMITMENT);
            assert(tier != 0, errors::INVALID_DATA);
            let now = get_block_timestamp();
            assert(period_ends_at > now, errors::INVALID_PERIOD_END);
            assert(
                self.subscriptions.read(subscription_id).status == SUB_STATUS_NONE,
                errors::SUBSCRIPTION_EXISTS,
            );
            self.assert_received(token, amount);
            self
                .subscriptions
                .write(
                    subscription_id,
                    SubscriptionRecord {
                        member_commitment,
                        creator_commitment,
                        tier,
                        token,
                        amount_per_period: amount,
                        period_seconds: period_ends_at - now,
                        period_ends_at,
                        prepaid_periods: 1,
                        creator_claimed_periods: 0,
                        status: SUB_STATUS_ACTIVE,
                        action_nonce: 0,
                    },
                );
            self.emit(SubscriptionStarted { subscription_id, tier });
            [].span()
        }

        fn prepay(
            ref self: ContractState,
            subscription_id: felt252,
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
            assert(
                member_commitment == 0 && creator_commitment == 0 && tier == 0 && note_id == 0,
                errors::INVALID_DATA,
            );
            assert(actor_role == SUB_ROLE_MEMBER, errors::INVALID_ROLE);
            let mut subscription = self.read_existing(subscription_id);
            assert(subscription.status == SUB_STATUS_ACTIVE, errors::INVALID_STATE);
            assert(
                periods != 0 && subscription.prepaid_periods + periods <= MAX_PREPAID_PERIODS,
                errors::PREPAY_BOUND,
            );
            let periods_u128: u128 = periods.into();
            let periods_u64: u64 = periods.into();
            let expected_amount = subscription
                .amount_per_period
                .checked_mul(periods_u128)
                .expect(errors::AMOUNT_OVERFLOW);
            assert(token == subscription.token && amount == expected_amount, errors::INVALID_DATA);
            let extension = subscription
                .period_seconds
                .checked_mul(periods_u64)
                .expect(errors::INVALID_PERIOD_END);
            let expected_period_end = subscription
                .period_ends_at
                .checked_add(extension)
                .expect(errors::INVALID_PERIOD_END);
            assert(period_ends_at == expected_period_end, errors::INVALID_PERIOD_END);
            self
                .assert_authorized(
                    subscription_id,
                    SUB_ROLE_MEMBER,
                    subscription,
                    SUB_OP_PREPAY,
                    periods.into(),
                    proof,
                );
            self.assert_received(token, amount);
            subscription.prepaid_periods += periods;
            subscription.period_ends_at = expected_period_end;
            subscription.action_nonce += 1;
            self.subscriptions.write(subscription_id, subscription);
            self
                .emit(
                    PeriodsPrepaid {
                        subscription_id, prepaid_periods: subscription.prepaid_periods,
                    },
                );
            [].span()
        }

        fn status_action(
            ref self: ContractState,
            subscription_id: felt252,
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
            cancelled: bool,
        ) -> Span<OpenNoteDeposit> {
            assert_zero_public(
                token,
                amount,
                member_commitment,
                creator_commitment,
                tier,
                period_ends_at,
                periods,
                note_id,
            );
            let mut subscription = self.read_existing(subscription_id);
            assert(subscription.status == SUB_STATUS_ACTIVE, errors::INVALID_STATE);
            if cancelled {
                assert(actor_role == SUB_ROLE_MEMBER, errors::INVALID_ROLE);
                self
                    .assert_authorized(
                        subscription_id, SUB_ROLE_MEMBER, subscription, SUB_OP_CANCEL, 0, proof,
                    );
                subscription.status = SUB_STATUS_CANCELLED;
            } else {
                assert(actor_role == SUB_ROLE_NONE && proof.policy_id == 0, errors::INVALID_DATA);
                assert(get_block_timestamp() >= subscription.period_ends_at, errors::NOT_EXPIRED);
                subscription.status = SUB_STATUS_EXPIRED;
            }
            subscription.action_nonce += 1;
            self.subscriptions.write(subscription_id, subscription);
            self.emit(SubscriptionStatusChanged { subscription_id, status: subscription.status });
            [].span()
        }

        fn claim(
            ref self: ContractState,
            subscription_id: felt252,
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
            assert(
                token.is_zero()
                    && amount == 0
                    && member_commitment == 0
                    && creator_commitment == 0
                    && tier == 0
                    && period_ends_at == 0
                    && periods == 0,
                errors::INVALID_DATA,
            );
            assert(actor_role == SUB_ROLE_CREATOR, errors::INVALID_ROLE);
            assert(note_id != 0, errors::ZERO_NOTE_ID);
            let mut subscription = self.read_existing(subscription_id);
            assert(
                subscription.creator_claimed_periods < subscription.prepaid_periods,
                errors::NO_CLAIMABLE_PERIOD,
            );
            self
                .assert_authorized(
                    subscription_id, SUB_ROLE_CREATOR, subscription, SUB_OP_CLAIM, note_id, proof,
                );
            subscription.creator_claimed_periods += 1;
            subscription.action_nonce += 1;
            let accounted = self.accounted_balances.read(subscription.token);
            self
                .accounted_balances
                .write(
                    subscription.token,
                    accounted
                        .checked_sub(subscription.amount_per_period.into())
                        .expect(errors::BALANCE_UNDERFLOW),
                );
            self.subscriptions.write(subscription_id, subscription);
            IERC20Dispatcher { contract_address: subscription.token }
                .approve(
                    spender: self.privacy_pool.read(),
                    amount: subscription.amount_per_period.into(),
                );
            self
                .emit(
                    CreatorPeriodClaimed {
                        subscription_id,
                        claimed_period: subscription.creator_claimed_periods,
                        note_id,
                    },
                );
            [
                OpenNoteDeposit {
                    note_id, token: subscription.token, amount: subscription.amount_per_period,
                },
            ]
                .span()
        }

        fn assert_received(ref self: ContractState, token: ContractAddress, amount: u128) {
            let accounted = self.accounted_balances.read(token);
            let expected = accounted + amount.into();
            let actual = IERC20Dispatcher { contract_address: token }
                .balance_of(account: get_contract_address());
            assert(actual >= expected, errors::INSUFFICIENT_BALANCE);
            self.accounted_balances.write(token, expected);
        }

        fn read_existing(self: @ContractState, subscription_id: felt252) -> SubscriptionRecord {
            let subscription = self.subscriptions.read(subscription_id);
            assert(subscription.status != SUB_STATUS_NONE, errors::INVALID_SUBSCRIPTION);
            subscription
        }

        fn assert_authorized(
            self: @ContractState,
            subscription_id: felt252,
            actor_role: u8,
            subscription: SubscriptionRecord,
            operation: u8,
            payload: felt252,
            proof: GigstarkPassportProof,
        ) {
            assert(proof.policy_id != 0, errors::ZERO_AUTHORIZATION);
            assert(
                proof.purpose == PASSPORT_PURPOSE_SUBSCRIPTION_ROLE, errors::INVALID_PROOF_PURPOSE,
            );
            let commitment = if actor_role == SUB_ROLE_MEMBER {
                subscription.member_commitment
            } else if actor_role == SUB_ROLE_CREATOR {
                subscription.creator_commitment
            } else {
                panic_with_felt252(errors::INVALID_ROLE)
            };
            let statement = action_statement(
                get_contract_address(),
                subscription_id,
                operation,
                subscription.action_nonce,
                payload,
            );
            assert(
                IActionAuthorizationVerifierDispatcher {
                    contract_address: self.authorization_verifier.read(),
                }
                    .consume_authorization(commitment, statement, proof),
                errors::NOT_AUTHORIZED,
            );
        }
    }

    fn assert_zero_public(
        token: ContractAddress,
        amount: u128,
        member_commitment: felt252,
        creator_commitment: felt252,
        tier: felt252,
        period_ends_at: u64,
        periods: u8,
        note_id: felt252,
    ) {
        assert(
            token.is_zero()
                && amount == 0
                && member_commitment == 0
                && creator_commitment == 0
                && tier == 0
                && period_ends_at == 0
                && periods == 0
                && note_id == 0,
            errors::INVALID_DATA,
        );
    }

    fn action_statement(
        contract_address: ContractAddress,
        subscription_id: felt252,
        operation: u8,
        action_nonce: u64,
        payload: felt252,
    ) -> felt252 {
        core::poseidon::poseidon_hash_span(
            [
                SUBSCRIPTION_ACTION_DOMAIN, contract_address.into(), subscription_id,
                operation.into(), action_nonce.into(), payload,
            ]
                .span(),
        )
    }
}
