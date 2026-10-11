# OCI Terraform

1. Create an OCI API key (Profile → API keys) and `~/.oci/config`.
2. `cp terraform.tfvars.example terraform.tfvars` and fill it in.
3. `terraform init && terraform plan && terraform apply`.

"Out of host capacity" for A1 is common in busy regions. Retry at off-peak hours, try another availability domain in your home region, or upgrade to Pay-As-You-Go (capacity is usually easier to get and you are still not charged within Always Free limits).
