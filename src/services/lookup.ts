import { prisma } from '../config/prisma.js';

export async function getLookups(companyId: string) {
  const [brands, colors, chemicals, sizes] = await Promise.all([
    prisma.brand.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.color.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.chemical.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.size.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { brands, colors, chemicals, sizes };
}
