import type { RightAction } from '../types/enums.js';

/** Seeded into every new company at signup (see authService.signupCompany). Admins can add/edit/delete beyond this via the Module/Tab CRUD endpoints. Mirrors the full module catalog of an established company (SK knits) so every new company starts with the same set. */
export const DEFAULT_MODULES = [
    { code: 'dashboard', name: 'Dashboard', tabs: [] },
    { code: 'productiondetails', name: 'Production Details', tabs: [] },
    { code: 'sampleproduction', name: 'Sample Production', tabs: [] },
    { code: 'inventory', name: 'Inventory', tabs: [] },
    {
        code: 'employees',
        name: 'Employees',
        tabs: [
            { code: 'directory', name: 'Directory' },
            { code: 'attendance', name: 'Attendance' },
            { code: 'payroll', name: 'Payroll' },
        ],
    },
    { code: 'expenses', name: 'Expenses', tabs: [] },
    { code: 'reports', name: 'Reports', tabs: [] },
    { code: 'admin_panel', name: 'Admin Panel', tabs: [] },
] as const;

/** One (module [+ tab]) x action grant. `tabCode` omitted = the whole module (mirrors Right.tabId being NULL). */
export interface DefaultRightSpec {
    moduleCode: (typeof DEFAULT_MODULES)[number]['code'];
    tabCode?: string;
    action: RightAction;
}

/**
 * Seeded into every new company at signup alongside DEFAULT_MODULES, so a fresh company has a
 * usable Manager/Supervisor role from day one instead of an empty Rights list the admin must
 * build up manually via the Roles tab. Admins can add/edit/delete beyond this via the Rights
 * CRUD endpoints. Mirrors SK knits' full 38-right catalog — every module gets all four actions
 * (View/Add/Edit/Delete) except Dashboard, which only has Edit/Delete there.
 */
export const DEFAULT_RIGHTS: DefaultRightSpec[] = [
    { moduleCode: 'admin_panel', action: 'VIEW' },
    { moduleCode: 'admin_panel', action: 'ADD' },
    { moduleCode: 'admin_panel', action: 'EDIT' },
    { moduleCode: 'admin_panel', action: 'DELETE' },
    { moduleCode: 'dashboard', action: 'EDIT' },
    { moduleCode: 'dashboard', action: 'DELETE' },
    { moduleCode: 'employees', tabCode: 'attendance', action: 'VIEW' },
    { moduleCode: 'employees', tabCode: 'attendance', action: 'ADD' },
    { moduleCode: 'employees', tabCode: 'attendance', action: 'EDIT' },
    { moduleCode: 'employees', tabCode: 'attendance', action: 'DELETE' },
    { moduleCode: 'employees', tabCode: 'directory', action: 'VIEW' },
    { moduleCode: 'employees', tabCode: 'directory', action: 'ADD' },
    { moduleCode: 'employees', tabCode: 'directory', action: 'EDIT' },
    { moduleCode: 'employees', tabCode: 'directory', action: 'DELETE' },
    { moduleCode: 'employees', tabCode: 'payroll', action: 'VIEW' },
    { moduleCode: 'employees', tabCode: 'payroll', action: 'ADD' },
    { moduleCode: 'employees', tabCode: 'payroll', action: 'EDIT' },
    { moduleCode: 'employees', tabCode: 'payroll', action: 'DELETE' },
    { moduleCode: 'expenses', action: 'VIEW' },
    { moduleCode: 'expenses', action: 'ADD' },
    { moduleCode: 'expenses', action: 'EDIT' },
    { moduleCode: 'expenses', action: 'DELETE' },
    { moduleCode: 'inventory', action: 'VIEW' },
    { moduleCode: 'inventory', action: 'ADD' },
    { moduleCode: 'inventory', action: 'EDIT' },
    { moduleCode: 'inventory', action: 'DELETE' },
    { moduleCode: 'productiondetails', action: 'VIEW' },
    { moduleCode: 'productiondetails', action: 'ADD' },
    { moduleCode: 'productiondetails', action: 'EDIT' },
    { moduleCode: 'productiondetails', action: 'DELETE' },
    { moduleCode: 'reports', action: 'VIEW' },
    { moduleCode: 'reports', action: 'ADD' },
    { moduleCode: 'reports', action: 'EDIT' },
    { moduleCode: 'reports', action: 'DELETE' },
    { moduleCode: 'sampleproduction', action: 'VIEW' },
    { moduleCode: 'sampleproduction', action: 'ADD' },
    { moduleCode: 'sampleproduction', action: 'EDIT' },
    { moduleCode: 'sampleproduction', action: 'DELETE' },
];

export const DEFAULT_ROLES: { name: string; rights: DefaultRightSpec[] }[] = [
    {
        name: 'Manager',
        rights: [
            { moduleCode: 'inventory', action: 'VIEW' },
            { moduleCode: 'inventory', action: 'EDIT' },
            { moduleCode: 'inventory', action: 'ADD' },
            { moduleCode: 'dashboard', action: 'EDIT' },
            { moduleCode: 'productiondetails', action: 'VIEW' },
            { moduleCode: 'productiondetails', action: 'EDIT' },
            { moduleCode: 'employees', tabCode: 'directory', action: 'VIEW' },
            { moduleCode: 'employees', tabCode: 'directory', action: 'EDIT' },
            { moduleCode: 'employees', tabCode: 'attendance', action: 'VIEW' },
            { moduleCode: 'employees', tabCode: 'attendance', action: 'EDIT' },
            { moduleCode: 'employees', tabCode: 'payroll', action: 'VIEW' },
            { moduleCode: 'employees', tabCode: 'payroll', action: 'EDIT' },
            { moduleCode: 'expenses', action: 'VIEW' },
            { moduleCode: 'expenses', action: 'EDIT' },
            { moduleCode: 'expenses', action: 'DELETE' },
        ],
    },
    {
        name: 'Supervisor',
        rights: [
            { moduleCode: 'productiondetails', action: 'VIEW' },
            { moduleCode: 'dashboard', action: 'EDIT' },
            { moduleCode: 'inventory', action: 'VIEW' },
            { moduleCode: 'employees', tabCode: 'directory', action: 'VIEW' },
            { moduleCode: 'employees', tabCode: 'attendance', action: 'VIEW' },
            { moduleCode: 'employees', tabCode: 'payroll', action: 'VIEW' },
        ],
    },
];
