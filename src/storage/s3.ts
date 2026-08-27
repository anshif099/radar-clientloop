import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function storageConfig() {
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Object storage is not configured. Set the S3_* environment variables.");
  }

  return {
    bucket,
    client: new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export async function putObject(input: { key: string; bytes: Uint8Array; contentType: string }) {
  const { bucket, client } = storageConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );
}

export async function deleteObject(key: string) {
  const { bucket, client } = storageConfig();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function readObject(key: string) {
  const { bucket, client } = storageConfig();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}
