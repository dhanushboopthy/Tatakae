# Oracle Cloud (OCI) Always Free infrastructure for TATAKAE.
# Run from your laptop: terraform init && terraform apply  (state stays local or in OCI Object Storage backend).
terraform {
  required_version = ">= 1.6"
  required_providers {
    oci = { source = "oracle/oci", version = "~> 6.0" }
  }
}

provider "oci" {
  region = var.region   # auth via ~/.oci/config (API key)
}

# TODO(phase0): oci_core_vcn            "tatakae"  (10.0.0.0/16)
# TODO(phase0): oci_core_internet_gateway + route table
# TODO(phase0): oci_core_subnet         public, 10.0.1.0/24
# TODO(phase0): oci_core_security_list  ingress 80/tcp, 443/tcp, 443/udp from 0.0.0.0/0;
#                                       22/tcp ONLY from var.admin_cidr (remove once Tailscale works)
# TODO(phase0): oci_core_instance       shape VM.Standard.A1.Flex, ocpus = 2, memory_in_gbs = 12,
#                                       Ubuntu 24.04 aarch64 image, boot volume 50 GB,
#                                       user_data = base64encode(file("../../deploy/cloud-init.yaml"))
# TODO(phase0): oci_core_public_ip      lifetime = "RESERVED" (static IP for DNS)
# TODO(phase0): oci_core_volume         100 GB block volume + attachment → /srv/tatakae  (total ≤ 200 GB free)
# TODO(phase0): oci_objectstorage_bucket "tatakae-backups" (versioning on)
# TODO(phase0): oci_budget_budget        ₹1 alert (only if account upgraded to Pay-As-You-Go)
