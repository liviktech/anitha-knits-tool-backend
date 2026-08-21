import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';

/** Shared master-data existence checks, reused by every production-stage service. */

export async function assertColorExists(id: string, companyId: string): Promise<void> {
    const found = await prisma.color.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!found) throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', { colorId: id });
}

export async function assertSizeExists(id: string, companyId: string): Promise<void> {
    const found = await prisma.size.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!found) throw new NotFoundError('Size not found', 'SIZE_NOT_FOUND', { sizeId: id });
}

export async function assertBrandExists(id: string, companyId: string): Promise<void> {
    const found = await prisma.brand.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!found) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', { brandId: id });
}

export async function assertChemicalExists(id: string, companyId: string): Promise<void> {
    const found = await prisma.chemical.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!found) throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', { chemicalId: id });
}
