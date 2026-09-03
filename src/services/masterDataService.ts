import { existsLookupItem } from '../repositories/lookupItem.repository.js';
import { NotFoundError } from '../utils/errors.js';

/** Shared master-data existence checks, reused by every production-stage service. */

export async function assertColorExists(id: string, companyId: string): Promise<void> {
    const found = await existsLookupItem('colors', id, companyId);
    if (!found) throw new NotFoundError('Color not found', 'COLOR_NOT_FOUND', { colorId: id });
}

export async function assertSizeExists(id: string, companyId: string): Promise<void> {
    const found = await existsLookupItem('sizes', id, companyId);
    if (!found) throw new NotFoundError('Size not found', 'SIZE_NOT_FOUND', { sizeId: id });
}

export async function assertBrandExists(id: string, companyId: string): Promise<void> {
    const found = await existsLookupItem('brands', id, companyId);
    if (!found) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND', { brandId: id });
}

export async function assertChemicalExists(id: string, companyId: string): Promise<void> {
    const found = await existsLookupItem('chemicals', id, companyId);
    if (!found) throw new NotFoundError('Chemical not found', 'CHEMICAL_NOT_FOUND', { chemicalId: id });
}
