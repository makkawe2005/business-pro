const db = require('./database');
(async () => {
  try {
    const { rows } = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
    console.log('users columns:', rows.map(r => r.column_name).join(', '));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
})();
