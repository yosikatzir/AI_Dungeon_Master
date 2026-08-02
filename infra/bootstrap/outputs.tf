output "state_bucket_name" {
  value = aws_s3_bucket.tfstate.bucket
}

output "data_bucket_name" {
  value = aws_s3_bucket.data.bucket
}

output "lock_table_name" {
  value = aws_dynamodb_table.tfstate_lock.name
}
