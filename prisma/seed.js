require('dotenv').config({
  quiet: true,
});

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const works = [
  {
    title: 'Окрашивание Airtouch',
    slug: 'okrashivanie-airtouch',
    category: 'Окрашивание',
    shortDescription: 'Мягкая растяжка цвета и естественный переход оттенков.',
    description:
      'Работа выполнена с сохранением качества волос. Оттенок и техника подбирались индивидуально.',
    image: '/site/img/AIRTOUCH.webp',
    sortOrder: 10,
  },
  {
    title: 'Окрашивание балаяж',
    slug: 'okrashivanie-balayazh',
    category: 'Окрашивание',
    shortDescription: 'Естественные блики и аккуратная растяжка цвета.',
    description:
      'Мягкое осветление с последующим тонированием и персональным подбором оттенка.',
    image: '/site/img/balayage.webp',
    sortOrder: 20,
  },
  {
    title: 'Женская стрижка каре',
    slug: 'zhenskaya-strizhka-kare',
    category: 'Женская стрижка',
    shortDescription: 'Чистая форма и удобная укладка на каждый день.',
    description:
      'Форма стрижки подобрана с учётом структуры волос и особенностей лица.',
    image: '/site/img/kare.webp',
    sortOrder: 30,
  },
  {
    title: 'Вечерняя укладка',
    slug: 'vechernyaya-ukladka',
    category: 'Укладка',
    shortDescription: 'Аккуратная стойкая укладка для особого события.',
    description:
      'Объём, направление локонов и фиксация подобраны под образ клиента.',
    image: '/site/img/vecher.webp',
    sortOrder: 40,
  },
];

async function main() {
  for (const item of works) {
    const work = await prisma.work.upsert({
      where: {
        slug: item.slug,
      },
      update: {
        title: item.title,
        category: item.category,
        shortDescription: item.shortDescription,
        description: item.description,
        isPublished: true,
        sortOrder: item.sortOrder,
      },
      create: {
        title: item.title,
        slug: item.slug,
        category: item.category,
        shortDescription: item.shortDescription,
        description: item.description,
        isPublished: true,
        sortOrder: item.sortOrder,
      },
    });

    const imageCount = await prisma.workImage.count({
      where: {
        workId: work.id,
      },
    });

    if (imageCount === 0) {
      await prisma.workImage.create({
        data: {
          workId: work.id,
          path: item.image,
          alt: item.title,
          sortOrder: 0,
        },
      });
    }
  }
}

main()
  .then(() => {
    console.log('Стартовые работы добавлены.');
  })
  .catch((error) => {
    console.error('Ошибка seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
