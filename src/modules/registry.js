// Реєстр тренажерів, побудованих на спільному рушії (src/components/trainer.js).
import { PR2 } from './pr2-min-risk/index.js';
import { PR3 } from './pr3-likelihood/index.js';
import { PR4 } from './pr4-min-errors/index.js';

export const MODULES = { 2: PR2, 3: PR3, 4: PR4 };
