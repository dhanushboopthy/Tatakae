# OCI Terraform

Creates the whole Oracle Cloud footprint for TATAKAE, all inside Always Free:

| Resource | Notes |
|---|---|
| VCN `10.0.0.0/16`, internet gateway, route table, public subnet `10.0.1.0/24` | |
| Security list | 80/tcp, 443/tcp, 443/udp (HTTP/3) and 41641/udp (Tailscale direct) from anywhere; 22/tcp only from `admin_cidr` while `allow_public_ssh = true` |
| `VM.Standard.A1.Flex` 2 OCPU / 12 GB | Latest Canonical Ubuntu 24.04 aarch64 image, 50 GB boot, IMDSv2 only |
| cloud-init | `deploy/cloud-init.yaml` rendered with `templatefile`; it embeds and runs `deploy/scripts/bootstrap.sh` |
| Reserved public IP | Attached to the VM's primary private IP; survives rebuilds (`prevent_destroy`) |
| 100 GB block volume (paravirtualized) | Mounted at `/srv/tatakae` by bootstrap; survives rebuilds (`prevent_destroy`) |
| Bucket `tatakae-backups` | Private, versioned; lifecycle purges previous versions after 30 days (+ the IAM policy lifecycle rules need) |
| Budget + alert rules | Optional, `enable_budget = true` |
| Customer Secret Key (S3 creds) | Optional, `create_s3_key = true` (secret ends up in local state) |

Step-by-step first-time setup (account, API key, Tailscale key, DNS) is in [docs/MANUAL-STEPS.md](../../docs/MANUAL-STEPS.md).

## Use
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill it in; it is git-ignored
terraform init                                 # commit the generated .terraform.lock.hcl
terraform plan
terraform apply
terraform output                               # public_ip, s3_endpoint, namespace, ...
```
State stays local (`terraform.tfstate`, git-ignored). Keep a copy in your password manager or private storage; it contains OCIDs and, if `create_s3_key = true`, the S3 secret.

## "Out of host capacity"
A1 capacity is often exhausted in busy regions. The network, bucket and volume are created anyway; only the instance fails, so just apply again:
- Retry at off-peak hours (early morning IST), e.g. `until terraform apply -auto-approve; do sleep 600; done` (stop it with Ctrl+C once it succeeds).
- In a region with several ADs, set `availability_domain` to another AD (Mumbai and Hyderabad have one AD each).
- Upgrading to Pay-As-You-Go usually makes capacity easier to get; Always Free resources stay free.

## Day-2 notes
- **Close public SSH** after Tailscale works: `allow_public_ssh = false`, `terraform apply`.
- **cloud-init runs only on first boot.** Changes to `deploy/cloud-init.yaml`, `bootstrap.sh`, the SSH key or a newer image are ignored on purpose. To rebuild the VM with them (the data volume and IP are kept): `terraform apply -replace=oci_core_instance.tatakae`. You need a fresh Tailscale auth key in `terraform.tfvars` for that, and remove the old machine from the tailnet first.
- On an existing VM, re-run the same steps by hand: `sudo /usr/local/sbin/tatakae-bootstrap` (idempotent).
- **Tearing everything down** requires removing the `prevent_destroy` lines for the public IP and data volume first. That deletes the database volume; make sure Litestream backups are current.
- User data is limited to 32 KB by OCI; the embedded bootstrap script is well under that.
