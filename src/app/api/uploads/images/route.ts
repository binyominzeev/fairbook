import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILES_PER_UPLOAD = 6;
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    return Response.json({ error: "No image files were uploaded." }, { status: 400 });
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    return Response.json(
      { error: `You can upload at most ${MAX_FILES_PER_UPLOAD} images at once.` },
      { status: 400 }
    );
  }

  const uploadRelativeDir = path.join("uploads", "posts", session.userId);
  const uploadAbsoluteDir = path.join(process.cwd(), "public", uploadRelativeDir);
  await mkdir(uploadAbsoluteDir, { recursive: true });

  const urls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json(
        { error: "Only webp, jpeg, and png images are supported." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: "One of the images is too large. Try a smaller image." },
        { status: 400 }
      );
    }

    const extension = extensionForMimeType(file.type);
    if (!extension) {
      return Response.json({ error: "Unsupported image format." }, { status: 400 });
    }

    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const targetPath = path.join(uploadAbsoluteDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, buffer);

    urls.push(`/${uploadRelativeDir.replaceAll(path.sep, "/")}/${fileName}`);
  }

  return Response.json({ urls }, { status: 201 });
}
