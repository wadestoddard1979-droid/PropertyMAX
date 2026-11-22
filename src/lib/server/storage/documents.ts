import { getPersistenceMode } from "../config";
import { getServiceClient } from "../supabase/client";

export type StoredDocument = {
  path: string;
  publicUrl: string | null;
  bucket: string;
};

/**
 * Document storage adapter.
 * - local-json: metadata only (Phase 1 behavior)
 * - supabase: private `documents` bucket via service role
 */
export async function uploadDocumentBytes(input: {
  propertyId: string;
  fileName: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
}): Promise<StoredDocument | null> {
  if (getPersistenceMode() !== "supabase") {
    return null;
  }
  const sb = getServiceClient();
  const safeName = input.fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${input.propertyId}/${Date.now()}-${safeName}`;
  const { error } = await sb.storage.from("documents").upload(path, input.bytes, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { path, publicUrl: null, bucket: "documents" };
}

export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (getPersistenceMode() !== "supabase") return null;
  const sb = getServiceClient();
  const { data, error } = await sb.storage
    .from("documents")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
