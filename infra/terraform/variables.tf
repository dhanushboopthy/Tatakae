variable "region" {
  type    = string
  default = "ap-mumbai-1" # your home region (fixed at signup)
}
variable "compartment_id" { type = string }
variable "availability_domain" { type = string }
variable "ssh_public_key" { type = string }
variable "admin_cidr" {
  type        = string
  description = "Your current IP/32 for initial SSH"
}
