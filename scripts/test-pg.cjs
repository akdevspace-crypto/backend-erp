const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/erp'
  });
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM "PatientDailyCost"');
    console.log(`Found ${res.rowCount} total rows in PatientDailyCost.`);
    if (res.rowCount > 0) {
      console.log('Sample rows:', JSON.stringify(res.rows.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await client.end();
  }
}

checkDb();
