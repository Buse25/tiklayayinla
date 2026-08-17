const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  for (const portal of [
    {
      code: 'mock-xml', name: 'Mock XML Portal', adapterKey: 'mock-xml', connectionType: 'XML_FEED',
      credentialSchema: { fields: [
        { key: 'username', label: 'Kullanıcı adı', type: 'text', required: true },
        { key: 'password', label: 'Şifre', type: 'password', required: true },
      ] },
    },
    {
      code: 'mock-rest', name: 'Mock REST Portal', adapterKey: 'mock-rest', connectionType: 'REST_API',
      credentialSchema: { fields: [
        { key: 'apiKey', label: 'API Anahtarı', type: 'password', required: true },
      ] },
    },
  ]) {
    await prisma.portal.upsert({ where: { code: portal.code }, update: portal, create: portal });
  }

  const features = [
    ['SOUTH', 'Güney Cephe', 'FACADE'], ['NORTH', 'Kuzey Cephe', 'FACADE'], ['EAST', 'Doğu Cephe', 'FACADE'], ['WEST', 'Batı Cephe', 'FACADE'],
    ['SMART_HOME', 'Akıllı Ev', 'INTERIOR'], ['BUILT_IN_KITCHEN', 'Ankastre Mutfak', 'INTERIOR'], ['AIR_CONDITIONING', 'Klima', 'INTERIOR'], ['PARENT_BATHROOM', 'Ebeveyn Banyosu', 'INTERIOR'], ['DRESSING_ROOM', 'Giyinme Odası', 'INTERIOR'], ['LAMINATE_FLOORING', 'Laminat Parke', 'INTERIOR'], ['FIREPLACE', 'Şömine', 'INTERIOR'],
    ['SECURITY', 'Güvenlik', 'EXTERIOR'], ['SWIMMING_POOL', 'Yüzme Havuzu', 'EXTERIOR'], ['FITNESS_CENTER', 'Spor Salonu', 'EXTERIOR'], ['CHILDREN_PLAYGROUND', 'Çocuk Oyun Alanı', 'EXTERIOR'], ['CONCIERGE', 'Kapıcı', 'EXTERIOR'], ['GARDEN', 'Bahçe', 'EXTERIOR'],
    ['HOSPITAL', 'Hastane', 'NEARBY'], ['SCHOOL', 'Okul', 'NEARBY'], ['MARKET', 'Market', 'NEARBY'], ['SHOPPING_CENTER', 'Alışveriş Merkezi', 'NEARBY'], ['PARK', 'Park', 'NEARBY'],
    ['METRO', 'Metro', 'TRANSPORTATION'], ['BUS_STOP', 'Otobüs Durağı', 'TRANSPORTATION'], ['MINIBUS', 'Minibüs', 'TRANSPORTATION'], ['HIGHWAY', 'Ana Yol', 'TRANSPORTATION'], ['FERRY', 'Vapur İskelesi', 'TRANSPORTATION'],
    ['SEA_VIEW', 'Deniz Manzarası', 'VIEW'], ['CITY_VIEW', 'Şehir Manzarası', 'VIEW'], ['NATURE_VIEW', 'Doğa Manzarası', 'VIEW'], ['MOUNTAIN_VIEW', 'Dağ Manzarası', 'VIEW'],
    ['WHEELCHAIR_ACCESS', 'Engelli Erişimi', 'ACCESSIBILITY'], ['RAMP', 'Rampa', 'ACCESSIBILITY'], ['ELEVATOR_ACCESS', 'Asansör Erişimi', 'ACCESSIBILITY'],
  ];
  for (const [code, label, category] of features) {
    await prisma.featureDefinition.upsert({ where: { code }, update: { label, category, isActive: true }, create: { code, label, category } });
  }

  const defaultPlans = [
    {
      name: 'Eko Paket',
      monthlyPrice: 250,
      listingLimit: 100,
      portalLimit: 10,
      features: ['100 İlan', '10 Portal', '500 Müşteri'],
      period: 'aylık',
      isActive: true,
    },
    {
      name: 'Plus Paket',
      monthlyPrice: 500,
      listingLimit: 250,
      portalLimit: 15,
      features: ['250 İlan', '15 Portal', '1000 Müşteri'],
      period: 'aylık',
      isActive: true,
    },
    {
      name: 'Pro Paket',
      monthlyPrice: 1000,
      listingLimit: 999999,
      portalLimit: 99,
      features: ['Sınırsız İlan', 'Tüm Portallar', 'Sınırsız Müşteri'],
      period: 'aylık',
      isActive: true,
    },
  ];

  for (const plan of defaultPlans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {},
      create: plan,
    });
  }
}

main().then(() => prisma.$disconnect()).catch(async error => { console.error(error); await prisma.$disconnect(); process.exit(1); });
