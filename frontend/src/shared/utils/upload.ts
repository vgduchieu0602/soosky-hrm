import api from "@core/http/axios";

/** Matches the backend storage scopes (avatars / employee-documents / contracts). */
export type UploadScope = "avatar" | "document" | "contract";

interface PresignResult {
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

const MB = 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ...IMAGE_TYPES,
];

/** Per-scope upload constraints — must mirror backend SCOPE_RULES. */
export const UPLOAD_RULES: Record<UploadScope, { types: string[]; maxBytes: number; accept: string }> = {
  avatar: { types: IMAGE_TYPES, maxBytes: 5 * MB, accept: "image/*" },
  document: { types: DOC_TYPES, maxBytes: 10 * MB, accept: ".pdf,.doc,.docx,image/*" },
  contract: { types: DOC_TYPES, maxBytes: 10 * MB, accept: ".pdf,.doc,.docx,image/*" },
};

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
  const rule = UPLOAD_RULES[scope];

  // Validate early (the server re-validates as the source of truth).
  if (!rule.types.includes(contentType)) {
    throw new Error("Loại tệp không được hỗ trợ. Chỉ chấp nhận PDF, Word hoặc ảnh.");
  }
  if (file.size > rule.maxBytes) {
    throw new Error(`Tệp vượt quá giới hạn ${Math.round(rule.maxBytes / MB)}MB.`);
  }

  // 1. Ask our API to sign a one-time PUT URL.
  const { data } = await api.post<{ data: PresignResult }>("/uploads/presign", {
    scope,
    fileName: file.name,
    contentType,
    ownerId,
    size: file.size,
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
