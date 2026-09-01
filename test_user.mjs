import { prisma } from './src/app/prisma.js'; async function t() { console.log(await prisma.user.findFirst({where:{isActive:true}})); } t();
