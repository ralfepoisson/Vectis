import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres@localhost:5432/vectis_dev?schema=public";

const app = buildApp({
  databaseUrl
});

app
  .listen({ port, host })
  .then(() => {
    console.log(`Vectis backend listening on http://${host}:${port}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
