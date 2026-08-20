import { fileURLToPath } from 'node:url';
import path from 'node:path';
import swaggerJsdoc from 'swagger-jsdoc';
import { env, isProduction } from './env.js';

// Mirrors the src/dist folder layout, so this resolves correctly whether
// running under tsx (src/**/*.ts, dev) or the compiled build (dist/**/*.js, prod).
const currentDir = path.dirname(fileURLToPath(import.meta.url));
// glob/minimatch require forward slashes even on Windows — path.join gives
// backslashes there, which silently matches nothing instead of erroring.
const routesGlob = path
    .join(currentDir, '..', 'routes', isProduction ? '*.js' : '*.ts')
    .split(path.sep)
    .join('/');

const definition: swaggerJsdoc.OAS3Definition = {
    openapi: '3.0.3',
    info: {
        title: 'Anitha Knits Production API',
        version: '1.0.0',
        description:
            'REST API for the Anitha Knits factory Production Module: ' +
            'Raw Material/Chemical/Colour → Extruder → Yarn → Kora Balance → Looms → Fabric → ' +
            'Fabric Checking → First Grade/Second Grade/FW/BW → Load Sent. ' +
            'The Production Module PRD is the authoritative source for the business rules referenced below.',
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local development' }],
    tags: [
        { name: 'Health', description: 'Process and database liveness checks' },
        {
            name: 'Extruder',
            description:
                'Extruder production records — stage 1 of the production flow (raw material → yarn). ' +
                'PRD §16.3. No separate "submit" step: a created record starts PENDING_APPROVAL directly ' +
                'and is editable only in that state; approve/reject resolve it from there.',
        },
        {
            name: 'Looms',
            description:
                'Looms production records — stage 2 of the production flow (yarn → fabric). PRD §16.4. ' +
                'Only create/list/get are implemented so far; edit/approve/reject are a follow-up.',
        },
        {
            name: 'Fabric Checking',
            description:
                'Fabric Checking records — the QA stage (fabric → First Grade/Second Grade). PRD §16.7. ' +
                'Base path is /api/v1/fabric-checking, not nested under /production. ' +
                'Only create/list/get are implemented so far; edit/approve/reject, FW/BW wastage, and GSM are a follow-up.',
        },
        {
            name: 'Lookups',
            description: 'Master data for populating dropdowns across the production entry forms.',
        },
        {
            name: 'Dashboard',
            description: 'Aggregated KPIs for management-facing dashboards (PRD §16.10).',
        },
    ],
    components: {
        schemas: {
            MasterDataRef: {
                type: 'object',
                description: 'A resolved reference to a master-data record.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                },
                required: ['id', 'name'],
            },
            ExtruderDetail: {
                type: 'object',
                properties: {
                    brand: { $ref: '#/components/schemas/MasterDataRef' },
                    rawMaterialKg: { type: 'number', format: 'decimal', example: 25 },
                    chemical: { $ref: '#/components/schemas/MasterDataRef' },
                    chemicalKg: { type: 'number', format: 'decimal', example: 0.5 },
                    colorConsumedKg: {
                        type: 'number',
                        format: 'decimal',
                        example: 0.15,
                        description: 'Auto-computed from the colour\'s configured standard unless overridden.',
                    },
                    yarnOutputKg: { type: 'number', format: 'decimal', example: 24 },
                    isRecipeOverridden: {
                        type: 'boolean',
                        description: 'True when colorConsumedKg deviates from the configured standard.',
                    },
                    overrideReason: {
                        type: 'string',
                        nullable: true,
                        description: 'Required and stored only when isRecipeOverridden is true.',
                    },
                },
            },
            ExtruderProduction: {
                type: 'object',
                description: 'A production record for the Extruder stage, with its ExtruderDetail embedded.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    stage: { type: 'string', enum: ['EXTRUDER'] },
                    productionDate: { type: 'string', format: 'date-time' },
                    status: {
                        type: 'string',
                        enum: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
                    },
                    statusChangedAt: { type: 'string', format: 'date-time' },
                    remarks: { type: 'string', nullable: true },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    extruder: { $ref: '#/components/schemas/ExtruderDetail' },
                    createdAt: { type: 'string', format: 'date-time' },
                    createdBy: { type: 'string' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                },
            },
            ExtruderCreateRequest: {
                type: 'object',
                required: ['productionDate', 'colorId', 'sizeId', 'brandId', 'chemicalId', 'rawMaterialKg', 'chemicalKg', 'yarnOutputKg'],
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date', example: '2026-08-19' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    brandId: { type: 'string', format: 'uuid' },
                    chemicalId: { type: 'string', format: 'uuid' },
                    rawMaterialKg: { type: 'number', exclusiveMinimum: 0, example: 25 },
                    chemicalKg: { type: 'number', exclusiveMinimum: 0, example: 0.5 },
                    colorConsumedKg: {
                        type: 'number',
                        exclusiveMinimum: 0,
                        description: 'Optional. Omit to auto-compute from the colour\'s configured standard.',
                    },
                    yarnOutputKg: { type: 'number', exclusiveMinimum: 0, example: 24 },
                    remarks: { type: 'string', maxLength: 500 },
                    overrideReason: {
                        type: 'string',
                        maxLength: 500,
                        description: 'Required only if colorConsumedKg deviates from the configured standard.',
                    },
                },
            },
            ExtruderUpdateRequest: {
                type: 'object',
                description: 'Every field is optional, but at least one must be present. Only allowed while status is PENDING_APPROVAL.',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    brandId: { type: 'string', format: 'uuid' },
                    chemicalId: { type: 'string', format: 'uuid' },
                    rawMaterialKg: { type: 'number', exclusiveMinimum: 0 },
                    chemicalKg: { type: 'number', exclusiveMinimum: 0 },
                    colorConsumedKg: { type: 'number', exclusiveMinimum: 0 },
                    yarnOutputKg: { type: 'number', exclusiveMinimum: 0 },
                    remarks: { type: 'string', maxLength: 500 },
                    overrideReason: { type: 'string', maxLength: 500 },
                },
            },
            ApprovalActionRequest: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    reason: { type: 'string', maxLength: 500, description: 'Optional note, stored on the audit ApprovalEvent.' },
                },
            },
            PaginationMeta: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 42 },
                    totalPages: { type: 'integer', example: 3 },
                },
            },
            ExtruderResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/ExtruderProduction' },
                },
            },
            ExtruderListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/ExtruderProduction' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    error: {
                        type: 'object',
                        properties: {
                            code: { type: 'string', example: 'EXTRUDER_NOT_FOUND' },
                            message: { type: 'string' },
                            details: { type: 'object', nullable: true },
                        },
                        required: ['code', 'message'],
                    },
                },
            },
            LoomDetail: {
                type: 'object',
                properties: {
                    yarnInputKg: { type: 'number', format: 'decimal', example: 500 },
                    fabricOutputKg: { type: 'number', format: 'decimal', example: 470 },
                },
            },
            LoomsProduction: {
                type: 'object',
                description: 'A production record for the Looms stage, with its LoomDetail embedded.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    stage: { type: 'string', enum: ['LOOMS'] },
                    productionDate: { type: 'string', format: 'date-time' },
                    status: {
                        type: 'string',
                        enum: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
                    },
                    statusChangedAt: { type: 'string', format: 'date-time' },
                    remarks: { type: 'string', nullable: true },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    loom: { $ref: '#/components/schemas/LoomDetail' },
                    createdAt: { type: 'string', format: 'date-time' },
                    createdBy: { type: 'string' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                },
            },
            LoomsCreateRequest: {
                type: 'object',
                required: ['productionDate', 'colorId', 'sizeId', 'yarnInputKg', 'fabricOutputKg'],
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date', example: '2026-08-19' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    yarnInputKg: { type: 'number', exclusiveMinimum: 0, example: 500 },
                    fabricOutputKg: { type: 'number', exclusiveMinimum: 0, example: 470 },
                    remarks: { type: 'string', maxLength: 500 },
                },
            },
            LoomsResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/LoomsProduction' },
                },
            },
            LoomsListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/LoomsProduction' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            FabricCheckDetail: {
                type: 'object',
                properties: {
                    fabricInputKg: { type: 'number', format: 'decimal', example: 192, description: 'Total fabric weight received for checking.' },
                    pieceCount: { type: 'integer', example: 20 },
                    firstGradeKg: { type: 'number', format: 'decimal', example: 170 },
                    secondGradeKg: { type: 'number', format: 'decimal', example: 18 },
                },
            },
            FabricCheckingRecord: {
                type: 'object',
                description: 'A production record for the Fabric Checking stage, with its FabricCheckDetail embedded.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    stage: { type: 'string', enum: ['FABRIC_CHECKING'] },
                    productionDate: { type: 'string', format: 'date-time' },
                    status: {
                        type: 'string',
                        enum: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
                    },
                    statusChangedAt: { type: 'string', format: 'date-time' },
                    remarks: { type: 'string', nullable: true },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    fabricCheck: { $ref: '#/components/schemas/FabricCheckDetail' },
                    createdAt: { type: 'string', format: 'date-time' },
                    createdBy: { type: 'string' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                },
            },
            FabricCheckingCreateRequest: {
                type: 'object',
                required: ['productionDate', 'colorId', 'sizeId', 'fabricInputKg', 'pieceCount', 'firstGradeKg', 'secondGradeKg'],
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date', example: '2026-08-19' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    fabricInputKg: { type: 'number', exclusiveMinimum: 0, example: 192 },
                    pieceCount: { type: 'integer', exclusiveMinimum: 0, example: 20 },
                    firstGradeKg: { type: 'number', minimum: 0, example: 170 },
                    secondGradeKg: { type: 'number', minimum: 0, example: 18 },
                    remarks: { type: 'string', maxLength: 500 },
                },
            },
            FabricCheckingResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FabricCheckingRecord' },
                },
            },
            FabricCheckingListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/FabricCheckingRecord' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            LookupsResponse: {
                type: 'object',
                description: 'Not wrapped in success/data like the other endpoints — returned as-is.',
                properties: {
                    brands: { type: 'array', items: { $ref: '#/components/schemas/MasterDataRef' } },
                    colors: { type: 'array', items: { $ref: '#/components/schemas/MasterDataRef' } },
                    chemicals: { type: 'array', items: { $ref: '#/components/schemas/MasterDataRef' } },
                    sizes: { type: 'array', items: { $ref: '#/components/schemas/MasterDataRef' } },
                },
            },
            DashboardStageDaily: {
                type: 'object',
                description: 'One stage\'s totals for a single day.',
                properties: {
                    inputKg: { type: 'number', example: 500 },
                    outputKg: { type: 'number', example: 470 },
                    wastageKg: { type: 'number', example: 0, description: 'Summed from WastageRecord; 0 until the Wastage API is in use.' },
                    wastePct: { type: 'number', example: 0 },
                },
            },
            DashboardStageSummary: {
                type: 'object',
                description: 'One stage\'s totals across the whole requested date range.',
                allOf: [
                    { $ref: '#/components/schemas/DashboardStageDaily' },
                    {
                        type: 'object',
                        properties: {
                            efficiencyPct: { type: 'number', example: 94, description: 'outputKg / inputKg * 100.' },
                        },
                    },
                ],
            },
            DashboardDailyEntry: {
                type: 'object',
                properties: {
                    date: { type: 'string', format: 'date' },
                    extruder: { $ref: '#/components/schemas/DashboardStageDaily' },
                    looms: { $ref: '#/components/schemas/DashboardStageDaily' },
                    fabricChecking: { $ref: '#/components/schemas/DashboardStageDaily' },
                },
            },
            DashboardProductionData: {
                type: 'object',
                properties: {
                    range: {
                        type: 'object',
                        properties: {
                            dateFrom: { type: 'string', format: 'date' },
                            dateTo: { type: 'string', format: 'date' },
                        },
                    },
                    summary: {
                        type: 'object',
                        description: 'Backs the three summary cards.',
                        properties: {
                            extruder: { $ref: '#/components/schemas/DashboardStageSummary' },
                            looms: { $ref: '#/components/schemas/DashboardStageSummary' },
                            fabricChecking: { $ref: '#/components/schemas/DashboardStageSummary' },
                        },
                    },
                    daily: {
                        type: 'array',
                        description: 'Backs the day-wise table. Only days with at least one production record appear here.',
                        items: { $ref: '#/components/schemas/DashboardDailyEntry' },
                    },
                },
            },
            DashboardProductionResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/DashboardProductionData' },
                },
            },
        },
        parameters: {
            ExtruderId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'ProductionRecord id (stage=EXTRUDER).',
            },
            LoomsId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'ProductionRecord id (stage=LOOMS).',
            },
            FabricCheckingId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'ProductionRecord id (stage=FABRIC_CHECKING).',
            },
        },
        responses: {
            ValidationError: {
                description: 'Request body/query/params failed validation (mass assignment, missing/invalid fields).',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            NotFound: {
                description: 'The record, or a referenced master-data id (colour/size/brand/chemical), does not exist.',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            Conflict: {
                description: 'The request conflicts with the record\'s current state (invalid status transition, edit after approval, concurrent update).',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
        },
    },
};

export const swaggerSpec = swaggerJsdoc({ definition, apis: [routesGlob] });
