//! Direct Groth16 dispute verifier for Gigstark settlement.
//!
//! A valid proof is the only authority that can produce a settlement outcome.
//! An Oyster receipt hash may be referenced for independent TEE verification,
//! but it is never required and can never override the proof result.

use starknet::ContractAddress;

pub const COMPUTE_NULLIFIER_DOMAIN: felt252 = 'GIG_ZK_NULLIFIER_V1';
pub const OYSTER_BINDING_DOMAIN: felt252 = 'GIG_OYSTER_BIND_V1';
pub const COMPUTE_OUTCOME_BUYER: u8 = 1;
pub const COMPUTE_OUTCOME_SELLER: u8 = 2;

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct GigstarkComputePolicy {
    pub audience: ContractAddress,
    pub program_commitment: felt252,
    pub compute_policy_hash: felt252,
    pub required_score: u8,
    pub valid_from: u64,
    pub valid_until: u64,
    pub zk_verifier: ContractAddress,
    pub active: bool,
}

#[derive(Copy, Drop, Serde)]
pub struct GigstarkZkResult {
    pub policy_id: felt252,
    pub audience: ContractAddress,
    pub job_id: felt252,
    pub input_commitment: felt252,
    pub evidence_commitment: u256,
    pub result_commitment: u256,
    pub outcome: u8,
    pub expires_at: u64,
    /// Hash of the raw Oyster attestation bundle. Zero means no optional TEE
    /// receipt was supplied. This field is never a settlement authority.
    pub oyster_receipt_commitment: u256,
}

#[starknet::interface]
pub trait IGroth16VerifierBN254<TContractState> {
    fn verify_groth16_proof_bn254(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

#[starknet::interface]
pub trait IGigstarkComputeVerifier<TContractState> {
    fn get_admin(self: @TContractState) -> ContractAddress;
    fn get_policy(self: @TContractState, policy_id: felt252) -> GigstarkComputePolicy;
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
    fn get_result_nullifier(self: @TContractState, result: GigstarkZkResult) -> felt252;
    fn get_oyster_binding(self: @TContractState, result: GigstarkZkResult) -> felt252;
    fn consume_result(
        ref self: TContractState,
        expected_job_id: felt252,
        expected_input_commitment: felt252,
        result: GigstarkZkResult,
        full_proof_with_hints: Span<felt252>,
    ) -> u8;
    fn set_policy(
        ref self: TContractState,
        policy_id: felt252,
        audience: ContractAddress,
        program_commitment: felt252,
        compute_policy_hash: felt252,
        required_score: u8,
        valid_from: u64,
        valid_until: u64,
        zk_verifier: ContractAddress,
    );
    fn set_policy_active(ref self: TContractState, policy_id: felt252, active: bool);
}

pub mod errors {
    pub const ZERO_ADMIN: felt252 = 'COMPUTE_ZERO_ADMIN';
    pub const ONLY_ADMIN: felt252 = 'COMPUTE_ONLY_ADMIN';
    pub const INVALID_POLICY: felt252 = 'COMPUTE_BAD_POLICY';
    pub const POLICY_INACTIVE: felt252 = 'COMPUTE_INACTIVE';
    pub const POLICY_EXPIRED: felt252 = 'COMPUTE_POLICY_TIME';
    pub const AUDIENCE_MISMATCH: felt252 = 'COMPUTE_AUDIENCE';
    pub const INVALID_RESULT: felt252 = 'COMPUTE_BAD_RESULT';
    pub const RESULT_EXPIRED: felt252 = 'COMPUTE_RESULT_TIME';
    pub const JOB_MISMATCH: felt252 = 'COMPUTE_JOB';
    pub const INPUT_MISMATCH: felt252 = 'COMPUTE_INPUT';
    pub const NULLIFIER_USED: felt252 = 'COMPUTE_REPLAY';
    pub const PROOF_REJECTED: felt252 = 'COMPUTE_BAD_ZK_PROOF';
    pub const PUBLIC_INPUT_COUNT: felt252 = 'COMPUTE_ZK_INPUTS';
    pub const PUBLIC_SIGNAL_MISMATCH: felt252 = 'COMPUTE_ZK_BINDING';
}

#[starknet::contract]
pub mod GigstarkComputeVerifier {
    use core::num::traits::Zero;
    use core::panic_with_felt252;
    use core::poseidon::poseidon_hash_span;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, get_block_timestamp, get_caller_address, get_contract_address, get_tx_info,
    };
    use super::{
        COMPUTE_NULLIFIER_DOMAIN, COMPUTE_OUTCOME_BUYER, COMPUTE_OUTCOME_SELLER,
        GigstarkComputePolicy, GigstarkZkResult, IGigstarkComputeVerifier,
        IGroth16VerifierBN254Dispatcher, IGroth16VerifierBN254DispatcherTrait,
        OYSTER_BINDING_DOMAIN, errors,
    };

    #[storage]
    struct Storage {
        admin: ContractAddress,
        policies: starknet::storage::Map<felt252, GigstarkComputePolicy>,
        used_nullifiers: starknet::storage::Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PolicyConfigured: PolicyConfigured,
        PolicyStatusChanged: PolicyStatusChanged,
        ResultConsumed: ResultConsumed,
        OysterReceiptReferenced: OysterReceiptReferenced,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PolicyConfigured {
        #[key]
        pub policy_id: felt252,
        #[key]
        pub audience: ContractAddress,
        pub program_commitment: felt252,
        pub zk_verifier: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PolicyStatusChanged {
        #[key]
        pub policy_id: felt252,
        pub active: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ResultConsumed {
        #[key]
        pub policy_id: felt252,
        #[key]
        pub job_id: felt252,
        #[key]
        pub nullifier: felt252,
        pub result_commitment: u256,
        pub outcome: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OysterReceiptReferenced {
        #[key]
        pub policy_id: felt252,
        #[key]
        pub job_id: felt252,
        pub receipt_commitment: u256,
        pub expected_user_data_binding: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        assert(admin.is_non_zero(), errors::ZERO_ADMIN);
        self.admin.write(admin);
    }

    #[abi(embed_v0)]
    impl ComputeVerifierImpl of IGigstarkComputeVerifier<ContractState> {
        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_policy(self: @ContractState, policy_id: felt252) -> GigstarkComputePolicy {
            self.policies.read(policy_id)
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.used_nullifiers.read(nullifier)
        }

        fn get_result_nullifier(self: @ContractState, result: GigstarkZkResult) -> felt252 {
            result_nullifier(result)
        }

        fn get_oyster_binding(self: @ContractState, result: GigstarkZkResult) -> felt252 {
            oyster_binding(get_contract_address(), get_tx_info().unbox().chain_id, result)
        }

        fn consume_result(
            ref self: ContractState,
            expected_job_id: felt252,
            expected_input_commitment: felt252,
            result: GigstarkZkResult,
            full_proof_with_hints: Span<felt252>,
        ) -> u8 {
            let policy = self.policies.read(result.policy_id);
            assert(policy.zk_verifier.is_non_zero(), errors::INVALID_POLICY);
            assert(policy.active, errors::POLICY_INACTIVE);

            let now = get_block_timestamp();
            assert(now >= policy.valid_from && now < policy.valid_until, errors::POLICY_EXPIRED);
            assert(get_caller_address() == policy.audience, errors::AUDIENCE_MISMATCH);
            assert(result.audience == policy.audience, errors::AUDIENCE_MISMATCH);
            assert(result.job_id == expected_job_id, errors::JOB_MISMATCH);
            assert(result.input_commitment == expected_input_commitment, errors::INPUT_MISMATCH);
            assert(
                result.policy_id != 0
                    && result.job_id != 0
                    && result.input_commitment != 0
                    && result.evidence_commitment != 0
                    && result.result_commitment != 0
                    && (result.outcome == COMPUTE_OUTCOME_BUYER
                        || result.outcome == COMPUTE_OUTCOME_SELLER),
                errors::INVALID_RESULT,
            );
            assert(
                result.expires_at > now && result.expires_at <= policy.valid_until,
                errors::RESULT_EXPIRED,
            );

            let nullifier = result_nullifier(result);
            assert(!self.used_nullifiers.read(nullifier), errors::NULLIFIER_USED);

            let proof_result = IGroth16VerifierBN254Dispatcher {
                contract_address: policy.zk_verifier,
            }
                .verify_groth16_proof_bn254(full_proof_with_hints);
            let public_inputs = match proof_result {
                Result::Ok(inputs) => inputs,
                Result::Err(_) => panic_with_felt252(errors::PROOF_REJECTED),
            };
            assert(public_inputs.len() == 8, errors::PUBLIC_INPUT_COUNT);
            assert(
                *public_inputs.at(0) == result.input_commitment.into()
                    && *public_inputs.at(1) == result.policy_id.into()
                    && *public_inputs.at(2) == policy.program_commitment.into()
                    && *public_inputs.at(3) == policy.required_score.into()
                    && *public_inputs.at(4) == result.evidence_commitment
                    && *public_inputs.at(5) == result.result_commitment
                    && *public_inputs.at(6) == result.outcome.into()
                    && *public_inputs.at(7) == result.expires_at.into(),
                errors::PUBLIC_SIGNAL_MISMATCH,
            );

            self.used_nullifiers.write(nullifier, true);
            self
                .emit(
                    ResultConsumed {
                        policy_id: result.policy_id,
                        job_id: result.job_id,
                        nullifier,
                        result_commitment: result.result_commitment,
                        outcome: result.outcome,
                    },
                );
            if result.oyster_receipt_commitment != 0 {
                self
                    .emit(
                        OysterReceiptReferenced {
                            policy_id: result.policy_id,
                            job_id: result.job_id,
                            receipt_commitment: result.oyster_receipt_commitment,
                            expected_user_data_binding: oyster_binding(
                                get_contract_address(), get_tx_info().unbox().chain_id, result,
                            ),
                        },
                    );
            }
            result.outcome
        }

        fn set_policy(
            ref self: ContractState,
            policy_id: felt252,
            audience: ContractAddress,
            program_commitment: felt252,
            compute_policy_hash: felt252,
            required_score: u8,
            valid_from: u64,
            valid_until: u64,
            zk_verifier: ContractAddress,
        ) {
            self.assert_admin();
            assert(self.policies.read(policy_id).zk_verifier.is_zero(), errors::INVALID_POLICY);
            assert(
                policy_id != 0
                    && audience.is_non_zero()
                    && program_commitment != 0
                    && compute_policy_hash != 0
                    && required_score <= 100
                    && valid_until > valid_from
                    && zk_verifier.is_non_zero(),
                errors::INVALID_POLICY,
            );
            self
                .policies
                .write(
                    policy_id,
                    GigstarkComputePolicy {
                        audience,
                        program_commitment,
                        compute_policy_hash,
                        required_score,
                        valid_from,
                        valid_until,
                        zk_verifier,
                        active: true,
                    },
                );
            self
                .emit(
                    PolicyConfigured { policy_id, audience, program_commitment, zk_verifier },
                );
        }

        fn set_policy_active(ref self: ContractState, policy_id: felt252, active: bool) {
            self.assert_admin();
            let mut policy = self.policies.read(policy_id);
            assert(policy.zk_verifier.is_non_zero(), errors::INVALID_POLICY);
            policy.active = active;
            self.policies.write(policy_id, policy);
            self.emit(PolicyStatusChanged { policy_id, active });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), errors::ONLY_ADMIN);
        }
    }

    fn result_nullifier(result: GigstarkZkResult) -> felt252 {
        poseidon_hash_span(
            [
                COMPUTE_NULLIFIER_DOMAIN, result.policy_id, result.audience.into(), result.job_id,
                result.input_commitment, result.result_commitment.low.into(),
                result.result_commitment.high.into(), result.outcome.into(), result.expires_at.into(),
            ]
                .span(),
        )
    }

    fn oyster_binding(
        verifier: ContractAddress, chain_id: felt252, result: GigstarkZkResult,
    ) -> felt252 {
        poseidon_hash_span(
            [
                OYSTER_BINDING_DOMAIN, chain_id, verifier.into(), result.policy_id,
                result.audience.into(), result.job_id, result.input_commitment,
                result.evidence_commitment.low.into(), result.evidence_commitment.high.into(),
                result.result_commitment.low.into(), result.result_commitment.high.into(),
                result.outcome.into(), result.expires_at.into(),
            ]
                .span(),
        )
    }
}
