import { Client } from 'pg';

const main = async () => {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1',
    database: 'postgres',
  });

  await client.connect();
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = 'AppEnd'");

  if (!existing.rowCount) {
    await client.query('CREATE DATABASE "AppEnd"');
    console.log('Database AppEnd created.');
  } else {
    console.log('Database AppEnd already exists.');
  }

  await client.end();
};

main().catch((error) => {
  console.error('create-db failed:', error?.message || error);
  process.exit(1);
});
