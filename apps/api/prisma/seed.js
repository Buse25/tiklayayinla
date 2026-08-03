const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  for (const portal of [
    { code: 'mock-xml', name: 'Mock XML Portal', adapterKey: 'mock-xml' },
    { code: 'mock-rest', name: 'Mock REST Portal', adapterKey: 'mock-rest' },
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
}

main().then(() => prisma.$disconnect()).catch(async error => { console.error(error); await prisma.$disconnect(); process.exit(1); });
