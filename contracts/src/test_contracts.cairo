use super::IActionAuthorizationVerifier;

fn authorization_key(
    role_commitment: felt252, action_statement: felt252, authorization_digest: felt252,
) -> felt252 {
    core::poseidon::poseidon_hash_span(
        [role_commitment, action_statement, authorization_digest].span(),
    )
}

#[starknet::interface]
pub trait IMockAuthorizationControl<TContractState> {
    fn set_authorized(
        ref self: TContractState,
        role_commitment: felt252,
        action_statement: felt252,
        authorization_digest: felt252,
        allowed: bool,
    );
}

#[starknet::contract]
pub mod MockAuthorizationVerifier {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use super::super::GigstarkPassportProof;
    use super::{IActionAuthorizationVerifier, IMockAuthorizationControl, authorization_key};

    #[storage]
    struct Storage {
        authorizations: starknet::storage::Map<felt252, bool>,
    }

    #[abi(embed_v0)]
    impl AuthorizationImpl of IActionAuthorizationVerifier<ContractState> {
        fn consume_authorization(
            ref self: ContractState,
            role_commitment: felt252,
            action_statement: felt252,
            proof: GigstarkPassportProof,
        ) -> bool {
            self
                .authorizations
                .read(authorization_key(role_commitment, action_statement, proof.proof_commitment))
        }
    }

    #[abi(embed_v0)]
    impl ControlImpl of IMockAuthorizationControl<ContractState> {
        fn set_authorized(
            ref self: ContractState,
            role_commitment: felt252,
            action_statement: felt252,
            authorization_digest: felt252,
            allowed: bool,
        ) {
            self
                .authorizations
                .write(
                    authorization_key(role_commitment, action_statement, authorization_digest),
                    allowed,
                );
        }
    }
}

#[starknet::contract]
pub mod MockGroth16VerifierBN254 {
    use super::super::compute_verifier::IGroth16VerifierBN254;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl VerifierImpl of IGroth16VerifierBN254<ContractState> {
        fn verify_groth16_proof_bn254(
            self: @ContractState, full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252> {
            if full_proof_with_hints.len() != 11
                || *full_proof_with_hints.at(0) != 'VALID_ZK_PROOF'
            {
                return Result::Err('MOCK_ZK_REJECT');
            }
            let evidence = u256 {
                low: (*full_proof_with_hints.at(5)).try_into().unwrap(),
                high: (*full_proof_with_hints.at(6)).try_into().unwrap(),
            };
            let result = u256 {
                low: (*full_proof_with_hints.at(7)).try_into().unwrap(),
                high: (*full_proof_with_hints.at(8)).try_into().unwrap(),
            };
            let public_inputs: Array<u256> = array![
                (*full_proof_with_hints.at(1)).into(),
                (*full_proof_with_hints.at(2)).into(),
                (*full_proof_with_hints.at(3)).into(),
                (*full_proof_with_hints.at(4)).into(),
                evidence,
                result,
                (*full_proof_with_hints.at(9)).into(),
                (*full_proof_with_hints.at(10)).into(),
            ];
            Result::Ok(public_inputs.span())
        }
    }
}
