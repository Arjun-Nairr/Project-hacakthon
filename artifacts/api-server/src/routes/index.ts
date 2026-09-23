import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moneyRouter from "./money";
import importsRouter from "./imports";
import storageRouter from "./storage";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(moneyRouter);
router.use(importsRouter);
router.use(storageRouter);
router.use(profileRouter);

export default router;
