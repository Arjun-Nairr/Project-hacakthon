import { Router, type IRouter } from "express";
import {
  GetFinancialProfileResponse,
  SaveFinancialProfileBody,
  SaveFinancialProfileResponse,
} from "@workspace/api-zod";
import { getFinancialProfile, saveFinancialProfile } from "../lib/profile";

const router: IRouter = Router();

router.get("/profile", async (_req, res): Promise<void> => {
  res.json(GetFinancialProfileResponse.parse(await getFinancialProfile()));
});

router.put("/profile", async (req, res): Promise<void> => {
  const parsed = SaveFinancialProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(SaveFinancialProfileResponse.parse(await saveFinancialProfile(parsed.data)));
});

export default router;