import jwt from 'jsonwebtoken';
import { prisma } from './src/app/prisma.js';

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'Raghav@uec.com' }
    });
    
    if (!user) {
        console.log("User not found");
        return;
    }

    const token = jwt.sign(
        { userId: user.id, email: user.email },
        'supersecretjwtkeyforerpsystem',
        { expiresIn: '1h' }
    );

    const response = await fetch('http://localhost:4000/api/v1/master/unit/authorized', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data.data?.map(u => u.name), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
