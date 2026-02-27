import prisma from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import type {
  CreateSalaryStructureInput,
  UpdateSalaryStructureInput,
  CreatePayrollRunInput,
  ListPayslipsQuery,
} from './payroll.schemas.js';

// --------------- helpers ---------------

function encryptOptional(value: number | undefined): string | null {
  return value != null ? encrypt(String(value)) : null;
}

function decryptOptional(value: string | null | undefined): number | null {
  return value ? Number(decrypt(value)) : null;
}

function calcPfEmployee(basic: number): number {
  return Math.round(basic * 0.12);
}

function calcPfEmployer(basic: number): number {
  return Math.round(basic * 0.12);
}

function calcEsiEmployee(gross: number): number {
  return gross <= 21000 ? Math.round(gross * 0.0075) : 0;
}

function calcEsiEmployer(gross: number): number {
  return gross <= 21000 ? Math.round(gross * 0.0325) : 0;
}

function calcProfessionalTax(): number {
  return 200;
}

function calcTds(): number {
  return 0; // placeholder — task 3.21
}

function throwForbidden(msg = 'Forbidden'): never {
  const err: Error & { statusCode?: number; error?: string } = new Error(msg);
  err.statusCode = 403;
  err.error = 'Forbidden';
  throw err;
}

function throwNotFound(msg = 'Not found'): never {
  const err: Error & { statusCode?: number; error?: string } = new Error(msg);
  err.statusCode = 404;
  err.error = 'Not Found';
  throw err;
}

function throwConflict(msg: string): never {
  const err: Error & { statusCode?: number; error?: string } = new Error(msg);
  err.statusCode = 409;
  err.error = 'Conflict';
  throw err;
}

function throwBadRequest(msg: string): never {
  const err: Error & { statusCode?: number; error?: string } = new Error(msg);
  err.statusCode = 400;
  err.error = 'Bad Request';
  throw err;
}

// --------------- salary structure ---------------

export async function createSalaryStructure(data: CreateSalaryStructureInput) {
  // Verify employee exists
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) throwNotFound('Employee not found');

  const gross =
    data.basicSalary +
    (data.hra ?? 0) +
    (data.da ?? 0) +
    (data.specialAllowance ?? 0) +
    (data.medicalAllowance ?? 0) +
    (data.transportAllowance ?? 0);

  // Deactivate existing active structure
  await prisma.salaryStructure.updateMany({
    where: { employeeId: data.employeeId, isActive: true },
    data: { isActive: false, effectiveTo: new Date() },
  });

  const structure = await prisma.salaryStructure.create({
    data: {
      employeeId: data.employeeId,
      basicSalary: encrypt(String(data.basicSalary)),
      hra: encryptOptional(data.hra),
      da: encryptOptional(data.da),
      specialAllowance: encryptOptional(data.specialAllowance),
      medicalAllowance: encryptOptional(data.medicalAllowance),
      transportAllowance: encryptOptional(data.transportAllowance),
      grossSalary: encrypt(String(gross)),
      effectiveFrom: new Date(data.effectiveFrom),
      isActive: true,
    },
  });

  return {
    id: structure.id,
    employeeId: structure.employeeId,
    effectiveFrom: structure.effectiveFrom,
  };
}

export async function getSalaryStructure(employeeId: string, user: AccessTokenPayload) {
  // MANAGER cannot see salary data
  if (user.role === 'MANAGER') throwForbidden('Managers cannot view salary data');

  // EMPLOYEE can only see own
  if (user.role === 'EMPLOYEE') {
    const emp = await prisma.employee.findUnique({ where: { userId: user.userId } });
    if (!emp || emp.id !== employeeId)
      throwForbidden('You can only view your own salary structure');
  }

  const structure = await prisma.salaryStructure.findFirst({
    where: { employeeId, isActive: true },
  });
  if (!structure) throwNotFound('No active salary structure found');

  return {
    id: structure.id,
    employeeId: structure.employeeId,
    basicSalary: Number(decrypt(structure.basicSalary)),
    hra: decryptOptional(structure.hra),
    da: decryptOptional(structure.da),
    specialAllowance: decryptOptional(structure.specialAllowance),
    medicalAllowance: decryptOptional(structure.medicalAllowance),
    transportAllowance: decryptOptional(structure.transportAllowance),
    grossSalary: Number(decrypt(structure.grossSalary)),
    effectiveFrom: structure.effectiveFrom,
    effectiveTo: structure.effectiveTo,
    isActive: structure.isActive,
  };
}

// --------------- payroll run ---------------

export async function createPayrollRun(data: CreatePayrollRunInput) {
  const existing = await prisma.payrollRun.findUnique({
    where: { month_year: { month: data.month, year: data.year } },
  });
  if (existing) throwConflict(`Payroll run already exists for ${data.month}/${data.year}`);

  const run = await prisma.payrollRun.create({
    data: { month: data.month, year: data.year, status: 'DRAFT' },
  });
  return run;
}

export async function processPayrollRun(payrollRunId: string, processedBy: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
  if (!run) throwNotFound('Payroll run not found');
  if (run.status !== 'DRAFT') throwBadRequest('Only DRAFT payroll runs can be processed');

  // Mark as PROCESSING
  await prisma.payrollRun.update({ where: { id: payrollRunId }, data: { status: 'PROCESSING' } });

  // Get all active employees with salary structures
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE', salaryStructure: { isActive: true } },
    include: { salaryStructure: true },
  });

  let totalGross = 0;
  let totalDeduct = 0;
  let totalNet = 0;
  const payslipData: Parameters<typeof prisma.payslip.create>[0]['data'][] = [];

  for (const emp of employees) {
    const ss = emp.salaryStructure;
    if (!ss) continue;

    const basic = Number(decrypt(ss.basicSalary));
    const hra = decryptOptional(ss.hra) ?? 0;
    const da = decryptOptional(ss.da) ?? 0;
    const special = decryptOptional(ss.specialAllowance) ?? 0;
    const medical = decryptOptional(ss.medicalAllowance) ?? 0;
    const transport = decryptOptional(ss.transportAllowance) ?? 0;
    const gross = basic + hra + da + special + medical + transport;

    const pfEmp = calcPfEmployee(basic);
    const pfEr = calcPfEmployer(basic);
    const esiEmp = calcEsiEmployee(gross);
    const esiEr = calcEsiEmployer(gross);
    const pt = calcProfessionalTax();
    const tds = calcTds();

    const deductions = pfEmp + esiEmp + pt + tds;
    const net = gross - deductions;

    totalGross += gross;
    totalDeduct += deductions;
    totalNet += net;

    payslipData.push({
      payrollRunId,
      employeeId: emp.id,
      month: run.month,
      year: run.year,
      basicPay: encrypt(String(basic)),
      hra: encryptOptional(hra || undefined),
      da: encryptOptional(da || undefined),
      specialAllowance: encryptOptional(special || undefined),
      medicalAllowance: encryptOptional(medical || undefined),
      transportAllowance: encryptOptional(transport || undefined),
      grossPay: encrypt(String(gross)),
      pfEmployee: encrypt(String(pfEmp)),
      pfEmployer: encrypt(String(pfEr)),
      esiEmployee: encrypt(String(esiEmp)),
      esiEmployer: encrypt(String(esiEr)),
      professionalTax: encrypt(String(pt)),
      tds: encrypt(String(tds)),
      totalDeductions: encrypt(String(deductions)),
      netPay: encrypt(String(net)),
    });
  }

  // Create payslips
  for (const data of payslipData) {
    await prisma.payslip.create({ data });
  }

  // Update run
  const updatedRun = await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'COMPLETED',
      totalEmployees: payslipData.length,
      totalGrossPay: encrypt(String(totalGross)),
      totalDeductions: encrypt(String(totalDeduct)),
      totalNetPay: encrypt(String(totalNet)),
      processedBy,
      processedAt: new Date(),
    },
  });

  return {
    id: updatedRun.id,
    status: updatedRun.status,
    totalEmployees: updatedRun.totalEmployees,
  };
}

// --------------- payslips ---------------

export async function getPayslipById(id: string, user: AccessTokenPayload) {
  if (user.role === 'MANAGER') throwForbidden('Managers cannot view payslips');

  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: { employee: { select: { id: true, firstName: true, lastName: true, userId: true } } },
  });
  if (!payslip) throwNotFound('Payslip not found');

  // EMPLOYEE can only see own
  if (user.role === 'EMPLOYEE' && payslip.employee.userId !== user.userId) {
    throwForbidden('You can only view your own payslips');
  }

  return {
    id: payslip.id,
    payrollRunId: payslip.payrollRunId,
    employeeId: payslip.employeeId,
    employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
    month: payslip.month,
    year: payslip.year,
    basicPay: Number(decrypt(payslip.basicPay)),
    hra: decryptOptional(payslip.hra),
    da: decryptOptional(payslip.da),
    specialAllowance: decryptOptional(payslip.specialAllowance),
    medicalAllowance: decryptOptional(payslip.medicalAllowance),
    transportAllowance: decryptOptional(payslip.transportAllowance),
    grossPay: Number(decrypt(payslip.grossPay)),
    pfEmployee: decryptOptional(payslip.pfEmployee),
    pfEmployer: decryptOptional(payslip.pfEmployer),
    esiEmployee: decryptOptional(payslip.esiEmployee),
    esiEmployer: decryptOptional(payslip.esiEmployer),
    professionalTax: decryptOptional(payslip.professionalTax),
    tds: decryptOptional(payslip.tds),
    totalDeductions: Number(decrypt(payslip.totalDeductions)),
    netPay: Number(decrypt(payslip.netPay)),
    createdAt: payslip.createdAt,
  };
}

export async function getPayslips(query: ListPayslipsQuery, user: AccessTokenPayload) {
  if (user.role === 'MANAGER') throwForbidden('Managers cannot view payslips');

  const where: Record<string, unknown> = {};

  // EMPLOYEE can only see own
  if (user.role === 'EMPLOYEE') {
    const emp = await prisma.employee.findUnique({ where: { userId: user.userId } });
    if (!emp) throwNotFound('Employee profile not found');
    where.employeeId = emp.id;
  } else if (query.employeeId) {
    where.employeeId = query.employeeId;
  }

  if (query.month) where.month = query.month;
  if (query.year) where.year = query.year;

  const skip = (query.page - 1) * query.limit;

  const [payslips, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.payslip.count({ where }),
  ]);

  return {
    data: payslips.map((p) => ({
      id: p.id,
      payrollRunId: p.payrollRunId,
      employeeId: p.employeeId,
      employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
      month: p.month,
      year: p.year,
      createdAt: p.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
