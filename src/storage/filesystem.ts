import "server-only";

import { constants, createReadStream } from "node:fs";
import { access, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

function storageRoot() {
  const configuredRoot = process.env.UPLOAD_ROOT?.trim();
  if (!configuredRoot) {
    throw new Error("Poster storage is not configured. Set UPLOAD_ROOT.");
  }
  if (process.env.NODE_ENV === "production" && !path.isAbsolute(configuredRoot)) {
    throw new Error("UPLOAD_ROOT must be an absolute path in production.");
  }
  return path.resolve(configuredRoot);
}

function objectPath(key: string) {
  const root = storageRoot();
  const normalizedKey = key.replaceAll("\\", "/");
  if (!normalizedKey || path.posix.isAbsolute(normalizedKey) || path.posix.normalize(normalizedKey) !== normalizedKey) {
    throw new Error("Invalid poster storage key.");
  }

  const candidate = path.resolve(root, ...normalizedKey.split("/"));
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid poster storage key.");
  }
  return candidate;
}

export function posterStorageConfigured() {
  return Boolean(process.env.UPLOAD_ROOT?.trim());
}

export async function verifyPosterStorage() {
  const root = storageRoot();
  const details = await stat(root);
  if (!details.isDirectory()) throw new Error("UPLOAD_ROOT is not a directory.");
  await access(root, constants.R_OK | constants.W_OK);
}

export async function putObject(input: { key: string; bytes: Uint8Array; contentType: string }) {
  const destination = objectPath(input.key);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, input.bytes, { flag: "wx", mode: 0o600 });
}

export async function deleteObject(key: string) {
  await unlink(objectPath(key));
}

export async function readObject(key: string) {
  const source = objectPath(key);
  const details = await stat(source);
  if (!details.isFile()) throw new Error("Poster asset is not a file.");
  return Readable.toWeb(createReadStream(source)) as ReadableStream<Uint8Array>;
}
