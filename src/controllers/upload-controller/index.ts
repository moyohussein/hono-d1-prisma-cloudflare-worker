import App from "~/app";
import Response from "~/utils/response";

const Router = App.basePath("");

// POST /api/cloudinary -> returns client upload config
Router.post("/cloudinary", async (c) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_FOLDER } = c.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    return new Response(c).error("Cloudinary not configured", 500 as any);
  }
  return new Response(c).success({
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: CLOUDINARY_UPLOAD_PRESET,
    folder: CLOUDINARY_FOLDER ?? undefined,
  });
});

// POST /api/upload -> proxy unsigned upload to Cloudinary
Router.post("/upload", async (c) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_FOLDER } = c.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    return new Response(c).error("Cloudinary not configured", 500 as any);
  }
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return new Response(c).error("Expected multipart/form-data", 400 as any);
  }
  const file = form.get("file");
  if (!file) return new Response(c).error("Missing file field", 400 as any);

  const upstream = new FormData();
  upstream.set("file", file as any);
  upstream.set("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (CLOUDINARY_FOLDER) upstream.set("folder", CLOUDINARY_FOLDER);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
    method: "POST",
    body: upstream,
  });
  if (!res.ok) {
    const text = await res.text();
    return new Response(c).error({ message: "Upload failed", detail: text }, 502 as any);
  }
  const data = (await res.json()) as { secure_url?: string; public_id?: string; width?: number; height?: number };
  return new Response(c).success({
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
  });
});

const UploadController = Router;
export default UploadController;
