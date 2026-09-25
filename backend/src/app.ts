import "dotenv/config";
import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import * as Sentry from "@sentry/node";
import bodyParser from "body-parser";
import basicAuth from "basic-auth";

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import logger from "./utils/logger";

// Função de middleware para autenticação básica
export const isBullAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const user = basicAuth(req);

  if (
    !user ||
    user.name !== process.env.BULL_USER ||
    user.pass !== process.env.BULL_PASS
  ) {
    res.set("WWW-Authenticate", 'Basic realm="example"');
    return res.status(401).send("Authentication required.");
  }

  next();
};

// Inicializar Sentry
Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

const processRole = String(process.env.PROCESS_ROLE || "all").toLowerCase();
const isWebRole = processRole === "all" || processRole === "web";

const parseEnvList = (value?: string): string[] => {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
};

const normalizeOrigin = (origin: string): string => {
  return origin.replace(/\/$/, "");
};

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.BACKEND_URL,
  process.env.URL_API_OFICIAL,
  ...parseEnvList(process.env.CORS_ALLOWED_ORIGINS)
]
  .filter(Boolean)
  .map(origin => normalizeOrigin(String(origin)));

const publicCorsPaths = parseEnvList(
  process.env.CORS_PUBLIC_PATHS || "/webhook/landing"
);

const isPublicCorsPath = (req: Request): boolean => {
  const requestPath = req.path || req.originalUrl || req.url || "";

  return publicCorsPaths.some(publicPath => {
    const normalizedPath = publicPath.startsWith("/")
      ? publicPath
      : `/${publicPath}`;

    return (
      requestPath === normalizedPath ||
      requestPath.startsWith(`${normalizedPath}/`)
    );
  });
};

const corsOptionsDelegate: cors.CorsOptionsDelegate<Request> = (
  req,
  callback
) => {
  const origin = req.header("Origin");

  if (!origin) {
    return callback(null, {
      origin: true,
      credentials: true
    });
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (isPublicCorsPath(req)) {
    return callback(null, {
      origin,
      credentials: false,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With"
      ]
    });
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
    return callback(null, {
      origin,
      credentials: true
    });
  }

  return callback(new Error("Not allowed by CORS"));
};

const registerBullBoard = (): void => {
  if (!isWebRole) {
    return;
  }

  if (String(process.env.BULL_BOARD).toLowerCase() !== "true") {
    return;
  }

  if (!process.env.REDIS_URI_ACK) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BullQueue = require("./libs/queue").default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BullBoard = require("bull-board");

  const queues = (BullQueue.queues || [])
    .map((queue: any) => queue && queue.bull)
    .filter(Boolean);

  BullBoard.setQueues(queues);

  app.use("/admin/queues", isBullAuth, BullBoard.UI);
};

// Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(compression());
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ limit: "5mb", extended: true }));

app.use(cors(corsOptionsDelegate));
app.options("*", cors(corsOptionsDelegate));

app.use(cookieParser());
app.use(Sentry.Handlers.requestHandler());

app.use(
  "/public",
  express.static(uploadConfig.directory, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);

// Rotas auxiliares web-only
registerBullBoard();

// Rotas
app.use(routes);

// Manipulador de erros do Sentry
app.use(Sentry.Handlers.errorHandler());

// Middleware de tratamento de erros
app.use((err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    const isExpectedAuthError =
      err.statusCode === 401 &&
      ["ERR_SESSION_EXPIRED", "ERR_INVALID_TOKEN", "Invalid token"].some(msg =>
        String(err.message || "").includes(msg)
      );

    const isExpectedTokenWarning =
      err.statusCode === 403 &&
      String(err.message || "").includes("Invalid token");

    if (isExpectedAuthError || isExpectedTokenWarning) {
      if (String(process.env.LOG_AUTH_EXPIRED || "false").toLowerCase() === "true") {
        logger.info({
          message: err.message,
          statusCode: err.statusCode,
          method: req.method,
          path: req.originalUrl
        });
      }

      return res.status(err.statusCode).json({ error: err.message });
    }

    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;