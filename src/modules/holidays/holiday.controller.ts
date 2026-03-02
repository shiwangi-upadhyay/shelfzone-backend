import { FastifyRequest, FastifyReply } from 'fastify';
import {
  listHolidays,
  getUpcomingHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from './holiday.service.js';
import { HolidayType } from '@prisma/client';

export async function listHolidaysHandler(
  request: FastifyRequest<{
    Querystring: {
      year?: string;
      type?: HolidayType;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { year, type } = request.query;

    const holidays = await listHolidays({
      year: year ? parseInt(year) : undefined,
      type,
    });

    return reply.send({ data: holidays });
  } catch (error: any) {
    console.error('List holidays error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to fetch holidays',
    });
  }
}

export async function getUpcomingHolidaysHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const holidays = await getUpcomingHolidays(5);
    return reply.send({ data: holidays });
  } catch (error: any) {
    console.error('Upcoming holidays error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to fetch upcoming holidays',
    });
  }
}

export async function createHolidayHandler(
  request: FastifyRequest<{
    Body: {
      name: string;
      date: string;
      type: HolidayType;
      isOptional?: boolean;
      description?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { name, date, type, isOptional, description } = request.body;
    const userId = request.user!.userId;

    const holiday = await createHoliday({
      name,
      date: new Date(date),
      type,
      isOptional,
      description,
      createdBy: userId,
    });

    return reply.status(201).send({ data: holiday });
  } catch (error: any) {
    console.error('Create holiday error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create holiday',
    });
  }
}

export async function updateHolidayHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      name?: string;
      date?: string;
      type?: HolidayType;
      isOptional?: boolean;
      description?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { name, date, type, isOptional, description } = request.body;

    const updateData: any = {
      name,
      type,
      isOptional,
      description,
    };

    if (date) {
      updateData.date = new Date(date);
    }

    const holiday = await updateHoliday(id, updateData);
    return reply.send({ data: holiday });
  } catch (error: any) {
    console.error('Update holiday error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to update holiday',
    });
  }
}

export async function deleteHolidayHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    await deleteHoliday(id);
    return reply.status(204).send();
  } catch (error: any) {
    console.error('Delete holiday error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to delete holiday',
    });
  }
}
