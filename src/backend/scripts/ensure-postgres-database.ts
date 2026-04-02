import { Client } from "pg";

const defaultDatabaseUrl = "postgresql://postgres@localhost:5432/vectis_dev?schema=public";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

const parsedUrl = new URL(databaseUrl);
const databaseName = parsedUrl.pathname.replace(/^\//, "");

if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name.");
}

const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";
adminUrl.searchParams.delete("schema");

const client = new Client({
  connectionString: adminUrl.toString()
});

async function main() {
  await client.connect();

  const result = await client.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [databaseName]
  );

  if (!result.rows[0]?.exists) {
    const escapedDatabaseName = `"${databaseName.replace(/"/g, "\"\"")}"`;
    await client.query(`CREATE DATABASE ${escapedDatabaseName}`);
    console.log(`Created database ${databaseName}.`);
  } else {
    console.log(`Database ${databaseName} already exists.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
