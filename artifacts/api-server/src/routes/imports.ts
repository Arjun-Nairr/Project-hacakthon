import { Router, type IRouter } from "express";
import {
  CreateDocumentImportBody,
  CreateDocumentImportResponse,
  DeleteImportedRecordParams,
  ListImportsResponse,
  ReviewImportedRecordBody,
  ReviewImportedRecordParams,
  ReviewImportedRecordResponse,
  StartAccountConnectionBody,
  StartAccountConnectionResponse,
} from "@workspace/api-zod";
import {
  createDocumentImport,
  deleteImportedRecord,
  listImports,
  reviewImportedRecord,
  startAccountConnection,
} from "../lib/imports";

const router: IRouter = Router();

router.get("/imports", async (_req, res): Promise<void> => {
  res.json(ListImportsResponse.parse(await listImports()));
});

router.post("/imports/account-connections", async (req, res): Promise<void> => {
  const parsed = StartAccountConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.status(201).json(StartAccountConnectionResponse.parse(await startAccountConnection(parsed.data)));
});

router.post("/imports/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.status(201).json(CreateDocumentImportResponse.parse(await createDocumentImport(parsed.data)));
});

router.post("/imports/:id/review", async (req, res): Promise<void> => {
  const params = ReviewImportedRecordParams.safeParse(req.params);
  const body = ReviewImportedRecordBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const record = await reviewImportedRecord(params.data.id, body.data);
  if (!record) {
    res.status(404).json({ error: "Imported record not found" });
    return;
  }
  res.json(ReviewImportedRecordResponse.parse(record));
});

router.delete("/imports/:id", async (req, res): Promise<void> => {
  const params = DeleteImportedRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!await deleteImportedRecord(params.data.id)) {
    res.status(404).json({ error: "Imported record not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;