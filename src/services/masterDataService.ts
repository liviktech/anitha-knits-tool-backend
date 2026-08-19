import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';

/** Shared master-data existence checks, reused by every production-stage service. */

export async function assertColorExists(id: string): Promise<void> {
    const found = await prisma.color.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', { colorId: id });
}

export async function assertSizeExists(id: string): Promise<void> {
    const found = await prisma.size.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundError('Size not found', 'SIZE_NOT_FOUND', { sizeId: id });
}

export async function assertBrandExists(id: string): Promise<void> {
    const found = await prisma.brand.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', { brandId: id });
}

export async function assertChemicalExists(id: string): Promise<void> {
    const found = await prisma.chemical.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', { chemicalId: id });
}
