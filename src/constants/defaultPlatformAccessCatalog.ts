/** LK Space's own module catalog — mirrors defaultAccessCatalog.ts's shape, scoped to the platform-admin panel instead of a tenant company. Seeded once via prisma/seedPlatformCatalog.ts (there's no per-company "signup" moment to hook this into, since LK Space itself isn't a tenant). */
export const DEFAULT_PLATFORM_MODULES = [
    { code: 'dashboard', name: 'Dashboard', tabs: [] },
    { code: 'companies', name: 'Companies', tabs: [] },
    { code: 'users', name: 'Users', tabs: [] },
    { code: 'roles', name: 'Roles and Rights', tabs: [] },
] as const;
