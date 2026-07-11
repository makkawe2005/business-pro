const fs = require('fs');
const path = require('path');
const db = require('./database');

async function runFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log('Running', filePath);
  await db.query(sql);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd) {
    console.error('Usage: node run_migrations.js [up|down|seed]');
    process.exit(1);
  }
  try {
    if (cmd === 'up') {
      await runFile(path.join(__dirname, 'migrations', '001_create_schema_up.sql'));
      await runFile(path.join(__dirname, 'migrations', '002_add_auth_up.sql'));
      await runFile(path.join(__dirname, 'migrations', '003_add_client_stage_up.sql'));
      await runFile(path.join(__dirname, 'migrations', '004_add_companies_up.sql'));
      await runFile(path.join(__dirname, 'migrations', '005_move_fields_to_companies_up.sql'));
      console.log('Migrations applied.');
    } else if (cmd === 'down') {
      await runFile(path.join(__dirname, 'migrations', '005_move_fields_to_companies_down.sql'));
      await runFile(path.join(__dirname, 'migrations', '004_add_companies_down.sql'));
      await runFile(path.join(__dirname, 'migrations', '003_add_client_stage_down.sql'));
      await runFile(path.join(__dirname, 'migrations', '002_add_auth_down.sql'));
      await runFile(path.join(__dirname, 'migrations', '001_create_schema_down.sql'));
      console.log('Down migration applied.');
    } else if (cmd === 'seed') {
      await runFile(path.join(__dirname, 'migrations', '001_seed.sql'));
      console.log('Seed applied.');
    } else {
      console.error('Unknown command:', cmd);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(2);
  }
}

main();
