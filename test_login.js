import { prisma } from './src/app/prisma.js';

async function checkLogin() {
    try {
        const mobile = '1234567890';
        const password = 'password123';
        
        const account = await prisma.patientPortalAccount.findUnique({
            where: { mobile: mobile.trim() }
        });

        console.log("Found account:", account);
        if (!account || account.password !== password) {
            console.log("Invalid credentials");
        } else {
            console.log("Credentials match!");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
checkLogin();
