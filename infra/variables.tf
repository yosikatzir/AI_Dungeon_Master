variable "aws_profile" {
  description = "AWS CLI profile to use (personal account, 287496344353)."
  type        = string
  default     = "personal"
}

variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type for the app server."
  type        = string
  default     = "t4g.small"
}

variable "admin_cidr" {
  description = "CIDR allowed to SSH into the instance (your IP, e.g. 1.2.3.4/32). No default on purpose — must be set explicitly."
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to the public half of the SSH key used for admin/deploy access."
  type        = string
  default     = "~/.ssh/family-table-aws.pub"
}

variable "data_volume_size_gb" {
  description = "Size in GB of the persistent EBS volume holding data/app.db and data/images."
  type        = number
  default     = 20
}

variable "repo_url" {
  description = "Git URL the instance clones on first boot."
  type        = string
  default     = "https://github.com/yosikatzir/AI_Dungeon_Master.git"
}
