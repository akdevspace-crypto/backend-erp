import fs from 'fs';
console.log("START");
fs.writeFileSync('signaled.txt', 'SCRIPT_RAN_AT_' + new Date().toISOString());
console.log("END");
