# tiklayayinla.com

Emlak ilanlarını tek panelden çoklu portala asenkron yayınlayan SaaS platformu.

## Başlangıç

1. `Copy-Item .env.example .env`
2. `npm install`
3. `npm run infra:up`
4. `npm run dev`

Yerel servis yönetim ekranları: RabbitMQ `http://localhost:15672` (`tiklayayinla` / `tiklayayinla`), PostgreSQL `localhost:5432`, Redis `localhost:6379`.

## Yapı

- `apps/api`: NestJS API ve yayın worker'ı
- `apps/web`: Next.js yönetim paneli
- `apps/mobile`: React Native uygulaması için başlangıç alanı
- `packages/shared-types`: kanonik model ve ortak TypeScript tipleri
- `infra`: altyapı yapılandırmaları
