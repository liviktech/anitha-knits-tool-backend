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
        },
        parameters: {
            ExtruderId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'ProductionRecord id (stage=EXTRUDER).',
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
