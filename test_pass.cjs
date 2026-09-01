const bcrypt = require('bcrypt');
async function test() {
    const hash = "$2b$10$e1SedQy93S12Hx9T2g8hzeSSWuwiPSVAkjEnBbn7D0v1vIU7DPPq2";
    console.log("123456", await bcrypt.compare("123456", hash));
    console.log("password@123", await bcrypt.compare("password@123", hash));
}
test();
