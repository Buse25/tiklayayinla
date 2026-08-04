import { config } from 'dotenv';
import { resolve } from 'path';

// `turbo` uygulamayı apps/api içinde çalıştırırken kök .env dosyasını da destekler.
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: false });

// Eski kurulumlarda kullanılan adı, tek merkezi yapılandırma anahtarına taşır.
// Değerin kendisi hiçbir zaman loglanmaz.
if (!process.env.PORTAL_CREDENTIALS_KEY && process.env.PORTAL_CREDENTIALS_ENCRYPTION_KEY) {
  process.env.PORTAL_CREDENTIALS_KEY = process.env.PORTAL_CREDENTIALS_ENCRYPTION_KEY;
}
