import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as EmailSettingController from "../controllers/EmailSettingController";
import * as EmailMarketingController from "../controllers/EmailMarketingController";

const routes = Router();

routes.get("/email-settings", isAuth, EmailSettingController.show);
routes.put("/email-settings", isAuth, EmailSettingController.update);

routes.post("/email-marketing/test", isAuth, EmailMarketingController.testEmail);
routes.post("/email-marketing/send", isAuth, EmailMarketingController.sendMarketingEmail);

export default routes;