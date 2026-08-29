/** Seeded into every new company at signup (see authService.signupCompany). Admins can add/edit/delete beyond this via the Module/Tab CRUD endpoints. */
export const DEFAULT_MODULES = [
    { code: 'dashboard', name: 'Dashboard', tabs: [] },
    { code: 'productiondetails', name: 'Production Details', tabs: [] },
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
    { code: 'admin_panel', name: 'Admin Panel', tabs: [] },
] as const;
