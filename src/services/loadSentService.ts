import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { toSkipTake, toPageMeta } from '../utils/pagination.js';
import { assertColorExists, assertSizeExists } from './masterDataService.js';
import type { CreateLoadSentInput, UpdateLoadSentInput, ListLoadSentQuery } from '../validations/loadSentValidation.js';

const loadSentSelect = {
    id: true,
    date: true,
    color: { select: { id: true, name: true } },
    size: { select: { id: true, name: true } },
    pieceCount: true,
    weightKg: true,
    createdAt: true,
    createdBy: true,
    updatedAt: true,
    updatedBy: true,
} satisfies Prisma.LoadSentSelect;

type LoadSentRow = Prisma.LoadSentGetPayload<{ select: typeof loadSentSelect }>;

function mapLoadSentRecord(record: LoadSentRow) {
    return { ...record, weightKg: record.weightKg.toNumber() };
}

export async function createLoadSent(input: CreateLoadSentInput, companyId: string, actor: string) {
    await Promise.all([assertColorExists(input.colorId, companyId), assertSizeExists(input.sizeId, companyId)]);

    const record = await prisma.loadSent.create({
        data: {
            companyId,
            date: input.date,
            colorId: input.colorId,
            sizeId: input.sizeId,
            pieceCount: input.pieceCount,
            weightKg: input.weightKg,
            createdBy: actor,
        },
        select: loadSentSelect,
    });

    return mapLoadSentRecord(record);
}

export async function listLoadSent(query: ListLoadSentQuery, companyId: string) {
    const { skip, take } = toSkipTake(query);

    const where: Prisma.LoadSentWhereInput = {
        companyId,
        ...(query.date_from || query.date_to
            ? {
                  date: {
                      ...(query.date_from ? { gte: query.date_from } : {}),
                      ...(query.date_to ? { lte: query.date_to } : {}),
                  },
              }
            : {}),
        ...(query.color_id ? { colorId: query.color_id } : {}),
        ...(query.size_id ? { sizeId: query.size_id } : {}),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.loadSent.findMany({
            where,
            select: loadSentSelect,
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            skip,
            take,
        }),
        prisma.loadSent.count({ where }),
    ]);

    return { items: rows.map(mapLoadSentRecord), meta: toPageMeta(query, total) };
}

export async function getLoadSentById(id: string, companyId: string) {
    const record = await prisma.loadSent.findFirst({ where: { id, companyId }, select: loadSentSelect });
    if (!record) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });
    return mapLoadSentRecord(record);
}

export async function updateLoadSent(id: string, input: UpdateLoadSentInput, companyId: string, actor: string) {
    const existing = await prisma.loadSent.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });

    await Promise.all([
        input.colorId ? assertColorExists(input.colorId, companyId) : undefined,
        input.sizeId ? assertSizeExists(input.sizeId, companyId) : undefined,
    ]);

    const record = await prisma.loadSent.update({
        where: { id },
        data: {
            ...(input.date !== undefined ? { date: input.date } : {}),
            ...(input.colorId !== undefined ? { colorId: input.colorId } : {}),
            ...(input.sizeId !== undefined ? { sizeId: input.sizeId } : {}),
            ...(input.pieceCount !== undefined ? { pieceCount: input.pieceCount } : {}),
            ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
            updatedBy: actor,
        },
        select: loadSentSelect,
    });

    return mapLoadSentRecord(record);
}

export async function deleteLoadSent(id: string, companyId: string) {
    const existing = await prisma.loadSent.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Load Sent record not found', 'LOAD_SENT_NOT_FOUND', { id });

    await prisma.loadSent.delete({ where: { id } });
}
