import dotenv from 'dotenv';

dotenv.config({
  path: '.env.test',
  override: true,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL in .env.test');
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (databaseName !== 'event_booking_test') {
  throw new Error(`Tests must use event_booking_test, got: ${databaseName}`);
}
