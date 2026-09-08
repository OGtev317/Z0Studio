//! Clean-room, Starknet-native GigstarkPassport proof-receipt verifier.
//!
//! This contract verifies a Stark-curve signature from a policy-pinned
//! attestor after that attestor has accepted an opaque proof off-chain. It is
//! a cryptographic receipt verifier, not a direct ZK circuit verifier. No
//! Athera code, contract, root, credential, or network trust is imported.

use starknet::ContractAddress;
use super::{GigstarkPassportProof, IActionAuthorizationVerifier};

pub const PASSPORT_PURPOSE_ESCROW_ROLE: u8 = 1;
pub const PASSPORT_PURPOSE_TIER_ACCESS: u8 = 2;
pub const PASSPORT_PURPOSE_SUBSCRIPTION_ROLE: u8 = 3;
pub const PASSPORT_RECEIPT_DOMAIN: felt252 = 'GIGSTARK_PASSPORT_V1';
pub const PASSPORT_NULLIFIER_DOMAIN: felt252 = 'GIGSTARK_NULLIFIER_V1';

const STARK_CURVE_ORDER: felt252 =
    0x800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2f;
const STARK_CURVE_HALF_ORDER: felt252 =
    0x4000000000000087fffffffffffffffdbc08936e573d9190f335120d6e32697;

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct GigstarkPassportPolicy {
    pub audience: ContractAddress,
    pub purpose: u8,
    pub credential_class: felt252,
    pub valid_from: u64,
    pub valid_until: u64,
    pub attestor_public_key: felt252,
    pub active: bool,
}

#[starknet::interface]
pub trait IGigstarkPassportVerifier<TContractState> {
    fn get_admin(self: @TContractState) -> ContractAddress;
    fn get_policy(self: @TContractState, policy_id: felt252) -> GigstarkPassportPolicy;
    fn is_nullifier_used(
        self: @TContractState, policy_id: felt252, scope_nullifier: felt252,
    ) -> bool;
    fn get_authorization_digest(
        self: @TContractState,
        role_commitment: felt252,
        action_statement: felt252,
        proof: GigstarkPassportProof,
    ) -> felt252;
    fn set_policy(
        ref self: TContractState,
        policy_id: felt252,
        audience: ContractAddress,
        purpose: u8,
        credential_class: felt252,
        valid_from: u64,
        valid_until: u64,
        attestor_public_key: felt252,
    );
    fn set_policy_active(ref self: TContractState, policy_id: felt252, active: bool);
}

pub mod errors {
    pub const ZERO_ADMIN: felt252 = 'PASSPORT_ZERO_ADMIN';
    pub const ONLY_ADMIN: felt252 = 'PASSPORT_ONLY_ADMIN';
    pub const INVALID_POLICY: felt252 = 'PASSPORT_BAD_POLICY';
    pub const POLICY_EXISTS: felt252 = 'PASSPORT_POLICY_EXISTS';
    pub const POLICY_INACTIVE: felt252 = 'PASSPORT_INACTIVE';
    pub const POLICY_EXPIRED: felt252 = 'PASSPORT_POLICY_TIME';
    pub const AUDIENCE_MISMATCH: felt252 = 'PASSPORT_AUDIENCE';
    pub const PURPOSE_MISMATCH: felt252 = 'PASSPORT_PURPOSE';
    pub const CREDENTIAL_MISMATCH: felt252 = 'PASSPORT_CREDENTIAL';
    pub const INVALID_RECEIPT: felt252 = 'PASSPORT_BAD_RECEIPT';
    pub const RECEIPT_EXPIRED: felt252 = 'PASSPORT_RECEIPT_TIME';
    pub const NULLIFIER_USED: felt252 = 'PASSPORT_REPLAY';
    pub const INVALID_SIGNATURE: felt252 = 'PASSPORT_BAD_SIG';
}

#[starknet::contract]
pub mod GigstarkPassportVerifier {
    use core::ecdsa::check_ecdsa_signature;
    use core::num::traits::Zero;
    use core::poseidon::poseidon_hash_span;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, get_block_timestamp, get_caller_address, get_contract_address, get_tx_info,
    };
    use super::{
        GigstarkPassportPolicy, GigstarkPassportProof, IActionAuthorizationVerifier,
        IGigstarkPassportVerifier, PASSPORT_NULLIFIER_DOMAIN, PASSPORT_RECEIPT_DOMAIN,
        STARK_CURVE_HALF_ORDER, STARK_CURVE_ORDER, errors,
    };

    #[storage]
    struct Storage {
        admin: ContractAddress,
        policies: starknet::storage::Map<felt252, GigstarkPassportPolicy>,
        used_nullifiers: starknet::storage::Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PolicyConfigured: PolicyConfigured,
        PolicyStatusChanged: PolicyStatusChanged,
        AuthorizationConsumed: AuthorizationConsumed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PolicyConfigured {
        #[key]
        pub policy_id: felt252,
        #[key]
        pub audience: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PolicyStatusChanged {
        #[key]
        pub policy_id: felt252,
        pub active: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AuthorizationConsumed {
        #[key]
        pub policy_id: felt252,
        #[key]
        pub scope_nullifier: felt252,
        pub action_statement: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        assert(admin.is_non_zero(), errors::ZERO_ADMIN);
        self.admin.write(admin);
    }

    #[abi(embed_v0)]
    impl PassportImpl of IGigstarkPassportVerifier<ContractState> {
        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_policy(self: @ContractState, policy_id: felt252) -> GigstarkPassportPolicy {
            self.policies.read(policy_id)
        }

        fn is_nullifier_used(
            self: @ContractState, policy_id: felt252, scope_nullifier: felt252,
        ) -> bool {
            self.used_nullifiers.read(nullifier_key(policy_id, scope_nullifier))
        }

        fn get_authorization_digest(
            self: @ContractState,
            role_commitment: felt252,
            action_statement: felt252,
            proof: GigstarkPassportProof,
        ) -> felt252 {
            let policy = self.policies.read(proof.policy_id);
            assert(policy.attestor_public_key != 0, errors::INVALID_POLICY);
            receipt_digest(
                get_contract_address(),
                get_tx_info().unbox().chain_id,
                policy,
                role_commitment,
                action_statement,
                proof,
            )
        }

        fn set_policy(
            ref self: ContractState,
            policy_id: felt252,
            audience: ContractAddress,
            purpose: u8,
            credential_class: felt252,
            valid_from: u64,
            valid_until: u64,
            attestor_public_key: felt252,
        ) {
            self.assert_admin();
            assert(
                self.policies.read(policy_id).attestor_public_key == 0,
                errors::POLICY_EXISTS,
            );
            assert(
                policy_id != 0
                    && audience.is_non_zero()
                    && purpose != 0
                    && credential_class != 0
                    && valid_until > valid_from
                    && attestor_public_key != 0,
                errors::INVALID_POLICY,
            );
            self
                .policies
                .write(
                    policy_id,
                    GigstarkPassportPolicy {
                        audience,
                        purpose,
                        credential_class,
                        valid_from,
                        valid_until,
                        attestor_public_key,
                        active: false,
                    },
                );
            self.emit(PolicyConfigured { policy_id, audience });
        }

        fn set_policy_active(ref self: ContractState, policy_id: felt252, active: bool) {
            self.assert_admin();
            let mut policy = self.policies.read(policy_id);
            assert(policy.attestor_public_key != 0, errors::INVALID_POLICY);
            policy.active = active;
            self.policies.write(policy_id, policy);
            self.emit(PolicyStatusChanged { policy_id, active });
        }
    }

    #[abi(embed_v0)]
    impl AuthorizationImpl of IActionAuthorizationVerifier<ContractState> {
        fn consume_authorization(
            ref self: ContractState,
            role_commitment: felt252,
            action_statement: felt252,
            proof: GigstarkPassportProof,
        ) -> bool {
            let policy = self.policies.read(proof.policy_id);
            assert(policy.attestor_public_key != 0, errors::INVALID_POLICY);
            assert(policy.active, errors::POLICY_INACTIVE);

            let now = get_block_timestamp();
            assert(now >= policy.valid_from && now < policy.valid_until, errors::POLICY_EXPIRED);
            assert(get_caller_address() == policy.audience, errors::AUDIENCE_MISMATCH);
            assert(proof.audience == policy.audience, errors::AUDIENCE_MISMATCH);
            assert(proof.purpose == policy.purpose, errors::PURPOSE_MISMATCH);
            assert(proof.credential_class == policy.credential_class, errors::CREDENTIAL_MISMATCH);
            assert(
                role_commitment != 0
                    && action_statement != 0
                    && proof.scope_nullifier != 0
                    && proof.proof_commitment != 0,
                errors::INVALID_RECEIPT,
            );
            assert(
                proof.issued_at >= policy.valid_from
                    && proof.issued_at <= now
                    && proof.expires_at > now
                    && proof.expires_at <= policy.valid_until,
                errors::RECEIPT_EXPIRED,
            );

            let key = nullifier_key(proof.policy_id, proof.scope_nullifier);
            assert(!self.used_nullifiers.read(key), errors::NULLIFIER_USED);

            let digest = receipt_digest(
                get_contract_address(),
                get_tx_info().unbox().chain_id,
                policy,
                role_commitment,
                action_statement,
                proof,
            );
            let signature_r: u256 = proof.signature_r.into();
            let signature_s: u256 = proof.signature_s.into();
            let curve_order: u256 = STARK_CURVE_ORDER.into();
            let half_order: u256 = STARK_CURVE_HALF_ORDER.into();
            assert(
                signature_r < curve_order
                    && signature_s <= half_order
                    && check_ecdsa_signature(
                        digest, policy.attestor_public_key, proof.signature_r, proof.signature_s,
                    ),
                errors::INVALID_SIGNATURE,
            );

            self.used_nullifiers.write(key, true);
            self
                .emit(
                    AuthorizationConsumed {
                        policy_id: proof.policy_id,
                        scope_nullifier: proof.scope_nullifier,
                        action_statement,
                    },
                );
            true
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), errors::ONLY_ADMIN);
        }
    }

    fn nullifier_key(policy_id: felt252, scope_nullifier: felt252) -> felt252 {
        poseidon_hash_span([PASSPORT_NULLIFIER_DOMAIN, policy_id, scope_nullifier].span())
    }

    fn receipt_digest(
        verifier: ContractAddress,
        chain_id: felt252,
        policy: GigstarkPassportPolicy,
        role_commitment: felt252,
        action_statement: felt252,
        proof: GigstarkPassportProof,
    ) -> felt252 {
        poseidon_hash_span(
            [
                PASSPORT_RECEIPT_DOMAIN, chain_id, verifier.into(), proof.policy_id,
                policy.audience.into(), policy.purpose.into(), policy.credential_class,
                policy.valid_from.into(), policy.valid_until.into(), role_commitment,
                action_statement, proof.scope_nullifier, proof.proof_commitment,
                proof.issued_at.into(), proof.expires_at.into(),
            ]
                .span(),
        )
    }
}
