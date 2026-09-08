use std::error::Error;
use std::io::{Read, Write};
use std::str::FromStr;

use ark_bn254::Fr;
use ark_ff::PrimeField;
use light_poseidon::{Poseidon, PoseidonHasher};
use serde::{Deserialize, Serialize};

#[cfg(target_os = "linux")]
const PORT: u32 = 5005;
const MAX_REQUEST_BYTES: usize = 64 * 1024;
const OUTCOME_BUYER: u8 = 1;
const OUTCOME_SELLER: u8 = 2;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DisputeRequest {
    dispute_input_commitment: String,
    policy_id: String,
    program_measurement_commitment: String,
    required_score: u8,
    expires_at: u64,
    evidence_score: u8,
    evidence_nonce: String,
}

#[derive(Serialize)]
struct DisputeResult {
    dispute_input_commitment: String,
    policy_id: String,
    program_measurement_commitment: String,
    required_score: u8,
    evidence_commitment: String,
    result_commitment: String,
    outcome: u8,
    expires_at: u64,
}

fn parse_field(value: &str, label: &str) -> Result<Fr, Box<dyn Error>> {
    Fr::from_str(value).map_err(|_| format!("{label} is not a canonical BN254 field value").into())
}

fn field_to_decimal(value: Fr) -> String {
    value.into_bigint().to_string()
}

fn evaluate(request: DisputeRequest) -> Result<DisputeResult, Box<dyn Error>> {
    if request.required_score > 100 || request.evidence_score > 100 {
        return Err("scores must be between 0 and 100".into());
    }

    let dispute_input = parse_field(
        &request.dispute_input_commitment,
        "dispute_input_commitment",
    )?;
    let policy_id = parse_field(&request.policy_id, "policy_id")?;
    let measurement = parse_field(
        &request.program_measurement_commitment,
        "program_measurement_commitment",
    )?;
    let evidence_nonce = parse_field(&request.evidence_nonce, "evidence_nonce")?;
    let outcome = if request.evidence_score >= request.required_score {
        OUTCOME_SELLER
    } else {
        OUTCOME_BUYER
    };

    let evidence_commitment =
        Poseidon::<Fr>::new_circom(2)?.hash(&[Fr::from(request.evidence_score), evidence_nonce])?;
    let result_commitment = Poseidon::<Fr>::new_circom(6)?.hash(&[
        dispute_input,
        policy_id,
        measurement,
        evidence_commitment,
        Fr::from(outcome),
        Fr::from(request.expires_at),
    ])?;

    Ok(DisputeResult {
        dispute_input_commitment: request.dispute_input_commitment,
        policy_id: request.policy_id,
        program_measurement_commitment: request.program_measurement_commitment,
        required_score: request.required_score,
        evidence_commitment: field_to_decimal(evidence_commitment),
        result_commitment: field_to_decimal(result_commitment),
        outcome,
        expires_at: request.expires_at,
    })
}

fn process_json(input: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    if input.is_empty() || input.len() > MAX_REQUEST_BYTES {
        return Err("invalid request length".into());
    }
    let request: DisputeRequest = serde_json::from_slice(input)?;
    Ok(serde_json::to_vec(&evaluate(request)?)?)
}

fn run_stdio_once() -> Result<(), Box<dyn Error>> {
    let mut input = Vec::new();
    std::io::stdin()
        .take(MAX_REQUEST_BYTES as u64 + 1)
        .read_to_end(&mut input)?;
    let response = process_json(&input)?;
    std::io::stdout().write_all(&response)?;
    std::io::stdout().write_all(b"\n")?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn run_vsock() -> Result<(), Box<dyn Error>> {
    use vsock::{VMADDR_CID_ANY, VsockListener};

    let listener = VsockListener::bind_with_cid_port(VMADDR_CID_ANY, PORT)?;
    for stream in listener.incoming() {
        let mut stream = stream?;
        let mut length_bytes = [0_u8; 4];
        stream.read_exact(&mut length_bytes)?;
        let length = u32::from_be_bytes(length_bytes) as usize;
        if length == 0 || length > MAX_REQUEST_BYTES {
            continue;
        }
        let mut request = vec![0_u8; length];
        stream.read_exact(&mut request)?;
        match process_json(&request) {
            Ok(response) => {
                stream.write_all(&(response.len() as u32).to_be_bytes())?;
                stream.write_all(&response)?;
            }
            Err(_) => {
                // Never echo private request contents or parsing details.
                let response = br#"{"error":"INVALID_DISPUTE_REQUEST"}"#;
                stream.write_all(&(response.len() as u32).to_be_bytes())?;
                stream.write_all(response)?;
            }
        }
    }
    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn run_vsock() -> Result<(), Box<dyn Error>> {
    Err("vsock runtime requires Linux; use --stdio-once for local fixture generation".into())
}

fn main() -> Result<(), Box<dyn Error>> {
    if std::env::args().nth(1).as_deref() == Some("--stdio-once") {
        run_stdio_once()
    } else {
        run_vsock()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(score: u8) -> DisputeRequest {
        DisputeRequest {
            dispute_input_commitment: "1001".into(),
            policy_id: "2001".into(),
            program_measurement_commitment: "3001".into(),
            required_score: 80,
            expires_at: 2_000_000_000,
            evidence_score: score,
            evidence_nonce: "12345".into(),
        }
    }

    #[test]
    fn seller_wins_at_or_above_threshold() {
        assert_eq!(evaluate(request(92)).unwrap().outcome, OUTCOME_SELLER);
        assert_eq!(evaluate(request(80)).unwrap().outcome, OUTCOME_SELLER);
    }

    #[test]
    fn buyer_wins_below_threshold() {
        assert_eq!(evaluate(request(79)).unwrap().outcome, OUTCOME_BUYER);
    }

    #[test]
    fn rejects_out_of_range_score() {
        assert!(evaluate(request(101)).is_err());
    }
}
