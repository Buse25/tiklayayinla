# 🚀 TiklaYayınla

TiklaYayınla; emlak ve otomotiv sektörlerindeki ilanların tek bir platform üzerinden oluşturulmasını, yönetilmesini, toplu olarak içe aktarılmasını ve farklı ilan portallarına yayınlanmasını hedefleyen çok platformlu bir ilan yönetim sistemidir.

Proje; web uygulaması, mobil uygulama ve merkezi backend servislerinden oluşan monorepo mimarisiyle geliştirilmektedir.

> **Proje Durumu:** Aktif geliştirme aşamasındadır.

---

## 🎯 Projenin Amacı

TiklaYayınla'nın temel amacı, özellikle çok sayıda ilan yöneten işletmelerin farklı platformlardaki ilan süreçlerini tek merkezden yönetebilmesini sağlamaktır.

Platform ile;

- İlan oluşturma ve yönetme
- Toplu ilan içe aktarma
- Emlak ve otomotiv sektörlerine özel ilan yapıları
- AI destekli kolon eşleştirme
- EİDS doğrulama altyapısı
- Portal hesaplarının yönetimi
- Çoklu portal yayınlama altyapısı
- Kurumsal hesap ve kullanıcı yönetimi
- Rol ve yetkilendirme

gibi süreçlerin merkezi bir sistem üzerinden yürütülmesi hedeflenmektedir.

---

## ✨ Temel Özellikler

### 📋 İlan Yönetimi

Kullanıcılar ilanlarını oluşturabilir, düzenleyebilir ve ilan durumlarını merkezi panel üzerinden takip edebilir.

İlan yaşam döngüsü taslak, yayınlanıyor, aktif ve arşiv gibi farklı durumlar üzerinden yönetilmektedir.

### 📥 Toplu İlan İçe Aktarma

CSV ve XLSX dosyalarından toplu ilan aktarımı yapılabilmektedir.

İçe aktarma süreci;

1. Dosya yükleme
2. Kolon eşleştirme
3. Doğrulama ve ön izleme
4. İçe aktarma özeti

adımlarından oluşmaktadır.

### 🤖 AI Destekli Kolon Eşleştirme

Farklı kaynaklardan gelen ilan dosyalarındaki kolon isimlerinin sistem alanlarıyla eşleştirilmesi için deterministic mapping ve Google Gemini destekli AI mapping altyapısı kullanılmaktadır.

Sistem öncelikle bilinen alanları otomatik eşleştirir, belirsiz alanlarda ise AI destekli eşleştirme mekanizmasını kullanabilir.

### 🏠 Emlak ve 🚗 Otomotiv Desteği

Sistem farklı ilan domainlerini destekleyecek şekilde tasarlanmıştır.

Emlak ilanlarında konum, metrekare, oda sayısı ve gayrimenkul özellikleri gibi alanlar; otomotiv ilanlarında ise marka, model, yıl, kilometre, yakıt ve şanzıman gibi sektöre özgü alanlar işlenmektedir.

### 🔐 EİDS Entegrasyon Altyapısı

Emlak ilanlarının Elektronik İlan Doğrulama Sistemi (EİDS) gereksinimlerine uyarlanabilmesi amacıyla doğrulama ve yetkilendirme altyapısı geliştirilmektedir.

Kimlik doğrulama ve ilan bazlı yetkilendirme süreçleri ayrı olarak ele alınmaktadır.

> Gerçek EİDS servis erişimi ve resmi servis bilgileri gerektiren bölümler entegrasyon aşamasındadır.

### 🌐 Portal Yayınlama Mimarisi

İlanların farklı ilan portallarına gönderilebilmesi amacıyla genişletilebilir bir portal entegrasyon mimarisi geliştirilmektedir.

Portal hesapları merkezi olarak yönetilerek ilanların uygun entegrasyonlar üzerinden yayınlanması hedeflenmektedir.

### 👥 Kullanıcı ve Kurumsal Hesap Yönetimi

Sistem bireysel ve kurumsal kullanım senaryolarını destekleyecek şekilde tasarlanmıştır.

Rol tabanlı yetkilendirme ile kullanıcı ve yönetici işlemleri birbirinden ayrılmaktadır.

---

## 🏗️ Sistem Mimarisi

TiklaYayınla bir monorepo olarak geliştirilmektedir.

```text
tiklayayinla/
│
├── apps/
│   ├── api/        # NestJS Backend API
│   ├── web/        # Next.js Web Application
│   └── mobile/     # React Native / Expo Mobile Application
│
├── packages/
│   └── shared-types/
│
├── docs/
├── infra/
│
├── docker-compose.yml
├── package.json
└── turbo.json
