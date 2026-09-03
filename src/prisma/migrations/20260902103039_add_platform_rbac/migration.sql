-- CreateTable
CREATE TABLE "platform_modules" (
    "id" UUID NOT NULL,
    "module_code" VARCHAR(50) NOT NULL,
    "module_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_tabs" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "tab_code" VARCHAR(50) NOT NULL,
    "tab_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_rights" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "tab_id" UUID,
    "action" "RightAction" NOT NULL,
    "right_name" VARCHAR(150) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_access" (
    "id" UUID NOT NULL,
    "role_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_role_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_access_rights" (
    "id" UUID NOT NULL,
    "role_access_id" UUID NOT NULL,
    "right_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_role_access_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_employee_access" (
    "id" UUID NOT NULL,
    "livik_emp_id" VARCHAR(60) NOT NULL,
    "role_access_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_employee_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_modules_module_code_key" ON "platform_modules"("module_code");

-- CreateIndex
CREATE INDEX "platform_tabs_module_id_idx" ON "platform_tabs"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_tabs_module_id_tab_code_key" ON "platform_tabs"("module_id", "tab_code");

-- CreateIndex
CREATE UNIQUE INDEX "platform_rights_right_name_key" ON "platform_rights"("right_name");

-- CreateIndex
CREATE INDEX "platform_rights_module_id_idx" ON "platform_rights"("module_id");

-- CreateIndex
CREATE INDEX "platform_rights_tab_id_idx" ON "platform_rights"("tab_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_role_access_role_name_key" ON "platform_role_access"("role_name");

-- CreateIndex
CREATE INDEX "platform_role_access_rights_right_id_idx" ON "platform_role_access_rights"("right_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_role_access_rights_role_access_id_right_id_key" ON "platform_role_access_rights"("role_access_id", "right_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_employee_access_livik_emp_id_key" ON "platform_employee_access"("livik_emp_id");

-- CreateIndex
CREATE INDEX "platform_employee_access_role_access_id_idx" ON "platform_employee_access"("role_access_id");

-- AddForeignKey
ALTER TABLE "platform_tabs" ADD CONSTRAINT "platform_tabs_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "platform_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_rights" ADD CONSTRAINT "platform_rights_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "platform_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_rights" ADD CONSTRAINT "platform_rights_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "platform_tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_access_rights" ADD CONSTRAINT "platform_role_access_rights_role_access_id_fkey" FOREIGN KEY ("role_access_id") REFERENCES "platform_role_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_access_rights" ADD CONSTRAINT "platform_role_access_rights_right_id_fkey" FOREIGN KEY ("right_id") REFERENCES "platform_rights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_employee_access" ADD CONSTRAINT "platform_employee_access_role_access_id_fkey" FOREIGN KEY ("role_access_id") REFERENCES "platform_role_access"("id") ON DELETE SET NULL ON UPDATE CASCADE;

