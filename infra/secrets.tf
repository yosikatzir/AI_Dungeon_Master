resource "aws_secretsmanager_secret" "app_env" {
  name        = "family-table/app-env"
  description = "Dotenv-format string (OPENAI_API_KEY, SESSION_SECRET) fetched by the app server at start. Value is set manually outside Terraform."

  # AWS defaults to a 30-day recovery window before actually deleting a
  # secret, which would block `terraform apply` from recreating a
  # same-named secret on the very next redeploy after a `terraform destroy`.
  # That 30-day safety net doesn't protect anything here — the secret's
  # value is never stored in Terraform state and is always re-entered
  # manually — so skip it in favor of a clean destroy/recreate cycle.
  recovery_window_in_days = 0
}

# Deliberately no aws_secretsmanager_secret_version here. The real value is
# populated out-of-band (see README's AWS deployment runbook) so secrets
# never enter Terraform state or version control.
