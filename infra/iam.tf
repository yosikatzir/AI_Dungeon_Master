data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "family-table-ec2"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy" "secrets" {
  name = "family-table-secrets-read"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.app_env.arn
    }]
  })
}

resource "aws_iam_role_policy" "data_bucket" {
  name = "family-table-data-backup"
  role = aws_iam_role.app.id

  # Scoped to the data/ prefix only — this role never touches the Terraform
  # state bucket (that one it has no permissions on at all).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${var.data_bucket_name}"
        Condition = {
          StringLike = { "s3:prefix" = "data/*" }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${var.data_bucket_name}/data/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "transcribe_tmp_bucket" {
  name = "family-table-transcribe-tmp"
  role = aws_iam_role.app.id

  # Same data bucket as above, different prefix — scratch space for
  # in-flight voice transcription uploads (app/api/campaigns/[id]/transcribe).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${var.data_bucket_name}"
        Condition = {
          StringLike = { "s3:prefix" = "transcribe-tmp/*" }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${var.data_bucket_name}/transcribe-tmp/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "bedrock" {
  name = "family-table-bedrock"
  role = aws_iam_role.app.id

  # Foundation-model ARNs have no account segment (AWS-owned, shared across
  # accounts) — region wildcarded since cross-region inference profiles may
  # dispatch to foundation models outside this account's home region.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
      Resource = [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-5",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
        "arn:aws:bedrock:${var.region}:${data.aws_caller_identity.current.account_id}:inference-profile/us.anthropic.claude-sonnet-5",
        "arn:aws:bedrock:${var.region}:${data.aws_caller_identity.current.account_id}:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
      ]
    }]
  })
}

resource "aws_iam_role_policy" "transcribe" {
  name = "family-table-transcribe"
  role = aws_iam_role.app.id

  # Job names are per-request UUIDs generated at runtime, so they can't be
  # enumerated ahead of time — wildcarded within this account/region only.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob",
        "transcribe:DeleteTranscriptionJob",
      ]
      Resource = "arn:aws:transcribe:${var.region}:${data.aws_caller_identity.current.account_id}:transcription-job/*"
    }]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "family-table-ec2"
  role = aws_iam_role.app.name
}
