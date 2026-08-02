#!/bin/bash
# Redeploy the app to the already-provisioned EC2 instance: pulls the latest
# master, rebuilds, and restarts the service. Infra itself is managed by
# Terraform (infra/) — this script only touches application code.
set -euo pipefail

cd "$(dirname "$0")/../infra"
IP=$(terraform output -raw public_ip)
KEY=$(terraform output -raw ssh_command | sed -n 's/.*-i \([^ ]*\).*/\1/p')

echo "Deploying to $IP ..."
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$IP" '
  set -euo pipefail
  sudo -u family-table bash -lc "cd /opt/family-table/app && git pull && npm ci"
  # better-sqlite3 bundled prebuilds/linux-arm64.node needs a newer glibc than
  # Amazon Linux 2023 ships; every fresh npm ci reintroduces it, so rebuild
  # from source and remove it each time. See infra/templates/user_data.sh.tftpl
  # for the full explanation.
  sudo -u family-table bash -lc "cd /opt/family-table/app/node_modules/better-sqlite3 && npm run build-release && rm -f prebuilds/linux-arm64.node"
  sudo -u family-table bash -lc "cd /opt/family-table/app && npm run build"
  sudo systemctl restart family-table
'
echo "Done. sudo systemctl status family-table on the instance to confirm."
