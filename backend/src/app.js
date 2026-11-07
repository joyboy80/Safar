import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { health } from "./controllers/healthController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import { adminRouter, driverRouter, staffRouter, studentRouter, teacherRouter } from "./routes/portalRoutes.js";
import AppError from "./utils/AppError.js";
import transportRoutes from "./routes/transportRoutes.js";
import driverTransportRoutes from "./routes/driverTransportRoutes.js";
import adminTransportRoutes from "./routes/adminTransportRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import { isCorsOriginAllowed } from "./utils/corsOrigin.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cors({
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  origin(origin, callback) {
    if (isCorsOriginAllowed(origin, {
      allowedOrigins: env.clientOrigins,
      nodeEnv: env.nodeEnv,
    })) return callback(null, true);
    return callback(new AppError(403, "This origin is not allowed by CORS.", "CORS_FORBIDDEN"));
  },
}));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", health);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/driver/transport", driverTransportRoutes);
app.use("/api/admin/transport", adminTransportRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/student", studentRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/staff", staffRouter);
app.use("/api/driver", driverRouter);
app.use("/api/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
