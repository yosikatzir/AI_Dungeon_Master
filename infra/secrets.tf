resource "aws_secretsmanager_secret" "app_env" {
  name        = "family-table/app-env"
  description = "Dotenv-format string (OPENAI_API_KEY, SESSION_SECRET) fetched by the app server at start. Value is set manually outside Terraform."
}

# Deliberately no aws_secretsmanager_secret_version here. The real value is
# populated out-of-band (see README's AWS deployment runbook) so secrets
# never enter Terraform state or version control.
