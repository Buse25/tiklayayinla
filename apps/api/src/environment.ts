import { config } from 'dotenv';
import { resolve } from 'path';

// `turbo` uygulamayı apps/api içinde çalıştırırken kök .env dosyasını da destekler.
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: false });
