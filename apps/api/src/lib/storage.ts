import type { Env } from "../env";

/** Files live on local disk (FILES_DIR). Off-box copies go to S3-compatible Object Storage. */
export async function putObject(env: Env, key: string, body: Uint8Array, contentType: string): Promise<void> {
  // TODO(v3)
}

export async function uploadBackup(env: Env, key: string, json: string): Promise<void> {
  // TODO(v4): @aws-sdk/client-s3 with forcePathStyle: true for OCI
}
