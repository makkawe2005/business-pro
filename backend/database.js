const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;

const isLocalDb = !connectionString || /localhost|127\.0\.0\.1/.test(connectionString);
const pool = new Pool({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};
