# ---- Account ------------------------------------------------------------------------------------------
variable "region" {
  type        = string
  default     = "ap-mumbai-1"
  description = "Your OCI home region (fixed at sign-up). Always Free A1 capacity is only in the home region."
}

variable "oci_config_profile" {
  type        = string
  default     = "DEFAULT"
  description = "Profile in ~/.oci/config used for authentication."
}

variable "tenancy_ocid" {
  type        = string
  description = "Tenancy OCID (Profile → Tenancy). Budgets and IAM policies live here."
}

variable "compartment_id" {
  type        = string
  default     = null
  description = "Compartment for all resources. Defaults to the tenancy (root compartment)."
}

variable "user_ocid" {
  type        = string
  default     = null
  description = "Your user OCID. Only needed when create_s3_key = true."
}

variable "availability_domain" {
  type        = string
  default     = null
  description = "e.g. \"xxxx:AP-MUMBAI-1-AD-1\". Defaults to the first AD. Change it to retry on 'Out of host capacity' in multi-AD regions."
}

# ---- Access -------------------------------------------------------------------------------------------
variable "ssh_public_key" {
  type        = string
  description = "Public key for the default 'ubuntu' user (e.g. contents of ~/.ssh/tatakae.pub)."
}

variable "admin_cidr" {
  type        = string
  description = "Your current public IP as /32, allowed to reach port 22 while allow_public_ssh = true."

  validation {
    condition     = can(cidrhost(var.admin_cidr, 0))
    error_message = "admin_cidr must be a CIDR block, e.g. 203.0.113.10/32."
  }
}

variable "allow_public_ssh" {
  type        = bool
  default     = true
  description = "Open 22/tcp from admin_cidr. Set to false once `ssh ubuntu@tatakae` over Tailscale works."
}

variable "tailscale_auth_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "One-off, pre-approved Tailscale auth key (tag:server). Empty = run `sudo tailscale up --ssh` by hand."
}

variable "tailscale_hostname" {
  type        = string
  default     = "tatakae"
  description = "Machine name on the tailnet (MagicDNS name)."
}

# ---- Sizing (Always Free: 2 OCPU / 12 GB A1 total, 200 GB block storage total) ---------------------------
variable "instance_ocpus" {
  type    = number
  default = 2
}

variable "instance_memory_gb" {
  type    = number
  default = 12
}

variable "boot_volume_gb" {
  type    = number
  default = 50

  validation {
    condition     = var.boot_volume_gb >= 50
    error_message = "OCI boot volumes are at least 50 GB."
  }
}

variable "data_volume_gb" {
  type    = number
  default = 100

  validation {
    condition     = var.data_volume_gb >= 50 && var.data_volume_gb <= 150
    error_message = "Keep boot + data within the 200 GB Always Free block storage (data volume 50–150 GB)."
  }
}

# ---- Backups ------------------------------------------------------------------------------------------
variable "bucket_name" {
  type    = string
  default = "tatakae-backups"
}

variable "backup_previous_version_days" {
  type        = number
  default     = 30
  description = "Days to keep previous (overwritten or deleted) object versions in the backup bucket."
}

variable "create_s3_key" {
  type        = bool
  default     = false
  description = "Create a Customer Secret Key (S3 credentials) for user_ocid. The secret is stored in terraform state."
}

# ---- Budget -------------------------------------------------------------------------------------------
variable "enable_budget" {
  type        = bool
  default     = false
  description = "Create a monthly budget + alert rules (recommended after upgrading to Pay-As-You-Go)."
}

variable "budget_amount" {
  type        = number
  default     = 1
  description = "Monthly budget in the tenancy currency (1 = ₹1 for an INR account)."
}

variable "budget_alert_email" {
  type        = string
  default     = ""
  description = "Where budget alerts go. Required when enable_budget = true."
}
