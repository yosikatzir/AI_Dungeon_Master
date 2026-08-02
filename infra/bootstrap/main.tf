
# Bootstrap: creates the resources the main infra/ config needs to exist
# *before* it can use a remote backend (S3 bucket can't create the S3 bucket
# it stores its own state in). Run this once per AWS account; its own state
# stays local (see README.md in this directory) since it rarely changes and
# nothing here should ever be part of the app's destroy/redeploy cycle.
#
# Creates:
#   - S3 bucket for infra/'s Terraform state (versioned, encrypted)
#   - DynamoDB table for state locking
#   - S3 bucket for app data backups (versioned, encrypted) — survives a full
#     `terraform destroy` of infra/, since it's a separate state entirely.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  profile = var.aws_profile
  region  = var.region
}

variable "aws_profile" {
  type    = string
  default = "personal"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

data "aws_caller_identity" "current" {}

locals {
  state_bucket_name = "family-table-tfstate-${data.aws_caller_identity.current.account_id}"
  data_bucket_name  = "family-table-data-${data.aws_caller_identity.current.account_id}"
  lock_table_name   = "family-table-tfstate-lock"
}

# --- Terraform state bucket ---

resource "aws_s3_bucket" "tfstate" {
  bucket = local.state_bucket_name

  tags = {
    Name    = "family-table-tfstate"
    Purpose = "terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- State lock table ---

resource "aws_dynamodb_table" "tfstate_lock" {
  name         = local.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name    = "family-table-tfstate-lock"
    Purpose = "terraform-state-lock"
  }
}

# --- App data backup bucket ---
# Written to by the EC2 instance role (backup on teardown) and read back on
# first boot after a redeploy. Kept separate from the state bucket so the
# instance's IAM role never has any access to Terraform state.

resource "aws_s3_bucket" "data" {
  bucket = local.data_bucket_name

  tags = {
    Name    = "family-table-data"
    Purpose = "app-data-backup"
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
