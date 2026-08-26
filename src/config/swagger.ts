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
    servers: [
        // Render sets RENDER_EXTERNAL_URL automatically on every web service; no manual
        // config needed. Falls back to localhost when running outside Render.
        ...(process.env.RENDER_EXTERNAL_URL
            ? [{ url: process.env.RENDER_EXTERNAL_URL, description: 'Production (Render)' }]
            : []),
        { url: `http://localhost:${env.PORT}`, description: 'Local development' },
    ],
    tags: [
        { name: 'Health', description: 'Process and database liveness checks' },
        {
            name: 'Auth',
            description:
                'Company-user login/refresh (POST /api/v1/company/auth/login, /refresh). Company signup ' +
                'is not public — it now lives under Platform Admin (POST /api/v1/platform/admin/companies).',
        },
        {
            name: 'Platform Admin',
            description:
                'Platform-admin-only operations: bootstrap signup, login/refresh, managing companies ' +
                '(customers) — list, view, edit — and viewing a company\'s users. Entirely separate auth ' +
                'system from company-user auth (requirePlatformAdmin, its own cookies) — a company-user ' +
                'session cannot access these routes.',
        },
        {
            name: 'Company Users',
            description:
                'A company ADMIN managing/viewing their own company\'s users. requireAuth(\'ADMIN\'), ' +
                'scoped to the caller\'s own companyId via the JWT.',
        },
        {
            name: 'Extruder',
            description:
                'Extruder production records — stage 1 of the production flow (raw material → yarn). ' +
                'PRD §16.3. No approval workflow: a created record is immediately final, deducting the ' +
                'raw material/chemical/colour consumed from Inventory in the same transaction. ' +
                'Create/edit require the ADMIN, MANAGER, or SUPERVISOR role.',
        },
        {
            name: 'Looms',
            description:
                'Looms production records — stage 2 of the production flow (yarn → fabric). PRD §16.4. ' +
                'No approval workflow — a created record is immediately final. Create/list/get/edit are ' +
                'implemented; create/edit require the ADMIN, MANAGER, or SUPERVISOR role.',
        },
        {
            name: 'Fabric Checking',
            description:
                'Fabric Checking records — the QA stage (fabric → First Grade/Second Grade). PRD §16.7. ' +
                'Base path is /api/v1/fabric-checking, not nested under /production. No approval workflow. ' +
                'Create/list/get/edit are implemented; GSM is a follow-up. Create/edit require the ADMIN, ' +
                'MANAGER, or SUPERVISOR role.',
        },
        {
            name: 'Lookups',
            description: 'Master data for populating dropdowns across the production entry forms.',
        },
        {
            name: 'Dashboard',
            description: 'Aggregated KPIs for management-facing dashboards (PRD §16.10).',
        },
        {
            name: 'Inventory',
            description:
                'Current stock balance (raw material/chemical/colour on hand) — one row per item, updated ' +
                'in place by manual intake, Extruder consumption, and manual corrections. Full CRUD.',
        },
        {
            name: 'Load Sent',
            description: 'Load Sent records — the outward-load operation (PRD terminology "Load Sent"). Full CRUD.',
        },
        {
            name: 'Kora Balance',
            description:
                'Current fabric stock (kora) per color+size variant, credited by Looms output and debited ' +
                'by Fabric Checking input, plus the append-only ledger of those movements. Read-only.',
        },
    ],
    components: {
        schemas: {
            SignupRequest: {
                type: 'object',
                required: ['companyName', 'companyCode', 'adminMobile', 'adminPassword'],
                additionalProperties: false,
                properties: {
                    companyName: { type: 'string', maxLength: 150, example: 'Anitha Knits Pvt Ltd' },
                    companyAddress: { type: 'string', maxLength: 500 },
                    gst: { type: 'string', maxLength: 20 },
                    companyCode: { type: 'string', maxLength: 50, example: 'AK001', description: 'Issued by a Super Admin; not generated by this API.' },
                    adminMobile: { type: 'string', example: '9876543210', description: '10-15 digits.' },
                    adminPassword: { type: 'string', format: 'password', minLength: 8, maxLength: 128 },
                    adminName: { type: 'string', maxLength: 150 },
                },
            },
            CompanySummary: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    address: { type: 'string', nullable: true },
                    gst: { type: 'string', nullable: true },
                    adminMobile: { type: 'string' },
                    companyCode: { type: 'string' },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            CompanyResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/CompanySummary' },
                },
            },
            CompanyListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/CompanySummary' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            CompanyUpdateRequest: {
                type: 'object',
                description: 'Every field is optional, but at least one must be present. Excludes adminPasswordHash — resetting the admin password is a separate concern.',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    name: { type: 'string', maxLength: 150 },
                    address: { type: 'string', maxLength: 500, nullable: true },
                    gst: { type: 'string', maxLength: 20, nullable: true },
                    companyCode: { type: 'string', maxLength: 50 },
                    adminMobile: { type: 'string', description: '10-15 digits.' },
                    isActive: { type: 'boolean' },
                },
            },
            PlatformAdminUserSummary: {
                type: 'object',
                description: 'A user belonging to a company, as seen by a platform admin (all roles, unlike the tenant-side UserSummary).',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    companyId: { type: 'string', format: 'uuid' },
                    name: { type: 'string', nullable: true },
                    mobile: { type: 'string' },
                    role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE'] },
                    isActive: { type: 'boolean' },
                    lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            PlatformAdminUserListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/PlatformAdminUserSummary' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            AdminUserSummary: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    companyId: { type: 'string', format: 'uuid' },
                    name: { type: 'string', nullable: true },
                    mobile: { type: 'string' },
                    role: { type: 'string', enum: ['ADMIN'] },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            SignupResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                        type: 'object',
                        properties: {
                            company: { $ref: '#/components/schemas/CompanySummary' },
                            admin: { $ref: '#/components/schemas/AdminUserSummary' },
                        },
                    },
                },
            },
            LoginRequest: {
                type: 'object',
                required: ['mobile', 'password'],
                additionalProperties: false,
                properties: {
                    mobile: { type: 'string', example: '9876543210', description: '10-15 digits.' },
                    password: { type: 'string', format: 'password' },
                },
            },
            UserSummary: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    companyId: { type: 'string', format: 'uuid' },
                    name: { type: 'string', nullable: true },
                    mobile: { type: 'string' },
                    role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE'] },
                    isActive: { type: 'boolean' },
                },
            },
            LoginCompanySummary: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    companyCode: { type: 'string' },
                },
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                        type: 'object',
                        properties: {
                            user: { $ref: '#/components/schemas/UserSummary' },
                            company: { $ref: '#/components/schemas/LoginCompanySummary' },
                        },
                    },
                },
            },
            RefreshResponse: {
                type: 'object',
                description: 'Shared by /company/auth/refresh and /platform/admin/refresh. Also sets fresh httpOnly access/refresh cookies.',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                        type: 'object',
                        properties: {
                            refreshed: { type: 'boolean', example: true },
                        },
                    },
                },
            },
            PlatformAdminSignupRequest: {
                type: 'object',
                required: ['name', 'mobile', 'password'],
                additionalProperties: false,
                properties: {
                    name: { type: 'string', maxLength: 150 },
                    mobile: { type: 'string', example: '9876543210', description: '10-15 digits.' },
                    password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 },
                },
            },
            PlatformAdminSummary: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    mobile: { type: 'string' },
                    role: { type: 'string', enum: ['SUPER_ADMIN'] },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            PlatformAdminSignupResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/PlatformAdminSummary' },
                },
            },
            PlatformAdminLoginResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                        type: 'object',
                        properties: {
                            admin: { $ref: '#/components/schemas/PlatformAdminSummary' },
                        },
                    },
                },
            },
            CompanyUserCreateRequest: {
                type: 'object',
                required: ['mobile', 'password', 'role'],
                additionalProperties: false,
                properties: {
                    name: { type: 'string', maxLength: 150 },
                    mobile: { type: 'string', example: '9876543210', description: '10-15 digits.' },
                    password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 },
                    role: { type: 'string', enum: ['MANAGER', 'SUPERVISOR'], description: 'ADMIN and EMPLOYEE cannot be created through this endpoint.' },
                },
            },
            CompanyUserSummary: {
                type: 'object',
                description: 'A MANAGER/SUPERVISOR user managed through this endpoint. For the full roster (all roles) see GET /api/v1/company/user/all.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    companyId: { type: 'string', format: 'uuid' },
                    name: { type: 'string', nullable: true },
                    mobile: { type: 'string' },
                    role: { type: 'string', enum: ['MANAGER', 'SUPERVISOR'] },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            CompanyUserResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/CompanyUserSummary' },
                },
            },
            CompanyUserListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/CompanyUserSummary' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            CompanyUserUpdateRequest: {
                type: 'object',
                description: 'Every field is optional, but at least one must be present. Excludes password/mobile — those are separate concerns.',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    name: { type: 'string', maxLength: 150 },
                    role: { type: 'string', enum: ['MANAGER', 'SUPERVISOR'] },
                    isActive: { type: 'boolean' },
                },
            },
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
                    bagCount: { type: 'integer', nullable: true, example: 5 },
                    bagWeightKg: { type: 'number', format: 'decimal', nullable: true, example: 20 },
                    looseWeightKg: { type: 'number', format: 'decimal', nullable: true, example: 4 },
                    totalWeightKg: { type: 'number', format: 'decimal', nullable: true, example: 24 },
                },
            },
            ExtruderProduction: {
                type: 'object',
                description: 'A production record for the Extruder stage, with its ExtruderDetail embedded.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    stage: { type: 'string', enum: ['EXTRUDER'] },
                    productionDate: { type: 'string', format: 'date-time' },
                    remarks: { type: 'string', nullable: true },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    extruder: { $ref: '#/components/schemas/ExtruderDetail' },
                    wastages: { type: 'array', items: { $ref: '#/components/schemas/WastageRecordSummary' } },
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
                    type: { type: 'string', enum: ['PRODUCTION', 'SAMPLE'], default: 'PRODUCTION' },
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
                    yarnWasteKg: { type: 'number', minimum: 0, description: 'Optional. Creates a WastageRecord (code YARN_WASTE) only if > 0.' },
                    lumpsKg: { type: 'number', minimum: 0, description: 'Optional. Creates a WastageRecord (code LUMPS) only if > 0.' },
                    bagCount: { type: 'integer', minimum: 0, example: 5, description: 'Optional.' },
                    bagWeightKg: { type: 'number', minimum: 0, example: 20, description: 'Optional.' },
                    looseWeightKg: { type: 'number', minimum: 0, example: 4, description: 'Optional.' },
                    totalWeightKg: { type: 'number', minimum: 0, example: 24, description: 'Optional.' },
                },
            },
            ExtruderUpdateRequest: {
                type: 'object',
                description: 'Every field is optional, but at least one must be present. No approval workflow — always allowed. Inventory is re-adjusted for any changed brand/chemical/colour or quantity.',
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
                    yarnWasteKg: { type: 'number', minimum: 0, description: 'Omit to leave unchanged, 0 to clear, positive to set/replace.' },
                    lumpsKg: { type: 'number', minimum: 0, description: 'Omit to leave unchanged, 0 to clear, positive to set/replace.' },
                    bagCount: { type: 'integer', minimum: 0 },
                    bagWeightKg: { type: 'number', minimum: 0 },
                    looseWeightKg: { type: 'number', minimum: 0 },
                    totalWeightKg: { type: 'number', minimum: 0 },
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
            WastageRecordSummary: {
                type: 'object',
                description: 'A WastageRecord created alongside its parent production record (PRD §9/§26).',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    wastageType: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            code: { type: 'string', example: 'YARN_WASTE' },
                            name: { type: 'string', example: 'Yarn Waste' },
                        },
                    },
                    color: {
                        allOf: [{ $ref: '#/components/schemas/MasterDataRef' }],
                        nullable: true,
                        description: 'Set only for colour-tracked wastage types (currently BW / "Bit Wastage").',
                    },
                    quantityKg: { type: 'number', example: 2.5 },
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
                    remarks: { type: 'string', nullable: true },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    loom: { $ref: '#/components/schemas/LoomDetail' },
                    wastages: { type: 'array', items: { $ref: '#/components/schemas/WastageRecordSummary' } },
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
                    type: { type: 'string', enum: ['PRODUCTION', 'SAMPLE'], default: 'PRODUCTION' },
                    remarks: { type: 'string', maxLength: 500 },
                    loomsWasteKg: { type: 'number', minimum: 0, description: 'Optional. Creates a WastageRecord (code LOOMS_WASTE) only if > 0.' },
                },
            },
            LoomsUpdateRequest: {
                type: 'object',
                description: 'Every field is optional, but at least one must be present. No approval workflow — always allowed.',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    yarnInputKg: { type: 'number', exclusiveMinimum: 0 },
                    fabricOutputKg: { type: 'number', exclusiveMinimum: 0 },
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
                    outputKg: { type: 'number', format: 'decimal', nullable: true, example: 170, description: 'Final stock / output weight.' },
                },
            },
            FabricCheckingRecord: {
                type: 'object',
                description: 'A production record for the Fabric Checking stage, with its FabricCheckDetail embedded.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    stage: { type: 'string', enum: ['FABRIC_CHECKING'] },
                    productionDate: { type: 'string', format: 'date-time' },
                    remarks: { type: 'string', nullable: true },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    fabricCheck: { $ref: '#/components/schemas/FabricCheckDetail' },
                    wastages: { type: 'array', items: { $ref: '#/components/schemas/WastageRecordSummary' } },
                    createdAt: { type: 'string', format: 'date-time' },
                    createdBy: { type: 'string' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                },
            },
            FabricCheckingCreateRequest: {
                type: 'object',
                required: ['productionDate', 'colorId', 'sizeId', 'fabricInputKg'],
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date', example: '2026-08-19' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    fabricInputKg: { type: 'number', exclusiveMinimum: 0, example: 192 },
                    type: { type: 'string', enum: ['PRODUCTION', 'SAMPLE'], default: 'PRODUCTION' },
                    outputKg: { type: 'number', minimum: 0, example: 170, description: 'Final stock / output weight.' },
                    remarks: { type: 'string', maxLength: 500 },
                    fwKg: { type: 'number', minimum: 0, description: 'Optional. Creates a WastageRecord (code FW) only if > 0.' },
                    bwKg: {
                        type: 'number',
                        minimum: 0,
                        description: 'Optional. Creates a colour-tracked WastageRecord (code BW, colorId = this record\'s colorId) only if > 0.',
                    },
                },
            },
            FabricCheckingUpdateRequest: {
                type: 'object',
                description: 'Every field is optional, but at least one must be present. No approval workflow — always allowed. Does not re-edit fwKg/bwKg wastage.',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    fabricInputKg: { type: 'number', exclusiveMinimum: 0 },
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
            DashboardInventoryTypeSummary: {
                type: 'object',
                description: 'Inventory balances of one type (HDPE/CHEMICAL/COLOR) touched during the month.',
                properties: {
                    type: { type: 'string', enum: ['HDPE', 'CHEMICAL', 'COLOR'] },
                    items: { type: 'array', items: { $ref: '#/components/schemas/InventoryRecord' } },
                    totalWeightKg: { type: 'number', example: 750 },
                },
            },
            DashboardInventorySummary: {
                type: 'object',
                properties: {
                    HDPE: { $ref: '#/components/schemas/DashboardInventoryTypeSummary' },
                    CHEMICAL: { $ref: '#/components/schemas/DashboardInventoryTypeSummary' },
                    COLOR: { $ref: '#/components/schemas/DashboardInventoryTypeSummary' },
                },
            },
            DashboardLoadSentVariantSummary: {
                type: 'object',
                properties: {
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    fabricWeightKg: { type: 'number', example: 200 },
                    fwWeightKg: { type: 'number', example: 15 },
                    bwWeightKg: { type: 'number', example: 8 },
                    totalWastageWeightKg: { type: 'number', example: 23 },
                },
            },
            DashboardLoadSentSummary: {
                type: 'object',
                description: '"Stock delivered" for the month.',
                properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/LoadSentRecord' } },
                    totals: {
                        type: 'object',
                        properties: {
                            fabricWeightKg: { type: 'number', example: 200 },
                            fwWeightKg: { type: 'number', example: 15 },
                            bwWeightKg: { type: 'number', example: 8 },
                            totalWastageWeightKg: { type: 'number', example: 23 },
                        },
                    },
                    byVariant: { type: 'array', items: { $ref: '#/components/schemas/DashboardLoadSentVariantSummary' } },
                },
            },
            DashboardFabricProductionVariantSummary: {
                type: 'object',
                properties: {
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    fabricInputKg: { type: 'number', example: 500 },
                    outputKg: { type: 'number', example: 470 },
                },
            },
            DashboardFabricProductionSummary: {
                type: 'object',
                description: 'Fabric Checking output for the month, colour+size variant-wise plus an overall total.',
                properties: {
                    byVariant: { type: 'array', items: { $ref: '#/components/schemas/DashboardFabricProductionVariantSummary' } },
                    overall: {
                        type: 'object',
                        properties: {
                            fabricInputKg: { type: 'number', example: 2000 },
                            outputKg: { type: 'number', example: 1880 },
                        },
                    },
                },
            },
            DashboardWastageCategorySummary: {
                type: 'object',
                description: 'One of the 5 client-terminology wastage categories (PRD §9/§26): Yarn Waste, LUMS/LUMPS, Looms Waste, FW, BW.',
                properties: {
                    code: { type: 'string', example: 'YARN_WASTE' },
                    name: { type: 'string', example: 'Yarn Waste' },
                    stage: { type: 'string', enum: ['EXTRUDER', 'LOOMS', 'FABRIC_CHECKING', 'DELIVERY'] },
                    quantityKg: { type: 'number', example: 12 },
                },
            },
            DashboardWastageSummary: {
                type: 'object',
                properties: {
                    byType: { type: 'array', items: { $ref: '#/components/schemas/DashboardWastageCategorySummary' } },
                    totalKg: { type: 'number', example: 45 },
                },
            },
            DashboardMonthlyData: {
                type: 'object',
                properties: {
                    range: {
                        type: 'object',
                        properties: {
                            month: { type: 'integer', example: 8 },
                            year: { type: 'integer', example: 2026 },
                            dateFrom: { type: 'string', format: 'date' },
                            dateTo: { type: 'string', format: 'date' },
                        },
                    },
                    inventory: { $ref: '#/components/schemas/DashboardInventorySummary' },
                    loadSent: { $ref: '#/components/schemas/DashboardLoadSentSummary' },
                    fabricProduction: { $ref: '#/components/schemas/DashboardFabricProductionSummary' },
                    wastage: { $ref: '#/components/schemas/DashboardWastageSummary' },
                },
            },
            DashboardMonthlyResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/DashboardMonthlyData' },
                },
            },
            InventoryRecord: {
                type: 'object',
                description: 'The current standing balance for one item — updated in place, not a per-transaction log entry.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    date: { type: 'string', format: 'date-time' },
                    type: { type: 'string', enum: ['HDPE', 'CHEMICAL', 'COLOR'] },
                    name: { type: 'string', example: 'Reliance', description: 'Auto-filled from the linked brand/chemical/colour.' },
                    weightKg: { type: 'number', format: 'decimal', example: 250, description: 'Current balance on hand.' },
                    brand: { allOf: [{ $ref: '#/components/schemas/MasterDataRef' }], nullable: true, description: 'Set when type is HDPE.' },
                    chemical: { allOf: [{ $ref: '#/components/schemas/MasterDataRef' }], nullable: true, description: 'Set when type is CHEMICAL.' },
                    color: { allOf: [{ $ref: '#/components/schemas/MasterDataRef' }], nullable: true, description: 'Set when type is COLOR.' },
                    createdAt: { type: 'string', format: 'date-time' },
                    createdBy: { type: 'string' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                },
            },
            InventoryCreateRequest: {
                type: 'object',
                description: 'Manual stock intake. quantityKg is added to the item\'s current balance. Exactly one of brandId/chemicalId/colorId is required, matching type.',
                required: ['type', 'quantityKg'],
                additionalProperties: false,
                properties: {
                    date: { type: 'string', format: 'date', description: 'Optional. Defaults to now.' },
                    type: { type: 'string', enum: ['HDPE', 'CHEMICAL', 'COLOR'] },
                    brandId: { type: 'string', format: 'uuid', description: 'Required when type is HDPE.' },
                    chemicalId: { type: 'string', format: 'uuid', description: 'Required when type is CHEMICAL.' },
                    colorId: { type: 'string', format: 'uuid', description: 'Required when type is COLOR.' },
                    quantityKg: { type: 'number', exclusiveMinimum: 0, example: 250 },
                },
            },
            InventoryUpdateRequest: {
                type: 'object',
                description: 'Manual correction of a balance already on file. Every field is optional, but at least one must be present. Item identity (type/brandId/chemicalId/colorId) cannot be changed.',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    date: { type: 'string', format: 'date' },
                    weightKg: { type: 'number', minimum: 0 },
                },
            },
            InventoryResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/InventoryRecord' },
                },
            },
            InventoryListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/InventoryRecord' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            InventoryStockItem: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', example: 'Reliance' },
                    intakeKg: { type: 'number', description: 'Current inventory balance (total stock intake on file).' },
                    consumedKg: { type: 'number', description: 'Total drawn down by extruder production.' },
                    stockKg: { type: 'number', description: 'intakeKg minus consumedKg. Can go negative if consumption was never backed by an intake.' },
                },
            },
            InventoryStockSummary: {
                type: 'object',
                properties: {
                    rawMaterial: { type: 'array', items: { $ref: '#/components/schemas/InventoryStockItem' }, description: 'One entry per brand on file for the company.' },
                    chemical: { type: 'array', items: { $ref: '#/components/schemas/InventoryStockItem' }, description: 'One entry per chemical on file for the company.' },
                    color: { type: 'array', items: { $ref: '#/components/schemas/InventoryStockItem' }, description: 'One entry per colour on file for the company.' },
                },
            },
            InventoryStockSummaryResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/InventoryStockSummary' },
                },
            },
            LoadSentDetail: {
                type: 'object',
                nullable: true,
                properties: {
                    fabricWeight: { type: 'number', format: 'decimal', example: 20 },
                    fwWeight: { type: 'number', format: 'decimal', example: 2 },
                    bwWeight: { type: 'number', format: 'decimal', example: 1 },
                    totalWastageWeight: { type: 'number', format: 'decimal', example: 3 },
                },
            },
            LoadSentRecord: {
                type: 'object',
                description: 'A ProductionRecord (stage=DELIVERY) with its LoadSent detail embedded.',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    stage: { type: 'string', enum: ['DELIVERY'] },
                    productionDate: { type: 'string', format: 'date-time' },
                    remarks: { type: 'string', nullable: true },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    loadSent: { $ref: '#/components/schemas/LoadSentDetail' },
                    createdAt: { type: 'string', format: 'date-time' },
                    createdBy: { type: 'string' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                },
            },
            LoadSentCreateRequest: {
                type: 'object',
                required: ['productionDate', 'colorId', 'sizeId'],
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date', example: '2026-08-19' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    fabricWeight: { type: 'number', minimum: 0, example: 20, description: 'Optional. Defaults to 0.' },
                    fwWeight: { type: 'number', minimum: 0, example: 2, description: 'Optional. Defaults to 0.' },
                    bwWeight: { type: 'number', minimum: 0, example: 1, description: 'Optional. Defaults to 0.' },
                    driverName: { type: 'string', maxLength: 100, example: 'Ramesh Kumar', description: 'Optional.' },
                    vehicleNo: { type: 'string', maxLength: 20, example: 'TN-39-AB-1234', description: 'Optional.' },
                },
            },
            LoadSentUpdateRequest: {
                type: 'object',
                description: 'Every field is optional, but at least one must be present.',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    productionDate: { type: 'string', format: 'date' },
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    fabricWeight: { type: 'number', minimum: 0 },
                    fwWeight: { type: 'number', minimum: 0 },
                    bwWeight: { type: 'number', minimum: 0 },
                    driverName: { type: 'string', maxLength: 100, nullable: true },
                    vehicleNo: { type: 'string', maxLength: 20, nullable: true },
                },
            },
            LoadSentResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/LoadSentRecord' },
                },
            },
            LoadSentListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/LoadSentRecord' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
            },
            KoraBalanceEntry: {
                type: 'object',
                description: 'Current fabric stock for one color+size variant (fabric_output_kg - fabric_input_kg).',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    color: { $ref: '#/components/schemas/MasterDataRef' },
                    size: { $ref: '#/components/schemas/MasterDataRef' },
                    balanceKg: { type: 'number', example: 120.5 },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            KoraBalanceListResponse: {
                type: 'object',
                description: 'Not paginated — every color+size variant is returned in one call.',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/KoraBalanceEntry' } },
                },
            },
            KoraLedgerEntry: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    entryType: { type: 'string', enum: ['CREDIT', 'DEBIT'], description: 'CREDIT = Looms output added to balance; DEBIT = Fabric Checking input consumed from balance.' },
                    stockDate: { type: 'string', format: 'date-time' },
                    quantityKg: { type: 'number', example: 25 },
                    balanceAfterKg: { type: 'number', example: 120.5, description: 'Running balance immediately after this entry.' },
                    productionRecordId: { type: 'string', format: 'uuid', description: 'The Looms or Fabric Checking ProductionRecord that generated this entry.' },
                    createdAt: { type: 'string', format: 'date-time' },
                    createdBy: { type: 'string' },
                },
            },
            KoraLedgerBalance: {
                type: 'object',
                description: 'The variant\'s current balance, echoed alongside the ledger page. balanceKg is 0 when no KoraBalance row exists yet for this variant.',
                properties: {
                    colorId: { type: 'string', format: 'uuid' },
                    sizeId: { type: 'string', format: 'uuid' },
                    balanceKg: { type: 'number', example: 120.5 },
                },
            },
            KoraLedgerMeta: {
                allOf: [
                    { $ref: '#/components/schemas/PaginationMeta' },
                    {
                        type: 'object',
                        properties: {
                            balance: { $ref: '#/components/schemas/KoraLedgerBalance' },
                        },
                    },
                ],
            },
            KoraLedgerListResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/KoraLedgerEntry' } },
                    meta: { $ref: '#/components/schemas/KoraLedgerMeta' },
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
            InventoryId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'Inventory record id.',
            },
            LoadSentId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'ProductionRecord id (stage=DELIVERY).',
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
                description: 'The request conflicts with the record\'s current state (e.g. insufficient stock, concurrent update).',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
        },
    },
};

export const swaggerSpec = swaggerJsdoc({ definition, apis: [routesGlob] });
