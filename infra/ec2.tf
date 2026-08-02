resource "aws_key_pair" "deploy" {
  key_name   = "family-table-deploy"
  public_key = file(var.ssh_public_key_path)
}

data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# Allocated standalone (not via aws_instance's `instance` attribute) so its
# address is known before the instance exists — user_data below bakes it into
# the self-signed cert's SAN, which would otherwise create a dependency cycle
# (instance needs the IP, EIP needs the instance).
resource "aws_eip" "app" {
  domain = "vpc"

  tags = {
    Name = "family-table"
  }
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023_arm.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnet.selected.id
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  key_name                    = aws_key_pair.deploy.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 30 # AL2023 arm64 AMI's snapshot requires >= 30GB
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    secret_name  = aws_secretsmanager_secret.app_env.name
    repo_url     = var.repo_url
    region       = var.region
    public_ip    = aws_eip.app.public_ip
    data_bucket  = var.data_bucket_name
    nginx_conf   = file("${path.module}/templates/nginx.conf")
    systemd_unit = file("${path.module}/templates/family-table.service")
  })

  # The data volume is attached separately (storage.tf) and user_data resolves
  # its NVMe path at boot rather than assuming a fixed device name.
  tags = {
    Name = "family-table"
  }
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}
