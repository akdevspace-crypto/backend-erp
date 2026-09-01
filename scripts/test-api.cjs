const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/patient-billing/entries',
  method: 'GET',
  headers: {
    // We need an auth token for the backend!
    // Without it, we will get 401 Unauthorized.
  }
};
