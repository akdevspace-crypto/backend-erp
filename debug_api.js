import axios from 'axios';

async function test() {
    try {
        const res = await axios.get('http://localhost:3000/api/enquiry', {
            headers: {
                // I need some token here, but I don't have one.
                // However, if the error is a 400, it's likely after 'protect' passes
                // or 'protect' itself is failing in a way that returns 400.
                // But 'protect' usually returns 401.
            }
        });
        console.log(res.data);
    } catch (err) {
        console.log('Status:', err.response?.status);
        console.log('Data:', JSON.stringify(err.response?.data, null, 2));
    }
}

test();
