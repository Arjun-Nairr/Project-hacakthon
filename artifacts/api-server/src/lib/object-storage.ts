import { randomUUID } from "node:crypto";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function parseObjectPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const [bucketName, ...objectParts] = normalized.slice(1).split("/");
  if (!bucketName || objectParts.length === 0) throw new Error("Invalid object storage path");
  return { bucketName, objectName: objectParts.join("/") };
}

export async function getPrivateUploadUrl() {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const { bucketName, objectName } = parseObjectPath(`${privateDir}/uploads/${randomUUID()}`);
  const response = await fetch(`${SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Storage sidecar returned ${response.status}`);
  const payload = await response.json() as { signed_url?: string };
  if (!payload.signed_url) throw new Error("Storage sidecar did not return an upload URL");
  return { uploadURL: payload.signed_url, objectPath: `/objects/${objectName}` };
}