//! Gigstark's Sepolia-only STRK20 escrow contract draft.
//!
//! This is app-team code, not a StarkWare contract. It must receive an
//! independent Cairo and protocol review before declaration or deployment.

use privacy::objects::OpenNoteDeposit;
use starknet::ContractAddress;
pub mod compute_verifier;

pub mod gigstark_passport;
pub mod subscriptions;
pub mod tier_gate;

pub const OP_DEPOSIT: u8 = 0;
pub const OP_SUBMIT_DELIVERY: u8 = 1;
pub const OP_CONFIRM_DELIVERY: u8 = 2;
pub const OP_OPEN_DISPUTE: u8 = 3;
pub const OP_TIMEOUT: u8 = 4;
pub const OP_CLAIM: u8 = 5;

pub const ROLE_NONE: u8 = 0;
pub const ROLE_BUYER: u8 = 1;
pub const ROLE_SELLER: u8 = 2;

pub const STATUS_NONE: u8 = 0;
pub const STATUS_ACTIVE: u8 = 1;
pub const STATUS_DELIVERED: u8 = 2;
pub const STATUS_DISPUTED: u8 = 3;
pub const STATUS_SELLER_WINS: u8 = 4;
pub const STATUS_BUYER_WINS: u8 = 5;

pub const ACTION_STATEMENT_DOMAIN: felt252 = 'GIGSTARK_ACTION_V1';
pub const DISPUTE_INPUT_DOMAIN: felt252 = 'GIGSTARK_DISPUTE_V1';

/// Minimal proof receipt consumed by the Starknet-native GigstarkPassport
/// verifier. The receipt discloses no identity or witness. Its Stark-curve
/// signature attests that an approved off-chain proof verifier accepted the
/// opaque proof commitment for this exact policy and action.
#[derive(Copy, Drop, Serde)]
pub struct GigstarkPassportProof {
    pub policy_id: felt252,
    pub audience: ContractAddress,
    pub purpose: u8,
    pub credential_class: felt252,
    pub scope_nullifier: felt252,
    pub proof_commitment: felt252,
    pub issued_at: u64,
    pub expires_at: u64,
    pub signature_r: felt252,
    pub signature_s: felt252,
}

pub fn empty_gigstark_passport_proof() -> GigstarkPassportProof {
    GigstarkPassportProof {
        policy_id: 0,
        audience: 0.try_into().unwrap(),
        purpose: 0,
        credential_class: 0,
        scope_nullifier: 0,
        proof_commitment: 0,
        issued_at: 0,
        expires_at: 0,
        signature_r: 0,
        signature_s: 0,
    }
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct EscrowRecord {
    pub buyer_commitment: felt252,
    pub seller_commitment: felt252,
    pub delivery_commitment: felt252,
    pub token: ContractAddress,
    pub amount: u128,
    pub deadline: u64,
    pub status: u8,
    pub seller_claimed: bool,
    pub buyer_claimed: bool,
    pub action_nonce: u64,
}

#[starknet::interface]
pub trait IActionAuthorizationVerifier<TContractState> {
    /// Consumes a signed proof receipt bound to an unlinkable, per-escrow role
    /// commitment and the exact action statement computed by GigstarkEscrow.
    fn consume_authorization(
        ref self: TContractState,
        role_commitment: felt252,
        action_statement: felt252,
        proof: GigstarkPassportProof,
    ) -> bool;
}

#[starknet::interface]
pub trait IGigstarkEscrow<TContractState> {
    fn get_escrow(self: @TContractState, escrow_id: felt252) -> EscrowRecord;
    fn get_privacy_pool(self: @TContractState) -> ContractAddress;
    fn get_compute_verifier(self: @TContractState) -> ContractAddress;
    fn get_authorization_verifier(self: @TContractState) -> ContractAddress;
    fn get_accounted_balance(self: @TContractState, token: ContractAddress) -> u256;
    fn get_action_statement(
        self: @TContractState, escrow_id: felt252, operation: u8, payload: felt252,
    ) -> felt252;
    fn get_dispute_input_commitment(self: @TContractState, escrow_id: felt252) -> felt252;

    /// Pool-only STRK20 entry point. The fixed argument layout keeps Wallet API
    /// calldata deterministic. Arguments unused by an operation must be zero.
    fn privacy_invoke(
        ref self: TContractState,
        operation: u8,
        escrow_id: felt252,
        actor_role: u8,
        token: ContractAddress,
        amount: u128,
        buyer_commitment: felt252,
        seller_commitment: felt252,
        delivery_commitment: felt252,
        deadline: u64,
        note_id: felt252,
        proof: GigstarkPassportProof,
    ) -> Span<OpenNoteDeposit>;

    /// Dispute evidence stays off-chain. The constructor-pinned compute
    /// verifier must accept a direct Groth16 proof bound to this escrow.
    /// An Oyster receipt commitment is optional and never authorizes settlement.
    fn resolve_dispute(
        ref self: TContractState,
        escrow_id: felt252,
        result: compute_verifier::GigstarkZkResult,
        full_proof_with_hints: Span<felt252>,
    );
}

pub mod errors {
    pub const ZERO_PRIVACY_POOL: felt252 = 'ZERO_PRIVACY_POOL';
    pub const ZERO_COMPUTE_VERIFIER: felt252 = 'ZERO_COMPUTE_VER';
    pub const ZERO_AUTH_VERIFIER: felt252 = 'ZERO_AUTH_VERIFIER';
    pub const ONLY_PRIVACY_POOL: felt252 = 'ONLY_PRIVACY_POOL';
    pub const ZERO_ESCROW_ID: felt252 = 'ZERO_ESCROW_ID';
    pub const ZERO_ROLE_COMMITMENT: felt252 = 'ZERO_ROLE_COMMITMENT';
    pub const SAME_ROLE_COMMITMENT: felt252 = 'SAME_ROLE_COMMITMENT';
    pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    pub const INVALID_DEADLINE: felt252 = 'INVALID_DEADLINE';
    pub const ESCROW_EXISTS: felt252 = 'ESCROW_EXISTS';
    pub const ESCROW_NOT_FOUND: felt252 = 'ESCROW_NOT_FOUND';
    pub const INVALID_OPERATION: felt252 = 'INVALID_OPERATION';
    pub const INVALID_OPERATION_DATA: felt252 = 'INVALID_OP_DATA';
    pub const INVALID_STATE: felt252 = 'INVALID_STATE';
    pub const ZERO_DELIVERY: felt252 = 'ZERO_DELIVERY';
    pub const ZERO_NOTE_ID: felt252 = 'ZERO_NOTE_ID';
    pub const INVALID_ROLE: felt252 = 'INVALID_ROLE';
    pub const ZERO_AUTHORIZATION: felt252 = 'ZERO_AUTH';
    pub const ACTION_NOT_AUTHORIZED: felt252 = 'ACTION_NOT_AUTH';
    pub const INVALID_PROOF_PURPOSE: felt252 = 'BAD_PROOF_PURPOSE';
    pub const INVALID_COMPUTE_OUTCOME: felt252 = 'BAD_COMPUTE_OUTCOME';
    pub const INSUFFICIENT_ESCROW_BALANCE: felt252 = 'INSUFFICIENT_BAL';
    pub const ACCOUNTED_BALANCE_UNDERFLOW: felt252 = 'BALANCE_UNDERFLOW';
    pub const DOUBLE_CLAIM: felt252 = 'DOUBLE_CLAIM';
    pub const NOT_EXPIRED: felt252 = 'NOT_EXPIRED';
}

#[starknet::contract]
pub mod GigstarkEscrow {
    use core::num::traits::{CheckedSub, Zero};
    use core::panic_with_felt252;
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use privacy::objects::OpenNoteDeposit;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, get_block_timestamp, get_caller_address, get_contract_address, get_tx_info,
    };
    use super::compute_verifier::{
        COMPUTE_OUTCOME_BUYER, COMPUTE_OUTCOME_SELLER, GigstarkZkResult,
        IGigstarkComputeVerifierDispatcher, IGigstarkComputeVerifierDispatcherTrait,
    };
    use super::gigstark_passport::PASSPORT_PURPOSE_ESCROW_ROLE;
    use super::{
        ACTION_STATEMENT_DOMAIN, DISPUTE_INPUT_DOMAIN, EscrowRecord, GigstarkPassportProof,
        IActionAuthorizationVerifierDispatcher, IActionAuthorizationVerifierDispatcherTrait,
        IGigstarkEscrow, OP_CLAIM, OP_CONFIRM_DELIVERY, OP_DEPOSIT, OP_OPEN_DISPUTE,
        OP_SUBMIT_DELIVERY, OP_TIMEOUT, ROLE_BUYER, ROLE_NONE, ROLE_SELLER, STATUS_ACTIVE,
        STATUS_BUYER_WINS, STATUS_DELIVERED, STATUS_DISPUTED, STATUS_NONE, STATUS_SELLER_WINS,
        errors,
    };

    #[storage]
    struct Storage {
        privacy_pool: ContractAddress,
        compute_verifier: ContractAddress,
        authorization_verifier: ContractAddress,
        escrows: starknet::storage::Map<felt252, EscrowRecord>,
        accounted_balances: starknet::storage::Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        EscrowCreated: EscrowCreated,
        DeliverySubmitted: DeliverySubmitted,
        DisputeOpened: DisputeOpened,
        EscrowSettled: EscrowSettled,
        WinnerClaimed: WinnerClaimed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EscrowCreated {
        #[key]
        pub escrow_id: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DeliverySubmitted {
        #[key]
        pub escrow_id: felt252,
        pub delivery_commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DisputeOpened {
        #[key]
        pub escrow_id: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EscrowSettled {
        #[key]
        pub escrow_id: felt252,
        pub outcome: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WinnerClaimed {
        #[key]
        pub escrow_id: felt252,
        pub winner_role: u8,
        pub note_id: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        privacy_pool: ContractAddress,
        compute_verifier: ContractAddress,
        authorization_verifier: ContractAddress,
    ) {
        assert(privacy_pool.is_non_zero(), errors::ZERO_PRIVACY_POOL);
        assert(compute_verifier.is_non_zero(), errors::ZERO_COMPUTE_VERIFIER);
        assert(authorization_verifier.is_non_zero(), errors::ZERO_AUTH_VERIFIER);
        self.privacy_pool.write(privacy_pool);
        self.compute_verifier.write(compute_verifier);
        self.authorization_verifier.write(authorization_verifier);
    }

    #[abi(embed_v0)]
    pub impl GigstarkEscrowImpl of IGigstarkEscrow<ContractState> {
        fn get_escrow(self: @ContractState, escrow_id: felt252) -> EscrowRecord {
            self.escrows.read(escrow_id)
        }

        fn get_privacy_pool(self: @ContractState) -> ContractAddress {
            self.privacy_pool.read()
        }

        fn get_compute_verifier(self: @ContractState) -> ContractAddress {
            self.compute_verifier.read()
        }

        fn get_authorization_verifier(self: @ContractState) -> ContractAddress {
            self.authorization_verifier.read()
        }

        fn get_accounted_balance(self: @ContractState, token: ContractAddress) -> u256 {
            self.accounted_balances.read(token)
        }

        fn get_action_statement(
            self: @ContractState, escrow_id: felt252, operation: u8, payload: felt252,
        ) -> felt252 {
            let escrow = self.escrows.read(escrow_id);
            assert(escrow.status != STATUS_NONE, errors::ESCROW_NOT_FOUND);
            compute_action_statement(
                escrow_id, operation, escrow.action_nonce, payload, get_contract_address(),
            )
        }

        fn get_dispute_input_commitment(self: @ContractState, escrow_id: felt252) -> felt252 {
            let escrow = self.escrows.read(escrow_id);
            assert(escrow.status == STATUS_DISPUTED, errors::INVALID_STATE);
            compute_dispute_input_commitment(
                escrow_id, escrow, get_contract_address(), get_tx_info().unbox().chain_id,
            )
        }

        fn privacy_invoke(
            ref self: ContractState,
            operation: u8,
            escrow_id: felt252,
            actor_role: u8,
            token: ContractAddress,
            amount: u128,
            buyer_commitment: felt252,
            seller_commitment: felt252,
            delivery_commitment: felt252,
            deadline: u64,
            note_id: felt252,
            proof: GigstarkPassportProof,
        ) -> Span<OpenNoteDeposit> {
            assert(get_caller_address() == self.privacy_pool.read(), errors::ONLY_PRIVACY_POOL);
            assert(escrow_id != 0, errors::ZERO_ESCROW_ID);

            if operation == OP_DEPOSIT {
                self
                    .deposit(
                        escrow_id,
                        actor_role,
                        token,
                        amount,
                        buyer_commitment,
                        seller_commitment,
                        delivery_commitment,
                        deadline,
                        note_id,
                        proof,
                    )
            } else if operation == OP_SUBMIT_DELIVERY {
                self
                    .submit_delivery(
                        escrow_id,
                        actor_role,
                        token,
                        amount,
                        buyer_commitment,
                        seller_commitment,
                        delivery_commitment,
                        deadline,
                        note_id,
                        proof,
                    )
            } else if operation == OP_CONFIRM_DELIVERY {
                self
                    .confirm_delivery(
                        escrow_id,
                        actor_role,
                        token,
                        amount,
                        buyer_commitment,
                        seller_commitment,
                        delivery_commitment,
                        deadline,
                        note_id,
                        proof,
                    )
            } else if operation == OP_OPEN_DISPUTE {
                self
                    .open_dispute(
                        escrow_id,
                        actor_role,
                        token,
                        amount,
                        buyer_commitment,
                        seller_commitment,
                        delivery_commitment,
                        deadline,
                        note_id,
                        proof,
                    )
            } else if operation == OP_TIMEOUT {
                self
                    .timeout(
                        escrow_id,
                        actor_role,
                        token,
                        amount,
                        buyer_commitment,
                        seller_commitment,
                        delivery_commitment,
                        deadline,
                        note_id,
                        proof,
                    )
            } else if operation == OP_CLAIM {
                self
                    .claim(
                        escrow_id,
                        actor_role,
                        token,
                        amount,
                        buyer_commitment,
                        seller_commitment,
                        delivery_commitment,
                        deadline,
                        note_id,
                        proof,
                    )
            } else {
                panic_with_felt252(errors::INVALID_OPERATION)
            }
        }

        fn resolve_dispute(
            ref self: ContractState,
            escrow_id: felt252,
            result: GigstarkZkResult,
            full_proof_with_hints: Span<felt252>,
        ) {
            let mut escrow = self.escrows.read(escrow_id);
            assert(escrow.status != STATUS_NONE, errors::ESCROW_NOT_FOUND);
            assert(escrow.status == STATUS_DISPUTED, errors::INVALID_STATE);
            let input_commitment = compute_dispute_input_commitment(
                escrow_id, escrow, get_contract_address(), get_tx_info().unbox().chain_id,
            );
            let verifier = IGigstarkComputeVerifierDispatcher {
                contract_address: self.compute_verifier.read(),
            };
            let outcome = verifier
                .consume_result(escrow_id, input_commitment, result, full_proof_with_hints);
            assert(
                outcome == COMPUTE_OUTCOME_BUYER || outcome == COMPUTE_OUTCOME_SELLER,
                errors::INVALID_COMPUTE_OUTCOME,
            );
            escrow
                .status =
                    if outcome == COMPUTE_OUTCOME_SELLER {
                        STATUS_SELLER_WINS
                    } else {
                        STATUS_BUYER_WINS
                    };
            escrow.action_nonce += 1;
            self.escrows.write(escrow_id, escrow);
            self.emit(EscrowSettled { escrow_id, outcome: escrow.status });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn deposit(
            ref self: ContractState,
            escrow_id: felt252,
            actor_role: u8,
            token: ContractAddress,
            amount: u128,
            buyer_commitment: felt252,
            seller_commitment: felt252,
            delivery_commitment: felt252,
            deadline: u64,
            note_id: felt252,
            proof: GigstarkPassportProof,
        ) -> Span<OpenNoteDeposit> {
            assert(actor_role == ROLE_NONE, errors::INVALID_OPERATION_DATA);
            assert(delivery_commitment == 0, errors::INVALID_OPERATION_DATA);
            assert(note_id == 0, errors::INVALID_OPERATION_DATA);
            assert(proof.policy_id == 0, errors::INVALID_OPERATION_DATA);
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(amount != 0, errors::ZERO_AMOUNT);
            assert(buyer_commitment != 0 && seller_commitment != 0, errors::ZERO_ROLE_COMMITMENT);
            assert(buyer_commitment != seller_commitment, errors::SAME_ROLE_COMMITMENT);
            assert(deadline > get_block_timestamp(), errors::INVALID_DEADLINE);
            assert(self.escrows.read(escrow_id).status == STATUS_NONE, errors::ESCROW_EXISTS);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            let actual_balance = token_dispatcher.balance_of(account: get_contract_address());
            let accounted_balance = self.accounted_balances.read(token);
            let expected_balance = accounted_balance + amount.into();
            assert(actual_balance >= expected_balance, errors::INSUFFICIENT_ESCROW_BALANCE);

            self.accounted_balances.write(token, expected_balance);
            self
                .escrows
                .write(
                    escrow_id,
                    EscrowRecord {
                        buyer_commitment,
                        seller_commitment,
                        delivery_commitment: 0,
                        token,
                        amount,
                        deadline,
                        status: STATUS_ACTIVE,
                        seller_claimed: false,
                        buyer_claimed: false,
                        action_nonce: 0,
                    },
                );
            self.emit(EscrowCreated { escrow_id });
            [].span()
        }

        fn submit_delivery(
            ref self: ContractState,
            escrow_id: felt252,
            actor_role: u8,
            token: ContractAddress,
            amount: u128,
            buyer_commitment: felt252,
            seller_commitment: felt252,
            delivery_commitment: felt252,
            deadline: u64,
            note_id: felt252,
            proof: GigstarkPassportProof,
        ) -> Span<OpenNoteDeposit> {
            assert_zero_common(
                token, amount, buyer_commitment, seller_commitment, deadline, note_id,
            );
            assert(actor_role == ROLE_SELLER, errors::INVALID_ROLE);
            assert(delivery_commitment != 0, errors::ZERO_DELIVERY);
            let mut escrow = self.read_existing(escrow_id);
            assert(escrow.status == STATUS_ACTIVE, errors::INVALID_STATE);
            self
                .assert_authorized(
                    escrow_id, actor_role, escrow, OP_SUBMIT_DELIVERY, delivery_commitment, proof,
                );
            escrow.delivery_commitment = delivery_commitment;
            escrow.status = STATUS_DELIVERED;
            escrow.action_nonce += 1;
            self.escrows.write(escrow_id, escrow);
            self.emit(DeliverySubmitted { escrow_id, delivery_commitment });
            [].span()
        }

        fn confirm_delivery(
            ref self: ContractState,
            escrow_id: felt252,
            actor_role: u8,
            token: ContractAddress,
            amount: u128,
            buyer_commitment: felt252,
            seller_commitment: felt252,
            delivery_commitment: felt252,
            deadline: u64,
            note_id: felt252,
            proof: GigstarkPassportProof,
        ) -> Span<OpenNoteDeposit> {
            assert_zero_common(
                token, amount, buyer_commitment, seller_commitment, deadline, note_id,
            );
            assert(delivery_commitment == 0, errors::INVALID_OPERATION_DATA);
            assert(actor_role == ROLE_BUYER, errors::INVALID_ROLE);
            let mut escrow = self.read_existing(escrow_id);
            assert(escrow.status == STATUS_DELIVERED, errors::INVALID_STATE);
            self.assert_authorized(escrow_id, actor_role, escrow, OP_CONFIRM_DELIVERY, 0, proof);
            escrow.status = STATUS_SELLER_WINS;
            escrow.action_nonce += 1;
            self.escrows.write(escrow_id, escrow);
            self.emit(EscrowSettled { escrow_id, outcome: STATUS_SELLER_WINS });
            [].span()
        }

        fn open_dispute(
            ref self: ContractState,
            escrow_id: felt252,
            actor_role: u8,
            token: ContractAddress,
            amount: u128,
            buyer_commitment: felt252,
            seller_commitment: felt252,
            delivery_commitment: felt252,
            deadline: u64,
            note_id: felt252,
            proof: GigstarkPassportProof,
        ) -> Span<OpenNoteDeposit> {
            assert_zero_common(
                token, amount, buyer_commitment, seller_commitment, deadline, note_id,
            );
            assert(delivery_commitment == 0, errors::INVALID_OPERATION_DATA);
            assert(actor_role == ROLE_BUYER || actor_role == ROLE_SELLER, errors::INVALID_ROLE);
            let mut escrow = self.read_existing(escrow_id);
            assert(
                escrow.status == STATUS_ACTIVE || escrow.status == STATUS_DELIVERED,
                errors::INVALID_STATE,
            );
            self.assert_authorized(escrow_id, actor_role, escrow, OP_OPEN_DISPUTE, 0, proof);
            escrow.status = STATUS_DISPUTED;
            escrow.action_nonce += 1;
            self.escrows.write(escrow_id, escrow);
            self.emit(DisputeOpened { escrow_id });
            [].span()
        }

        fn timeout(
            ref self: ContractState,
            escrow_id: felt252,
            actor_role: u8,
            token: ContractAddress,
            amount: u128,
            buyer_commitment: felt252,
            seller_commitment: felt252,
            delivery_commitment: felt252,
            deadline: u64,
            note_id: felt252,
            proof: GigstarkPassportProof,
        ) -> Span<OpenNoteDeposit> {
            assert_zero_common(
                token, amount, buyer_commitment, seller_commitment, deadline, note_id,
            );
            assert(delivery_commitment == 0, errors::INVALID_OPERATION_DATA);
            assert(actor_role == ROLE_NONE, errors::INVALID_OPERATION_DATA);
            assert(proof.policy_id == 0, errors::INVALID_OPERATION_DATA);
            let mut escrow = self.read_existing(escrow_id);
            assert(
                escrow.status == STATUS_ACTIVE || escrow.status == STATUS_DELIVERED,
                errors::INVALID_STATE,
            );
            assert(get_block_timestamp() >= escrow.deadline, errors::NOT_EXPIRED);
            escrow.status = STATUS_BUYER_WINS;
            escrow.action_nonce += 1;
            self.escrows.write(escrow_id, escrow);
            self.emit(EscrowSettled { escrow_id, outcome: STATUS_BUYER_WINS });
            [].span()
        }

        fn claim(
            ref self: ContractState,
            escrow_id: felt252,
            actor_role: u8,
            token: ContractAddress,
            amount: u128,
            buyer_commitment: felt252,
            seller_commitment: felt252,
            delivery_commitment: felt252,
            deadline: u64,
            note_id: felt252,
            proof: GigstarkPassportProof,
        ) -> Span<OpenNoteDeposit> {
            assert_zero_common(token, amount, buyer_commitment, seller_commitment, deadline, 0);
            assert(delivery_commitment == 0, errors::INVALID_OPERATION_DATA);
            assert(note_id != 0, errors::ZERO_NOTE_ID);
            let mut escrow = self.read_existing(escrow_id);
            let seller_wins = escrow.status == STATUS_SELLER_WINS && actor_role == ROLE_SELLER;
            let buyer_wins = escrow.status == STATUS_BUYER_WINS && actor_role == ROLE_BUYER;
            assert(seller_wins || buyer_wins, errors::INVALID_ROLE);
            if seller_wins {
                assert(!escrow.seller_claimed, errors::DOUBLE_CLAIM);
            } else {
                assert(!escrow.buyer_claimed, errors::DOUBLE_CLAIM);
            }
            self.assert_authorized(escrow_id, actor_role, escrow, OP_CLAIM, note_id, proof);

            if seller_wins {
                escrow.seller_claimed = true;
            } else {
                escrow.buyer_claimed = true;
            }
            escrow.action_nonce += 1;

            let accounted = self.accounted_balances.read(escrow.token);
            let remaining = accounted
                .checked_sub(escrow.amount.into())
                .expect(errors::ACCOUNTED_BALANCE_UNDERFLOW);
            self.accounted_balances.write(escrow.token, remaining);
            self.escrows.write(escrow_id, escrow);

            let privacy_pool = self.privacy_pool.read();
            IERC20Dispatcher { contract_address: escrow.token }
                .approve(spender: privacy_pool, amount: escrow.amount.into());
            self.emit(WinnerClaimed { escrow_id, winner_role: actor_role, note_id });
            [OpenNoteDeposit { note_id, token: escrow.token, amount: escrow.amount }].span()
        }

        fn read_existing(self: @ContractState, escrow_id: felt252) -> EscrowRecord {
            let escrow = self.escrows.read(escrow_id);
            assert(escrow.status != STATUS_NONE, errors::ESCROW_NOT_FOUND);
            escrow
        }

        fn assert_authorized(
            self: @ContractState,
            escrow_id: felt252,
            actor_role: u8,
            escrow: EscrowRecord,
            operation: u8,
            payload: felt252,
            proof: GigstarkPassportProof,
        ) {
            assert(proof.policy_id != 0, errors::ZERO_AUTHORIZATION);
            assert(proof.purpose == PASSPORT_PURPOSE_ESCROW_ROLE, errors::INVALID_PROOF_PURPOSE);
            let role_commitment = if actor_role == ROLE_BUYER {
                escrow.buyer_commitment
            } else if actor_role == ROLE_SELLER {
                escrow.seller_commitment
            } else {
                panic_with_felt252(errors::INVALID_ROLE)
            };
            let action_statement = compute_action_statement(
                escrow_id, operation, escrow.action_nonce, payload, get_contract_address(),
            );
            let verifier = IActionAuthorizationVerifierDispatcher {
                contract_address: self.authorization_verifier.read(),
            };
            assert(
                verifier.consume_authorization(role_commitment, action_statement, proof),
                errors::ACTION_NOT_AUTHORIZED,
            );
        }
    }

    fn assert_zero_common(
        token: ContractAddress,
        amount: u128,
        buyer_commitment: felt252,
        seller_commitment: felt252,
        deadline: u64,
        note_id: felt252,
    ) {
        assert(
            token.is_zero()
                && amount == 0
                && buyer_commitment == 0
                && seller_commitment == 0
                && deadline == 0
                && note_id == 0,
            errors::INVALID_OPERATION_DATA,
        );
    }

    fn compute_action_statement(
        escrow_id: felt252,
        operation: u8,
        action_nonce: u64,
        payload: felt252,
        contract_address: ContractAddress,
    ) -> felt252 {
        core::poseidon::poseidon_hash_span(
            [
                ACTION_STATEMENT_DOMAIN, contract_address.into(), escrow_id, operation.into(),
                action_nonce.into(), payload,
            ]
                .span(),
        )
    }

    fn compute_dispute_input_commitment(
        escrow_id: felt252,
        escrow: EscrowRecord,
        contract_address: ContractAddress,
        chain_id: felt252,
    ) -> felt252 {
        core::poseidon::poseidon_hash_span(
            [
                DISPUTE_INPUT_DOMAIN, chain_id, contract_address.into(), escrow_id,
                escrow.buyer_commitment, escrow.seller_commitment, escrow.delivery_commitment,
                escrow.token.into(), escrow.amount.into(), escrow.deadline.into(),
                escrow.action_nonce.into(),
            ]
                .span(),
        )
    }
}

#[cfg(test)]
pub mod test_contracts;

#[cfg(test)]
mod tests;
