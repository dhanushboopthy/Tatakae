# Oracle Cloud (OCI) Always Free infrastructure for TATAKAE.
# Run from your laptop: terraform init && terraform plan && terraform apply (state stays local, never committed).
# Everything here fits the Always Free allowance: one A1 VM (2 OCPU / 12 GB), 50 GB boot + 100 GB block
# (≤ 200 GB total), one reserved public IP, one Object Storage bucket.
terraform {
  required_version = ">= 1.6"
  required_providers {
    oci = { source = "oracle/oci", version = "~> 6.0" }
  }
}

provider "oci" {
  region              = var.region
  config_file_profile = var.oci_config_profile # auth via ~/.oci/config (API key)
}

locals {
  compartment_id      = coalesce(var.compartment_id, var.tenancy_ocid)
  availability_domain = coalesce(var.availability_domain, data.oci_identity_availability_domains.all.availability_domains[0].name)
  tags                = { project = "tatakae" }

  vcn_cidr    = "10.0.0.0/16"
  subnet_cidr = "10.0.1.0/24"

  # Public ingress. 41641/udp lets Tailscale make direct (non-relayed) connections; it is optional but cheap.
  public_ingress = {
    http      = { protocol = "6", port = 80 }
    https     = { protocol = "6", port = 443 }
    http3     = { protocol = "17", port = 443 }
    tailscale = { protocol = "17", port = 41641 }
  }

  # IAM policies on the root compartment must say "in tenancy"; other compartments "in compartment id <ocid>".
  policy_scope = local.compartment_id == var.tenancy_ocid ? "tenancy" : "compartment id ${local.compartment_id}"

  namespace = data.oci_objectstorage_namespace.this.namespace
}

# ---------------------------------------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------------------------------------
data "oci_identity_availability_domains" "all" {
  compartment_id = var.tenancy_ocid
}

# Latest Canonical Ubuntu 24.04 aarch64 platform image that runs on A1.Flex (the regex skips "Minimal" builds).
data "oci_core_images" "ubuntu" {
  compartment_id           = local.compartment_id
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  state                    = "AVAILABLE"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"

  filter {
    name   = "display_name"
    values = ["^Canonical-Ubuntu-24\\.04-aarch64-.*$"]
    regex  = true
  }
}

data "oci_objectstorage_namespace" "this" {
  compartment_id = var.tenancy_ocid
}

# ---------------------------------------------------------------------------------------------------------
# Network: VCN → internet gateway → route table → public subnet + security list
# ---------------------------------------------------------------------------------------------------------
resource "oci_core_vcn" "tatakae" {
  compartment_id = local.compartment_id
  display_name   = "tatakae-vcn"
  cidr_blocks    = [local.vcn_cidr]
  dns_label      = "tatakae"
  freeform_tags  = local.tags
}

resource "oci_core_internet_gateway" "tatakae" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.tatakae.id
  display_name   = "tatakae-igw"
  enabled        = true
  freeform_tags  = local.tags
}

resource "oci_core_route_table" "public" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.tatakae.id
  display_name   = "tatakae-public-rt"
  freeform_tags  = local.tags

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.tatakae.id
  }
}

resource "oci_core_security_list" "public" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.tatakae.id
  display_name   = "tatakae-public-sl"
  freeform_tags  = local.tags

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
    stateless   = false
  }

  dynamic "ingress_security_rules" {
    for_each = local.public_ingress
    content {
      description = ingress_security_rules.key
      protocol    = ingress_security_rules.value.protocol
      source      = "0.0.0.0/0"
      stateless   = false

      dynamic "tcp_options" {
        for_each = ingress_security_rules.value.protocol == "6" ? [1] : []
        content {
          min = ingress_security_rules.value.port
          max = ingress_security_rules.value.port
        }
      }

      dynamic "udp_options" {
        for_each = ingress_security_rules.value.protocol == "17" ? [1] : []
        content {
          min = ingress_security_rules.value.port
          max = ingress_security_rules.value.port
        }
      }
    }
  }

  # Public SSH only from your own IP, and only until Tailscale SSH works (then set allow_public_ssh = false).
  dynamic "ingress_security_rules" {
    for_each = var.allow_public_ssh ? [1] : []
    content {
      description = "ssh (admin only, temporary)"
      protocol    = "6"
      source      = var.admin_cidr
      stateless   = false
      tcp_options {
        min = 22
        max = 22
      }
    }
  }

  # ICMP "fragmentation needed" (path MTU discovery) from anywhere, plus unreachable messages inside the VCN.
  # These mirror OCI's default security list.
  ingress_security_rules {
    description = "icmp path mtu"
    protocol    = "1"
    source      = "0.0.0.0/0"
    icmp_options {
      type = 3
      code = 4
    }
  }

  ingress_security_rules {
    description = "icmp unreachable (vcn)"
    protocol    = "1"
    source      = local.vcn_cidr
    icmp_options {
      type = 3
    }
  }
}

resource "oci_core_subnet" "public" {
  compartment_id             = local.compartment_id
  vcn_id                     = oci_core_vcn.tatakae.id
  display_name               = "tatakae-public"
  cidr_block                 = local.subnet_cidr
  dns_label                  = "public"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.public.id]
  prohibit_public_ip_on_vnic = false
  freeform_tags              = local.tags
}

# ---------------------------------------------------------------------------------------------------------
# Compute: one A1.Flex VM. cloud-init runs deploy/scripts/bootstrap.sh on first boot.
# ---------------------------------------------------------------------------------------------------------
resource "oci_core_instance" "tatakae" {
  compartment_id      = local.compartment_id
  availability_domain = local.availability_domain
  display_name        = "tatakae"
  shape               = "VM.Standard.A1.Flex"
  freeform_tags       = local.tags

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_gb
    boot_volume_vpus_per_gb = 10 # Balanced
  }

  create_vnic_details {
    subnet_id                 = oci_core_subnet.public.id
    display_name              = "tatakae-vnic"
    hostname_label            = "tatakae"
    assign_public_ip          = false # the reserved IP below is attached instead (stable across rebuilds)
    assign_private_dns_record = true
  }

  # Instance metadata service v2 only (blocks the legacy v1 endpoints; cloud-init on 24.04 uses v2).
  instance_options {
    are_legacy_imds_endpoints_disabled = true
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/../../deploy/cloud-init.yaml", {
      bootstrap_script_b64 = filebase64("${path.module}/../../deploy/scripts/bootstrap.sh")
      tailscale_auth_key   = var.tailscale_auth_key
      tailscale_hostname   = var.tailscale_hostname
      admin_user           = "ubuntu"
    }))
  }

  preserve_boot_volume = false

  lifecycle {
    # cloud-init only runs on first boot, and newer images appear every few weeks. Neither should silently
    # rebuild the VM. To apply new user_data or a new image on purpose:
    #   terraform apply -replace=oci_core_instance.tatakae
    ignore_changes = [source_details[0].source_id, metadata]

    precondition {
      condition     = length(data.oci_core_images.ubuntu.images) > 0
      error_message = "No Canonical Ubuntu 24.04 aarch64 image found for VM.Standard.A1.Flex in this region/compartment."
    }
  }
}

# ---------------------------------------------------------------------------------------------------------
# Reserved public IP → the instance's primary private IP (so DNS never has to change on a rebuild)
# ---------------------------------------------------------------------------------------------------------
data "oci_core_vnic_attachments" "tatakae" {
  compartment_id = local.compartment_id
  instance_id    = oci_core_instance.tatakae.id
}

data "oci_core_private_ips" "tatakae" {
  vnic_id = data.oci_core_vnic_attachments.tatakae.vnic_attachments[0].vnic_id
}

resource "oci_core_public_ip" "tatakae" {
  compartment_id = local.compartment_id
  display_name   = "tatakae-ip"
  lifetime       = "RESERVED"
  private_ip_id  = one([for ip in data.oci_core_private_ips.tatakae.private_ips : ip.id if ip.is_primary])
  freeform_tags  = local.tags

  lifecycle {
    # DNS points here. Remove this guard only if you really want to give the address back.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------------------------------------
# Data volume: 100 GB block volume, paravirtualized (shows up as a plain disk, no iSCSI commands needed).
# bootstrap.sh formats it only if it is blank and mounts it at /srv/tatakae.
# ---------------------------------------------------------------------------------------------------------
resource "oci_core_volume" "data" {
  compartment_id      = local.compartment_id
  availability_domain = local.availability_domain
  display_name        = "tatakae-data"
  size_in_gbs         = var.data_volume_gb
  vpus_per_gb         = 10 # Balanced
  freeform_tags       = local.tags

  lifecycle {
    # Holds the SQLite database and uploaded files. Rebuilding the VM keeps this volume.
    prevent_destroy = true
  }
}

resource "oci_core_volume_attachment" "data" {
  attachment_type = "paravirtualized"
  instance_id     = oci_core_instance.tatakae.id
  volume_id       = oci_core_volume.data.id
  display_name    = "tatakae-data"
  is_read_only    = false
  is_shareable    = false
}

# ---------------------------------------------------------------------------------------------------------
# Object Storage: backups (Litestream WAL replication + nightly JSON exports), versioned.
# ---------------------------------------------------------------------------------------------------------
resource "oci_objectstorage_bucket" "backups" {
  compartment_id = local.compartment_id
  namespace      = local.namespace
  name           = var.bucket_name
  access_type    = "NoPublicAccess"
  storage_tier   = "Standard"
  versioning     = "Enabled"
  freeform_tags  = local.tags
}

# Object lifecycle rules run as the Object Storage service, which needs this IAM policy.
resource "oci_identity_policy" "objectstorage_lifecycle" {
  compartment_id = var.tenancy_ocid
  name           = "tatakae-objectstorage-lifecycle"
  description    = "Lets Object Storage apply lifecycle rules to the tatakae backup bucket"
  statements     = ["Allow service objectstorage-${var.region} to manage object-family in ${local.policy_scope}"]
  freeform_tags  = local.tags
}

# Versioning keeps every object Litestream deletes; purge those old versions so the 20 GB free tier is not
# slowly filled with history, and clean up abandoned multipart uploads.
resource "oci_objectstorage_object_lifecycle_policy" "backups" {
  namespace = local.namespace
  bucket    = oci_objectstorage_bucket.backups.name

  rules {
    name        = "purge-previous-versions"
    action      = "DELETE"
    target      = "previous-object-versions"
    is_enabled  = true
    time_amount = var.backup_previous_version_days
    time_unit   = "DAYS"
  }

  rules {
    name        = "abort-stale-multipart-uploads"
    action      = "ABORT"
    target      = "multipart-uploads"
    is_enabled  = true
    time_amount = 7
    time_unit   = "DAYS"
  }

  depends_on = [oci_identity_policy.objectstorage_lifecycle]
}

# ---------------------------------------------------------------------------------------------------------
# Optional: monthly budget with an alert on any real spend (useful after the Pay-As-You-Go upgrade).
# The amount is in your tenancy's currency (INR for an Indian account → ₹1).
# ---------------------------------------------------------------------------------------------------------
resource "oci_budget_budget" "monthly" {
  count = var.enable_budget ? 1 : 0

  compartment_id = var.tenancy_ocid
  display_name   = "tatakae-monthly"
  description    = "Alert on any spend outside Always Free"
  amount         = var.budget_amount
  reset_period   = "MONTHLY"
  target_type    = "COMPARTMENT"
  targets        = [var.tenancy_ocid]
  freeform_tags  = local.tags

  lifecycle {
    precondition {
      condition     = length(trimspace(var.budget_alert_email)) > 0
      error_message = "Set budget_alert_email when enable_budget = true."
    }
  }
}

resource "oci_budget_alert_rule" "actual" {
  count = var.enable_budget ? 1 : 0

  budget_id      = oci_budget_budget.monthly[0].id
  display_name   = "tatakae-actual-spend"
  description    = "Actual spend reached the budget"
  type           = "ACTUAL"
  threshold_type = "PERCENTAGE"
  threshold      = 100
  recipients     = var.budget_alert_email
  message        = "TATAKAE: Oracle Cloud spend reached the budget. Something is outside Always Free; check Cost Analysis."
}

resource "oci_budget_alert_rule" "forecast" {
  count = var.enable_budget ? 1 : 0

  budget_id      = oci_budget_budget.monthly[0].id
  display_name   = "tatakae-forecast-spend"
  description    = "Forecast spend will exceed the budget"
  type           = "FORECAST"
  threshold_type = "PERCENTAGE"
  threshold      = 100
  recipients     = var.budget_alert_email
  message        = "TATAKAE: Oracle Cloud forecasts spend above the budget this month. Check Cost Analysis."
}

# ---------------------------------------------------------------------------------------------------------
# Optional: S3-compatible credentials (Customer Secret Key) for Litestream and the backup job.
# Off by default: the secret then lives in terraform.tfstate. Creating it in the console is fine too.
# OCI allows at most 2 customer secret keys per user.
# ---------------------------------------------------------------------------------------------------------
resource "oci_identity_customer_secret_key" "s3" {
  count = var.create_s3_key ? 1 : 0

  display_name = "tatakae-backups"
  user_id      = var.user_ocid

  lifecycle {
    precondition {
      condition     = var.user_ocid != null
      error_message = "Set user_ocid when create_s3_key = true."
    }
  }
}
