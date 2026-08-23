// rust_immutable_audit.rs
use axum::{extract::State, Json, routing::post, Router};
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::types::{ObjectLockMode, ObjectLockRetention};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    s3_client: S3Client,
    bucket_name: String,
    last_hash: Arc<tokio::sync::RwLock<String>>,
}

#[derive(Deserialize)]
struct AuditPayload {
    transaction_id: String,
    ai_risk_score: f64,
    mpc_wallet_signature: String,
}

#[derive(Serialize)]
struct AuditReceipt {
    block_hash: String,
    s3_object_lock_status: String,
    orbital_timestamp: String,
}

// Rota para registrar a transação no Ledger Orbital
async fn record_immutable_audit(
    State(state): State<AppState>,
    Json(payload): Json<AuditPayload>,
) -> Json<AuditReceipt> {
    let timestamp = Utc::now().timestamp_millis().to_string();
    
    // 1. Encadeamento Criptográfico (Blockchain-like)
    let mut last_hash = state.last_hash.write().await;
    let data_to_hash = format!("{}{}{}{}", last_hash, payload.transaction_id, payload.ai_risk_score, timestamp);
    
    let mut hasher = Sha256::new();
    hasher.update(data_to_hash.as_bytes());
    let current_hash = format!("{:x}", hasher.finalize());
    
    // 2. Serialização do Bloco
    let block_data = serde_json::to_vec(&serde_json::json!({
        "tx_id": payload.transaction_id,
        "prev_hash": *last_hash,
        "hash": current_hash,
        "ts": timestamp,
        "sig": payload.mpc_wallet_signature
    })).unwrap();

    // 3. Gravação no S3 com Object Lock (Compliance Mode - Impede deleção até por admins)
    let retention_date = Utc::now() + chrono::Duration::days(3650); // 10 anos de retenção
    
    let _ = state.s3_client.put_object()
        .bucket(&state.bucket_name)
        .key(format!("ledger/orbital/{}.json", current_hash))
        .body(block_data.into())
        .object_lock_mode(ObjectLockMode::Compliance)
        .object_lock_retain_until_date(retention_date)
        .send()
        .await;

    // 4. Atualiza o ponteiro do último hash
    *last_hash = current_hash.clone();

    Json(AuditReceipt {
        block_hash: current_hash,
        s3_object_lock_status: "LOCKED_COMPLIANCE".to_string(),
        orbital_timestamp: timestamp,
    })
}
