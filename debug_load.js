import { prisma } from './src/app/prisma.js';
console.log('✅ Prisma loaded');
import { NLPEngine } from './src/intelligence/services/nlp.engine.js';
console.log('✅ NLP loaded');
import { ScoringEngine } from './src/intelligence/services/scoring.engine.js';
console.log('✅ Scoring loaded');
import { AllocationEngine } from './src/intelligence/services/allocation.engine.js';
console.log('✅ Allocation loaded');
