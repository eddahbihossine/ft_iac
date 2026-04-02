locals {
  # Friendly region names → AWS region identifiers.
  # Add your own aliases here without touching the rest of the code.
  region_map = {
    EU        = "eu-west-3"
    Paris     = "eu-west-3"
    Ireland   = "eu-west-1"
    Frankfurt = "eu-central-1"
    Stockholm = "eu-north-1"
    Virginia  = "us-east-1"
    Ohio      = "us-east-2"
  }

  selected_region = length(trimspace(var.aws_region)) > 0 ? var.aws_region : lookup(local.region_map, var.region_choice, "eu-west-3")

  server_instance_type_by_size = {
    small  = "t3.micro"
    medium = "t3.small"
    large  = "t3.medium"
  }

  server_root_volume_gb_by_size = {
    # Amazon Linux 2023 AMIs commonly require >= 30GB root volume.
    small  = 30
    medium = 30
    large  = 50
  }

  _server_instance_type_standard = length(trimspace(var.server_instance_type_override)) > 0 ? var.server_instance_type_override : local.server_instance_type_by_size[lower(trimspace(var.server_size))]
  _server_root_volume_standard   = local.server_root_volume_gb_by_size[lower(trimspace(var.server_size))]

  # In free mode, keep the server at the smallest tier.
  selected_server_instance_type  = lower(trimspace(var.cost_profile)) == "free" ? "t3.micro" : local._server_instance_type_standard
  selected_server_root_volume_gb = lower(trimspace(var.cost_profile)) == "free" ? 30 : local._server_root_volume_standard

  db_instance_class_by_size = {
    small  = "db.t3.micro"
    medium = "db.t3.small"
    large  = "db.t3.medium"
  }

  db_allocated_storage_gb_by_size = {
    small  = 20
    medium = 50
    large  = 100
  }

  selected_db_instance_class       = length(trimspace(var.db_instance_class_override)) > 0 ? var.db_instance_class_override : local.db_instance_class_by_size[lower(trimspace(var.db_size))]
  selected_db_allocated_storage_gb = local.db_allocated_storage_gb_by_size[lower(trimspace(var.db_size))]
}

check "region_choice_valid" {
  assert {
    condition     = length(trimspace(var.aws_region)) > 0 || contains(keys(local.region_map), var.region_choice)
    error_message = "Invalid region_choice. Use one of: ${join(", ", sort(keys(local.region_map)))} or set aws_region directly (e.g. eu-west-3)."
  }
}
