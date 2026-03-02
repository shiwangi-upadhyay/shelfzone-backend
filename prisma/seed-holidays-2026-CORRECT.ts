import { PrismaClient, HolidayType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shelfzone';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_USER_ID = 'prabal_896589ab4a1cb514';

// CORRECT 2026 Indian Holiday Dates (verified)
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
    date: new Date('2026-03-04'),  // CORRECTED: March 4, not 17!
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
    date: new Date('2026-03-21'),  // CORRECTED: March 21, not April
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
    date: new Date('2026-09-12'),  // CORRECTED: September 12
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
    date: new Date('2026-10-22'),  // CORRECTED: October 22
    type: HolidayType.NATIONAL,
    description: 'Victory of good over evil',
  },
  {
    name: 'Diwali',
    date: new Date('2026-11-08'),  // CORRECTED: November 8
    type: HolidayType.NATIONAL,
    description: 'Festival of Lights',
  },
  {
    name: 'Guru Nanak Jayanti',
    date: new Date('2026-11-19'),  // CORRECTED: November 19
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
  console.log('Fixing 2026 holiday dates to ACTUAL calendar...');

  // Delete old incorrect holidays
  await prisma.holiday.deleteMany({ where: { year: 2026 } });
  console.log('✓ Cleared old incorrect dates');

  for (const holiday of indianHolidays2026) {
    await prisma.holiday.create({
      data: {
        ...holiday,
        year: 2026,
        createdBy: ADMIN_USER_ID,
        isOptional: holiday.isOptional || false,
      },
    });
    console.log(`✓ ${holiday.name} - ${holiday.date.toDateString()}`);
  }

  console.log(`\n✅ Fixed! Seeded ${indianHolidays2026.length} holidays with CORRECT 2026 dates.`);
}

seedHolidays()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
