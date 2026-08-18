import { prisma } from '../config/prisma.js';

export async function getLookups() {
    const [brands, colors, chemicals, sizes] = await Promise.all([
        prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.color.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.chemical.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.size.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    return { brands, colors, chemicals, sizes };
}
