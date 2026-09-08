//! Audience-bound, one-use tier access authorization for Gigstark content.
//!
//! The gate consumes a GigstarkPassport proof receipt without learning a
//! wallet address, credential witness, or viewing key. The receipt is bound to
//! this gate, the requested tier, an application-defined access scope, and an
//! unlinkable viewer commitment.

use starknet::ContractAddress;
use super::GigstarkPassportProof;

pub const TIER_ACCESS_DOMAIN: felt252 = 'GIGSTARK_TIER_ACCESS_V1';

#[starknet::interface]
pub trait IGigstarkTierGate<TContractState> {
    fn get_authorization_verifier(self: @TContractState) -> ContractAddress;
    fn get_access_statement(self: @TContractState, tier: felt252, access_scope: felt252) -> felt252;
    fn verify_access(
        ref self: TContractState,
        viewer_commitment: felt252,
        tier: felt252,
        access_scope: felt252,
        proof: GigstarkPassportProof,
    ) -> bool;
}

pub mod errors {
    pub const ZERO_AUTH_VERIFIER: felt252 = 'TIER_ZERO_VERIFIER';
    pub const INVALID_ACCESS_REQUEST: felt252 = 'TIER_BAD_REQUEST';
    pub const ZERO_AUTHORIZATION: felt252 = 'TIER_ZERO_AUTH';
    pub const NOT_AUTHORIZED: felt252 = 'TIER_NOT_AUTH';
    pub const INVALID_PROOF_PURPOSE: felt252 = 'TIER_BAD_PROOF_PURPOSE';
}

#[starknet::contract]
pub mod GigstarkTierGate {
    use core::num::traits::Zero;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_contract_address};
    use super::super::gigstark_passport::PASSPORT_PURPOSE_TIER_ACCESS;
    use super::super::{
        GigstarkPassportProof, IActionAuthorizationVerifierDispatcher,
        IActionAuthorizationVerifierDispatcherTrait,
    };
    use super::{IGigstarkTierGate, TIER_ACCESS_DOMAIN, errors};

    #[storage]
    struct Storage {
        authorization_verifier: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TierAccessAuthorized: TierAccessAuthorized,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TierAccessAuthorized {
        #[key]
        pub tier: felt252,
        #[key]
        pub access_scope: felt252,
        pub scope_nullifier: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, authorization_verifier: ContractAddress) {
        assert(authorization_verifier.is_non_zero(), errors::ZERO_AUTH_VERIFIER);
        self.authorization_verifier.write(authorization_verifier);
    }

    #[abi(embed_v0)]
    impl TierGateImpl of IGigstarkTierGate<ContractState> {
        fn get_authorization_verifier(self: @ContractState) -> ContractAddress {
            self.authorization_verifier.read()
        }

        fn get_access_statement(
            self: @ContractState, tier: felt252, access_scope: felt252,
        ) -> felt252 {
            assert(tier != 0 && access_scope != 0, errors::INVALID_ACCESS_REQUEST);
            access_statement(get_contract_address(), tier, access_scope)
        }

        fn verify_access(
            ref self: ContractState,
            viewer_commitment: felt252,
            tier: felt252,
            access_scope: felt252,
            proof: GigstarkPassportProof,
        ) -> bool {
            assert(
                viewer_commitment != 0 && tier != 0 && access_scope != 0,
                errors::INVALID_ACCESS_REQUEST,
            );
            assert(proof.policy_id != 0, errors::ZERO_AUTHORIZATION);
            assert(proof.purpose == PASSPORT_PURPOSE_TIER_ACCESS, errors::INVALID_PROOF_PURPOSE);
            let statement = access_statement(get_contract_address(), tier, access_scope);
            assert(
                IActionAuthorizationVerifierDispatcher {
                    contract_address: self.authorization_verifier.read(),
                }
                    .consume_authorization(viewer_commitment, statement, proof),
                errors::NOT_AUTHORIZED,
            );
            self
                .emit(
                    TierAccessAuthorized {
                        tier, access_scope, scope_nullifier: proof.scope_nullifier,
                    },
                );
            true
        }
    }

    fn access_statement(gate: ContractAddress, tier: felt252, access_scope: felt252) -> felt252 {
        core::poseidon::poseidon_hash_span(
            [TIER_ACCESS_DOMAIN, gate.into(), tier, access_scope].span(),
        )
    }
}
