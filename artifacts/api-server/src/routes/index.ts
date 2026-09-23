import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moneyRouter from "./money";

const router: IRouter = Router();

router.use(healthRouter);
router.use(moneyRouter);

export default router;
