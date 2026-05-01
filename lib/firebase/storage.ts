import { adminStorage } from './admin';

export async function uploadCVToStorage(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const bucket = adminStorage().bucket();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `cvs/${Date.now()}_${sanitized}`;
  const file = bucket.file(storagePath);

  await file.save(fileBuffer, {
    metadata: { contentType: mimeType },
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}
