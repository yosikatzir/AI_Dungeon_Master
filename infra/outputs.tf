output "public_ip" {
  description = "Elastic IP of the app server."
  value       = aws_eip.app.public_ip
}

output "ssh_command" {
  description = "SSH command to reach the instance."
  value       = "ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} ec2-user@${aws_eip.app.public_ip}"
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret holding OPENAI_API_KEY / SESSION_SECRET."
  value       = aws_secretsmanager_secret.app_env.arn
}

output "admin_password_hint" {
  description = "How to retrieve the one-time generated admin password after first boot."
  value       = "ssh in, then: sudo grep -A1 -i 'admin password' /var/log/cloud-init-output.log"
}

output "data_bucket_name" {
  description = "S3 bucket used by scripts/teardown-aws.sh to back up app data before destroy."
  value       = var.data_bucket_name
}

output "region" {
  description = "AWS region this is deployed into."
  value       = var.region
}
