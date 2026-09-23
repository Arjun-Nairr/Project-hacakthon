import { Router, type IRouter } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { getPrivateUploadUrl } from "../lib/object-storage";

const router: IRouter = Router();

router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { uploadURL, objectPath } = await getPrivateUploadUrl();
    res.json(RequestUploadUrlResponse.parse({
      uploadURL,
      objectPath,
      metadata: parsed.data,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to generate private document upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

export default router;