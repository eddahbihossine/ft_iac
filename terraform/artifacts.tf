data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  artifact_bucket_effective_name = length(trimspace(var.artifact_bucket_name)) > 0 ? var.artifact_bucket_name : lower(replace("${var.environment}-ft-iac-artifacts-${data.aws_caller_identity.current.account_id}-${local.selected_region}", "_", "-"))
  artifact_object_key            = "app-${local.app_deploy_hash}.zip"
}

data "archive_file" "app_zip" {
  count       = var.enable_alb ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/.."
  output_path = "${path.module}/app-${local.app_deploy_hash}.zip"

  excludes = [
    ".git",
    ".gitignore",
    ".nvmrc",
    ".venv",
    "hossine",
    "hossine.pub",
    "*.pem",
    "*.key",
    "node_modules",
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "e2e-tests",
    "terraform",
    ".env",
    ".env.local",
  ]
}

resource "aws_s3_bucket" "artifacts" {
  count  = var.enable_alb ? 1 : 0
  bucket = local.artifact_bucket_effective_name

  force_destroy = true

  tags = {
    Name = "${var.environment}-artifacts"
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  count  = var.enable_alb ? 1 : 0
  bucket = aws_s3_bucket.artifacts[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  count  = var.enable_alb ? 1 : 0
  bucket = aws_s3_bucket.artifacts[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_object" "app_zip" {
  count  = var.enable_alb ? 1 : 0
  bucket = aws_s3_bucket.artifacts[0].id
  key    = local.artifact_object_key
  source = data.archive_file.app_zip[0].output_path
  etag   = filemd5(data.archive_file.app_zip[0].output_path)

  content_type = "application/zip"
}

output "artifact_bucket" {
  value = var.enable_alb ? aws_s3_bucket.artifacts[0].bucket : ""
}

output "artifact_key" {
  value = var.enable_alb ? aws_s3_object.app_zip[0].key : ""
}
