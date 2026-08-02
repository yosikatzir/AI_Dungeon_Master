resource "aws_ebs_volume" "data" {
  availability_zone = data.aws_subnet.selected.availability_zone
  size              = var.data_volume_size_gb
  type              = "gp3"

  tags = {
    Name = "family-table-data"
  }
}

resource "aws_volume_attachment" "data" {
  # Device name is a hint only: Nitro-based instances (t4g) expose EBS
  # volumes as NVMe devices regardless of what's specified here. user_data
  # resolves the real path via /dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_<volume-id>.
  device_name  = "/dev/sdf"
  volume_id    = aws_ebs_volume.data.id
  instance_id  = aws_instance.app.id
  force_detach = false
}
