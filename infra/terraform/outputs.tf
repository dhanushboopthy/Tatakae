output "public_ip" {
  description = "Reserved public IP. Point the DNS A record (tatakae.<name>.me) here."
  value       = oci_core_public_ip.tatakae.ip_address
}

output "instance_id" {
  value = oci_core_instance.tatakae.id
}

output "image" {
  description = "Image the VM was created from."
  value       = data.oci_core_images.ubuntu.images[0].display_name
}

output "bucket" {
  value = oci_objectstorage_bucket.backups.name
}

output "namespace" {
  description = "Object Storage namespace (part of the S3 endpoint)."
  value       = local.namespace
}

output "s3_endpoint" {
  description = "S3_ENDPOINT for /opt/tatakae/.env."
  value       = "https://${local.namespace}.compat.objectstorage.${var.region}.oraclecloud.com"
}

output "s3_region" {
  description = "S3_REGION for /opt/tatakae/.env."
  value       = var.region
}

output "s3_access_key_id" {
  description = "S3_ACCESS_KEY_ID (only when create_s3_key = true)."
  value       = var.create_s3_key ? oci_identity_customer_secret_key.s3[0].id : null
}

output "s3_secret_access_key" {
  description = "S3_SECRET_ACCESS_KEY (only when create_s3_key = true). Read with: terraform output -raw s3_secret_access_key"
  value       = var.create_s3_key ? oci_identity_customer_secret_key.s3[0].key : null
  sensitive   = true
}

output "ssh_public" {
  description = "Initial SSH (only while allow_public_ssh = true). Afterwards: ssh ubuntu@<tailscale_hostname>."
  value       = var.allow_public_ssh ? "ssh ubuntu@${oci_core_public_ip.tatakae.ip_address}" : "closed; use: ssh ubuntu@${var.tailscale_hostname}"
}
