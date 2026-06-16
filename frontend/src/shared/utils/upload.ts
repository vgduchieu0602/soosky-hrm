import api from "@core/http/axios";

/** Matches the backend storage scopes (avatars / employee-documents / contracts). */
export type UploadScope = "avatar" | "document" | "contract";

interface PresignResult {
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

/**
 * Upload a file straight to object storage (Backblaze B2) using a backend-issued
 * presigned PUT URL. Returns the stored object **key** to persist (e.g. in a
 * document/contract `fileUrl` field) — never the signed URL.
 */
export async function uploadFile(
  file: File,
  scope: UploadScope,
  ownerId?: string,
): Promise<string> {
  const contentType = file.type || "application/octet-stream";

  // 1. Ask our API to sign a one-time PUT URL.
  const { data } = await api.post<{ data: PresignResult }>("/uploads/presign", {
    scope,
    fileName: file.name,
    contentType,
    ownerId,
  });
  const { key, uploadUrl } = data.data;

  // 2. PUT the bytes directly to the bucket. Use plain fetch (no auth header,
  //    no baseURL) and send the exact Content-Type that was signed.
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(`Tải tệp lên thất bại (HTTP ${res.status})`);
  }

  return key;
}

/** Resolve a stored object key to a short-lived signed URL for viewing/downloading. */
export async function signDownload(key: string): Promise<string> {
  const { data } = await api.get<{ data: { url: string } }>("/uploads/sign", {
    params: { key },
  });
  return data.data.url;
}
