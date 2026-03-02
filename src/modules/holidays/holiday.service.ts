import { prisma } from '../../lib/prisma.js';
import { HolidayType } from '@prisma/client';

export async function listHolidays(filters: {
  year?: number;
  type?: HolidayType;
}) {
  const where: any = {};

  if (filters.year) {
    where.year = filters.year;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return holidays;
}

export async function getUpcomingHolidays(limit: number = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: today,
      },
    },
    orderBy: { date: 'asc' },
    take: limit,
  });

  return holidays;
}

export async function createHoliday(data: {
  name: string;
  date: Date;
  type: HolidayType;
  isOptional?: boolean;
  description?: string;
  createdBy: string;
}) {
  const year = data.date.getFullYear();

  const holiday = await prisma.holiday.create({
    data: {
      ...data,
      year,
      isOptional: data.isOptional || false,
    },
  });

  return holiday;
}

export async function updateHoliday(
  id: string,
  data: {
    name?: string;
    date?: Date;
    type?: HolidayType;
    isOptional?: boolean;
    description?: string;
  }
) {
  const updateData: any = { ...data };

  if (data.date) {
    updateData.year = data.date.getFullYear();
  }

  const holiday = await prisma.holiday.update({
    where: { id },
    data: updateData,
  });

  return holiday;
}

export async function deleteHoliday(id: string) {
  await prisma.holiday.delete({
    where: { id },
  });
}
