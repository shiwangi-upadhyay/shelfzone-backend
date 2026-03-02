import { PrismaClient, HolidayType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shelfzone';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Admin user ID for createdBy (using first user as admin)
const ADMIN_USER_ID = 'prabal_896589ab4a1cb514'; // Prabal's ID

const indianHolidays2026 = [
  {
    name: 'New Year',
    date: new Date('2026-01-01'),
    type: HolidayType.NATIONAL,
    description: 'New Year\'s Day',
  },
  {
    name: 'Republic Day',
    date: new Date('2026-01-26'),
    type: HolidayType.NATIONAL,
    description: 'Republic Day of India',
  },
  {
    name: 'Holi',
    date: new Date('2026-03-17'),
    type: HolidayType.NATIONAL,
    description: 'Festival of Colors',
  },
  {
    name: 'Good Friday',
    date: new Date('2026-04-03'),
    type: HolidayType.NATIONAL,
    description: 'Good Friday',
    isOptional: true,
  },
  {
    name: 'Eid ul-Fitr',
    date: new Date('2026-04-21'),
    type: HolidayType.NATIONAL,
    description: 'Festival marking end of Ramadan',
  },
  {
    name: 'Independence Day',
    date: new Date('2026-08-15'),
    type: HolidayType.NATIONAL,
    description: 'Independence Day of India',
  },
  {
    name: 'Janmashtami',
    date: new Date('2026-08-31'),
    type: HolidayType.NATIONAL,
    description: 'Birth of Lord Krishna',
    isOptional: true,
  },
  {
    name: 'Gandhi Jayanti',
    date: new Date('2026-10-02'),
    type: HolidayType.NATIONAL,
    description: 'Birthday of Mahatma Gandhi',
  },
  {
    name: 'Dussehra',
    date: new Date('2026-10-12'),
    type: HolidayType.NATIONAL,
    description: 'Victory of good over evil',
  },
  {
    name: 'Diwali',
    date: new Date('2026-10-21'),
    type: HolidayType.NATIONAL,
    description: 'Festival of Lights',
  },
  {
    name: 'Diwali (Day 2)',
    date: new Date('2026-10-22'),
    type: HolidayType.NATIONAL,
    description: 'Diwali second day',
  },
  {
    name: 'Guru Nanak Jayanti',
    date: new Date('2026-11-11'),
    type: HolidayType.NATIONAL,
    description: 'Birthday of Guru Nanak Dev Ji',
    isOptional: true,
  },
  {
    name: 'Christmas',
    date: new Date('2026-12-25'),
    type: HolidayType.NATIONAL,
    description: 'Christmas Day',
  },
];

async function seedHolidays() {
  console.log('Seeding Indian holidays for 2026...');

  for (const holiday of indianHolidays2026) {
    await prisma.holiday.upsert({
      where: {
        date_name: {
          date: holiday.date,
          name: holiday.name,
        },
      },
      update: {
        type: holiday.type,
        description: holiday.description,
        isOptional: holiday.isOptional || false,
      },
      create: {
        ...holiday,
        year: 2026,
        createdBy: ADMIN_USER_ID,
        isOptional: holiday.isOptional || false,
      },
    });
    console.log(`✓ ${holiday.name} - ${holiday.date.toLocaleDateString()}`);
  }

  console.log(`\nDone! Seeded ${indianHolidays2026.length} holidays for 2026.`);
}

seedHolidays()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
