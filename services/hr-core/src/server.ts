import { loadConfig } from "./config/env.js";
import { buildApp } from "./http/app.js";

const config = loadConfig();
const app = await buildApp({ config });

await app.listen({ host: "0.0.0.0", port: config.port });
