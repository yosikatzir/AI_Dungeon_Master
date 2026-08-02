# Remote state so this can be applied/destroyed from any machine with this
# repo and AWS credentials for the `personal` profile. Bucket, lock table,
# and the data-backup bucket referenced elsewhere in this config are created
# once by infra/bootstrap/ (not part of this state) — see that directory's
# main.tf for why it's a separate stack.
terraform {
  backend "s3" {
    bucket         = "family-table-tfstate-287496344353"
    key            = "family-table/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "family-table-tfstate-lock"
    encrypt        = true
  }
}
