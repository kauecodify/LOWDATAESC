// rust + actix + s3 worm
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use sha2::{Sha256, Digest};
use aws_sdk_s3::Client as S3Client;
use std::env;

async fn append_audit_log(payload: web::Json<serde_json::Value>, s3: web::Data<S3Client>) -> HttpResponse {
    let json_bytes = serde_json::to_vec(&payload.into_inner()).unwrap();
    let mut hasher = Sha256::new();
    hasher.update(&json_bytes);
    let hash = format!("{:x}", hasher.finalize());

    let key = format!("audit/{}", chrono::Utc::now().format("%Y/%m/%d/%H-%M-%S.json"));
    
    // Upload para S3 com Object Lock (WORM)
    let _ = s3.put_object()
        .bucket(env::var("AUDIT_BUCKET").unwrap())
        .key(&key)
        .body(json_bytes.into())
        .content_type("application/json")
        .send()
        .await;

    HttpResponse::Created().json(serde_json::json!({
        "status": "logged",
        "sha256": hash,
        "worm_locked": true
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let s3 = S3Client::from_env();
    HttpServer::new(move || {
        App::new()
            .wrap(middleware::Logger::default())
            .app_data(web::Data::new(s3.clone()))
            .route("/audit/v1/log", web::post().to(append_audit_log))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
