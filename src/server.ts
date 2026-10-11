import { app } from "./app.js";
import { prisma } from "./db.js";
import { createRouter } from "./routes.js";

app.use("/api", createRouter(prisma));

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
