import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { optimizeAvatarBufferToWebp } from "@/lib/avatar-image";

export const runtime = "nodejs";

const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024;

function getFileExtension(fileType: string) {
  if (fileType.startsWith("image/")) {
    return "webp";
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file was uploaded." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Only image files are supported." }, { status: 400 });
  }

  if (file.size > MAX_INPUT_FILE_BYTES) {
    return Response.json(
      { error: "Avatar image is too large to process." },
      { status: 400 }
    );
  }

  const extension = getFileExtension(file.type);
  if (!extension) {
    return Response.json({ error: "Unsupported image format." }, { status: 400 });
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const outputBuffer = await optimizeAvatarBufferToWebp(inputBuffer);

    const uploadRelativeDir = path.join("uploads", "avatars", session.userId);
    const uploadAbsoluteDir = path.join(process.cwd(), "public", uploadRelativeDir);
    await mkdir(uploadAbsoluteDir, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const targetPath = path.join(uploadAbsoluteDir, fileName);
    await writeFile(targetPath, outputBuffer);

    const url = `/${uploadRelativeDir.replaceAll(path.sep, "/")}/${fileName}`;
    return Response.json({ url }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Avatar processing failed.",
      },
      { status: 400 }
    );
  }
}
