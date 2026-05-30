resource "aws_s3_bucket" "audit" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_object_lock_configuration" "audit_lock" {
  bucket = aws_s3_bucket.audit.id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      years = var.retention_years
    }
  }
}
