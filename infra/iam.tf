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

resource "aws_iam_instance_profile" "app" {
  name = "family-table-ec2"
  role = aws_iam_role.app.name
}
