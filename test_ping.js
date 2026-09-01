const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/uec/billing/manual-generate', // Check route
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({ patientId: 'test-123' }));
req.end();
