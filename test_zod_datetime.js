import { z } from 'zod';
try {
  z.string().datetime().parse('2025-10-10T10:00:00');
  console.log('Valid');
} catch(e) {
  console.log('Invalid:', e.message);
}
