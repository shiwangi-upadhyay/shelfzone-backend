import { Type, Static } from '@sinclair/typebox';

export const DailyReportQuerySchema = Type.Object({
  date: Type.String({
    format: 'date',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    maxLength: 10,
    description: 'ISO date (YYYY-MM-DD)',
  }),
  departmentId: Type.Optional(Type.String({ maxLength: 50 })),
});
export type DailyReportQuery = Static<typeof DailyReportQuerySchema>;

export const WeeklyReportQuerySchema = Type.Object({
  startDate: Type.String({
    format: 'date',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    maxLength: 10,
    description: 'ISO date (YYYY-MM-DD)',
  }),
  departmentId: Type.Optional(Type.String({ maxLength: 50 })),
});
export type WeeklyReportQuery = Static<typeof WeeklyReportQuerySchema>;

export const MonthlyReportQuerySchema = Type.Object({
  month: Type.Number({ minimum: 1, maximum: 12 }),
  year: Type.Number({ minimum: 2000, maximum: 2100 }),
  departmentId: Type.Optional(Type.String({ maxLength: 50 })),
  employeeId: Type.Optional(Type.String({ maxLength: 50 })),
});
export type MonthlyReportQuery = Static<typeof MonthlyReportQuerySchema>;
