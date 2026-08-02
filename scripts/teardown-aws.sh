#!/bin/bash
# Tears down all AWS infra for Family Table (EC2, EBS, EIP, security group,
# IAM role, Secrets Manager secret) after backing up app data to S3.
#
# Data is restored automatically on the next `terraform apply` — see the
# restore block in infra/templates/user_data.sh.tftpl. The S3 data bucket
# and Terraform state bucket (infra/bootstrap/) are NOT touched by this
# script or by `terraform destroy` in infra/ — they're a separate state,
# by design, so they survive every teardown/redeploy cycle.
set -euo pipefail

cd "$(dirname "$0")/../infra"

IP=$(terraform output -raw public_ip 2>/dev/null || echo "")

if [ -z "$IP" ]; then
  echo "No running instance found in Terraform state — nothing to back up."
else
  KEY=$(terraform output -raw ssh_command | sed -n 's/.*-i \([^ ]*\).*/\1/p')
  DATA_BUCKET=$(terraform output -raw data_bucket_name)
  REGION=$(terraform output -raw region)

  echo "Backing up app data to s3://$DATA_BUCKET/data/ ..."
  ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$IP" "
    set -euo pipefail
    sudo systemctl stop family-table
    sudo -u family-table aws s3 sync /opt/family-table/app/data/ s3://$DATA_BUCKET/data/ \
      --region $REGION --exclude 'tls/*' --delete
  "
  echo "Backup complete."
fi

echo
echo "About to destroy all AWS infrastructure for Family Table."
echo "(The S3 data backup and Terraform state bucket are separate and will NOT be destroyed.)"
terraform destroy
