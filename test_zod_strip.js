import { z } from 'zod';
const s = z.object({ name: z.string() }).partial();
console.log(s.parse({ name: 'test', empId: 'EMP-100' }));
