# Yayınlama akışı

```text
Web / Mobile → API (Listings) → RabbitMQ: listing.publish
                                       │
                                       ├─ job: mock-xml  → MockXmlPortalAdapter → XML feed
                                       ├─ job: mock-rest → MockRestPortalAdapter → REST payload
                                       └─ job: yeni-portal → Yeni Portal Adapter'ı
```

Bir portalın gecikmesi veya hata vermesi yalnızca kendi işini etkiler. Üretimde başarısız işler için dead-letter queue, retry/backoff ve `publication_attempts` denetim tablosu eklenmelidir.

## Yeni portal ekleme

1. `apps/api/src/integrations/<portal>/` altında bir adapter oluşturun.
2. `PortalAdapter` arayüzünü uygulayın; `mapListing` yalnızca `CanonicalListing` almalıdır.
3. Adapter'ı `AdapterRegistry` içine kaydedin.
4. Kimlik bilgilerini ortam değişkenleri/secret manager’dan alın; mapper içine koymayın.
