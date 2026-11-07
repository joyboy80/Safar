import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import app from "./app.js";
import { env, validateEnvironment } from "./config/env.js";
import { verifySupabaseConnection } from "./config/supabase.js";

async function startServer() {
  try {
    validateEnvironment();
    await verifySupabaseConnection();
      app.listen(env.port, "0.0.0.0", () => {
        console.log(`Safar backend listening on http://0.0.0.0:${env.port}`);
      });
    } catch (error) {
      console.error(`Safar backend failed to start: ${error.message}`);
      process.exitCode = 1;
    }
  }

startServer();
// Triggered restart
