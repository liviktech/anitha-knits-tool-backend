--
-- PostgreSQL database dump
--

\restrict T4Q5ylcLA50H6xGX1vUdbkUHcDZ5Resk5LPX2LLgND7cnqRi8FmRnZjy9slihkz

-- Dumped from database version 18.6 (c5250a2)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'DAY_SHIFT',
    'NIGHT_SHIFT',
    'ABSENT',
    'HALF_DAY',
    'COMPANY_HOLIDAY'
);


--
-- Name: Gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Gender" AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER'
);


--
-- Name: InventoryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryType" AS ENUM (
    'HDPE',
    'CHEMICAL',
    'COLOR'
);


--
-- Name: KoraEntryType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."KoraEntryType" AS ENUM (
    'CREDIT',
    'DEBIT'
);


--
-- Name: PlatformAdminRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlatformAdminRole" AS ENUM (
    'SUPER_ADMIN'
);


--
-- Name: ProductionRecordType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductionRecordType" AS ENUM (
    'NORMAL',
    'ADJUSTMENT',
    'REVERSAL'
);


--
-- Name: ProductionStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductionStage" AS ENUM (
    'EXTRUDER',
    'LOOMS',
    'FABRIC_CHECKING',
    'DELIVERY'
);


--
-- Name: ProductionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductionType" AS ENUM (
    'PRODUCTION',
    'SAMPLE'
);


--
-- Name: RightAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RightAction" AS ENUM (
    'VIEW',
    'ADD',
    'EDIT',
    'DELETE'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'MANAGER',
    'SUPERVISOR',
    'EMPLOYEE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendances (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    status public."AttendanceStatus" NOT NULL,
    remarks character varying(500),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100)
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    item_code character varying(20) NOT NULL
);


--
-- Name: chemicals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chemicals (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    item_code character varying(20) NOT NULL
);


--
-- Name: color_consumption_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.color_consumption_standards (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    basis_weight_kg numeric(10,3) DEFAULT 25 NOT NULL,
    hdpe_material_bag integer DEFAULT 1 NOT NULL,
    chemical_weight_kg numeric(12,3),
    date date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    blue_kg_basis numeric(10,3) NOT NULL,
    green_kg_basis numeric(10,3) NOT NULL,
    white_kg_basis numeric(10,3) NOT NULL
);


--
-- Name: colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colors (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    item_code character varying(20) NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    address character varying(500),
    gst character varying(20),
    admin_mobile character varying(15) NOT NULL,
    admin_password_hash character varying(255) NOT NULL,
    company_code character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    employee_seq integer DEFAULT 1 NOT NULL,
    brand_seq integer DEFAULT 1 NOT NULL,
    chemical_seq integer DEFAULT 1 NOT NULL,
    color_seq integer DEFAULT 1 NOT NULL,
    size_seq integer DEFAULT 1 NOT NULL
);


--
-- Name: employee_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_details (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    custom_user_id character varying(60) NOT NULL,
    name character varying(150),
    designation character varying(100),
    address character varying(500),
    gender public."Gender",
    salary numeric(12,2),
    aadhaar_number character varying(20),
    aadhaar_document_url character varying(500),
    document_name character varying(255),
    aadhaar_document_uploaded_at timestamp(6) with time zone,
    joining_date date,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    photo_url character varying(500)
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid NOT NULL,
    expense_id character varying(20) NOT NULL,
    company_id uuid NOT NULL,
    date date DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expense_name character varying(150) NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100)
);


--
-- Name: extruder_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extruder_details (
    id uuid NOT NULL,
    production_record_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    raw_material_kg numeric(12,3) NOT NULL,
    chemical_id uuid NOT NULL,
    chemical_kg numeric(12,3) NOT NULL,
    color_consumed_kg numeric(12,3) NOT NULL,
    yarn_output_kg numeric(12,3) NOT NULL,
    is_recipe_overridden boolean DEFAULT false NOT NULL,
    override_reason character varying(500),
    bag_count integer,
    bag_weight_kg numeric(12,3),
    loose_weight_kg numeric(12,3),
    total_weight_kg numeric(12,3)
);


--
-- Name: fabric_check_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fabric_check_details (
    id uuid NOT NULL,
    production_record_id uuid NOT NULL,
    fabric_input_kg numeric(12,3) NOT NULL,
    output_kg numeric(12,3)
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type public."InventoryType" NOT NULL,
    "DC_NUMBER" text NOT NULL,
    name character varying(150) NOT NULL,
    weight_kg numeric(12,3) NOT NULL,
    brand_id uuid,
    chemical_id uuid,
    color_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    bag_count integer,
    group_id uuid
);


--
-- Name: kora_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kora_balances (
    id uuid NOT NULL,
    color_id uuid NOT NULL,
    size_id uuid NOT NULL,
    balance_kg numeric(14,3) DEFAULT 0 NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    company_id uuid
);


--
-- Name: kora_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kora_ledger_entries (
    id uuid NOT NULL,
    kora_balance_id uuid NOT NULL,
    entry_type public."KoraEntryType" NOT NULL,
    stock_date date NOT NULL,
    production_record_id uuid,
    quantity_kg numeric(12,3) NOT NULL,
    balance_after_kg numeric(14,3) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL
);


--
-- Name: load_sent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.load_sent (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    production_record_id uuid,
    color_id uuid NOT NULL,
    size_id uuid NOT NULL,
    fabric_weight numeric(12,3) DEFAULT 0 NOT NULL,
    fw_weight numeric(12,3) DEFAULT 0 NOT NULL,
    bw_weight numeric(12,3) DEFAULT 0 NOT NULL,
    total_wastage_weight numeric(12,3) DEFAULT 0 NOT NULL,
    driver_name character varying(100),
    vehicle_no character varying(20),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100)
);


--
-- Name: loom_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loom_details (
    id uuid NOT NULL,
    production_record_id uuid NOT NULL,
    yarn_input_kg numeric(12,3) NOT NULL,
    fabric_output_kg numeric(12,3) NOT NULL
);


--
-- Name: market_value_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_value_allocations (
    id uuid NOT NULL,
    distribution_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: market_value_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_value_distributions (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    effective_date date NOT NULL,
    total_pool numeric(12,2) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100)
);


--
-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    module_code character varying(50) NOT NULL,
    module_name character varying(100) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: payroll_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_records (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    month smallint NOT NULL,
    year smallint NOT NULL,
    base_salary numeric(12,2) NOT NULL,
    total_days_in_month smallint NOT NULL,
    days_worked numeric(5,2) NOT NULL,
    lop_deduction numeric(12,2) NOT NULL,
    advance_deduction numeric(12,2) NOT NULL,
    sunday_bonuses numeric(12,2) NOT NULL,
    market_value_bonus numeric(12,2) NOT NULL,
    gross_salary numeric(12,2) NOT NULL,
    net_salary numeric(12,2) NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: platform_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admins (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    mobile character varying(15) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public."PlatformAdminRole" DEFAULT 'SUPER_ADMIN'::public."PlatformAdminRole" NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: production_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_records (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    type public."ProductionType" DEFAULT 'PRODUCTION'::public."ProductionType" NOT NULL,
    stage public."ProductionStage" NOT NULL,
    production_date date NOT NULL,
    color_id uuid NOT NULL,
    size_id uuid NOT NULL,
    record_type public."ProductionRecordType" DEFAULT 'NORMAL'::public."ProductionRecordType" NOT NULL,
    reverses_record_id uuid,
    remarks character varying(500),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    approved_at timestamp(6) with time zone,
    approved_by character varying(100),
    is_approved boolean DEFAULT false NOT NULL
);


--
-- Name: rights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rights (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    module_id uuid NOT NULL,
    tab_id uuid,
    right_name character varying(150) NOT NULL,
    display_name character varying(200) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    action public."RightAction" NOT NULL
);


--
-- Name: role_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_access (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    role_name character varying(100) NOT NULL,
    description character varying(500),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: role_access_rights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_access_rights (
    id uuid NOT NULL,
    role_access_id uuid NOT NULL,
    right_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: salary_advances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_advances (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    effective_date date NOT NULL,
    repayment_method character varying(50) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    emi_amount numeric(12,2),
    total_months integer
);


--
-- Name: sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sizes (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    name character varying(30) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    item_code character varying(20) NOT NULL
);


--
-- Name: tabs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tabs (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    module_id uuid NOT NULL,
    tab_code character varying(50) NOT NULL,
    tab_name character varying(100) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    name character varying(150),
    mobile character varying(15) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public."UserRole" DEFAULT 'EMPLOYEE'::public."UserRole" NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100),
    role_access_id uuid
);


--
-- Name: wastage_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wastage_records (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    production_record_id uuid NOT NULL,
    wastage_type_id uuid NOT NULL,
    color_id uuid,
    quantity_kg numeric(12,3) NOT NULL,
    reason character varying(500),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100)
);


--
-- Name: wastage_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wastage_types (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    stage public."ProductionStage" NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    is_color_tracked boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(100),
    updated_at timestamp(6) with time zone NOT NULL,
    updated_by character varying(100)
);


--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: chemicals chemicals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemicals
    ADD CONSTRAINT chemicals_pkey PRIMARY KEY (id);


--
-- Name: color_consumption_standards color_consumption_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.color_consumption_standards
    ADD CONSTRAINT color_consumption_standards_pkey PRIMARY KEY (id);


--
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: employee_details employee_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_details
    ADD CONSTRAINT employee_details_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: extruder_details extruder_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extruder_details
    ADD CONSTRAINT extruder_details_pkey PRIMARY KEY (id);


--
-- Name: fabric_check_details fabric_check_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fabric_check_details
    ADD CONSTRAINT fabric_check_details_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: kora_balances kora_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kora_balances
    ADD CONSTRAINT kora_balances_pkey PRIMARY KEY (id);


--
-- Name: kora_ledger_entries kora_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kora_ledger_entries
    ADD CONSTRAINT kora_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: load_sent load_sent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_sent
    ADD CONSTRAINT load_sent_pkey PRIMARY KEY (id);


--
-- Name: loom_details loom_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loom_details
    ADD CONSTRAINT loom_details_pkey PRIMARY KEY (id);


--
-- Name: market_value_allocations market_value_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_value_allocations
    ADD CONSTRAINT market_value_allocations_pkey PRIMARY KEY (id);


--
-- Name: market_value_distributions market_value_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_value_distributions
    ADD CONSTRAINT market_value_distributions_pkey PRIMARY KEY (id);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: payroll_records payroll_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_pkey PRIMARY KEY (id);


--
-- Name: platform_admins platform_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (id);


--
-- Name: production_records production_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_records
    ADD CONSTRAINT production_records_pkey PRIMARY KEY (id);


--
-- Name: rights rights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights
    ADD CONSTRAINT rights_pkey PRIMARY KEY (id);


--
-- Name: role_access role_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_access
    ADD CONSTRAINT role_access_pkey PRIMARY KEY (id);


--
-- Name: role_access_rights role_access_rights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_access_rights
    ADD CONSTRAINT role_access_rights_pkey PRIMARY KEY (id);


--
-- Name: salary_advances salary_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_advances
    ADD CONSTRAINT salary_advances_pkey PRIMARY KEY (id);


--
-- Name: sizes sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sizes
    ADD CONSTRAINT sizes_pkey PRIMARY KEY (id);


--
-- Name: tabs tabs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wastage_records wastage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_records
    ADD CONSTRAINT wastage_records_pkey PRIMARY KEY (id);


--
-- Name: wastage_types wastage_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_types
    ADD CONSTRAINT wastage_types_pkey PRIMARY KEY (id);


--
-- Name: attendances_company_id_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendances_company_id_date_idx ON public.attendances USING btree (company_id, date);


--
-- Name: attendances_company_id_employee_id_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendances_company_id_employee_id_date_key ON public.attendances USING btree (company_id, employee_id, date);


--
-- Name: brands_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brands_company_id_idx ON public.brands USING btree (company_id);


--
-- Name: brands_company_id_item_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brands_company_id_item_code_key ON public.brands USING btree (company_id, item_code);


--
-- Name: brands_company_id_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brands_company_id_name_key ON public.brands USING btree (company_id, name);


--
-- Name: chemicals_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chemicals_company_id_idx ON public.chemicals USING btree (company_id);


--
-- Name: chemicals_company_id_item_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chemicals_company_id_item_code_key ON public.chemicals USING btree (company_id, item_code);


--
-- Name: chemicals_company_id_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chemicals_company_id_name_key ON public.chemicals USING btree (company_id, name);


--
-- Name: color_consumption_standards_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX color_consumption_standards_company_id_idx ON public.color_consumption_standards USING btree (company_id);


--
-- Name: colors_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX colors_company_id_idx ON public.colors USING btree (company_id);


--
-- Name: colors_company_id_item_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX colors_company_id_item_code_key ON public.colors USING btree (company_id, item_code);


--
-- Name: colors_company_id_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX colors_company_id_name_key ON public.colors USING btree (company_id, name);


--
-- Name: companies_admin_mobile_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX companies_admin_mobile_key ON public.companies USING btree (admin_mobile);


--
-- Name: companies_company_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX companies_company_code_key ON public.companies USING btree (company_code);


--
-- Name: companies_gst_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX companies_gst_key ON public.companies USING btree (gst);


--
-- Name: companies_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_is_active_idx ON public.companies USING btree (is_active);


--
-- Name: companies_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_name_idx ON public.companies USING btree (name);


--
-- Name: employee_details_custom_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_details_custom_user_id_key ON public.employee_details USING btree (custom_user_id);


--
-- Name: employee_details_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_details_user_id_idx ON public.employee_details USING btree (user_id);


--
-- Name: employee_details_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_details_user_id_key ON public.employee_details USING btree (user_id);


--
-- Name: expenses_company_id_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_company_id_date_idx ON public.expenses USING btree (company_id, date);


--
-- Name: expenses_company_id_expense_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX expenses_company_id_expense_id_key ON public.expenses USING btree (company_id, expense_id);


--
-- Name: expenses_company_id_expense_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_company_id_expense_name_idx ON public.expenses USING btree (company_id, expense_name);


--
-- Name: expenses_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_company_id_idx ON public.expenses USING btree (company_id);


--
-- Name: extruder_details_brand_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX extruder_details_brand_id_idx ON public.extruder_details USING btree (brand_id);


--
-- Name: extruder_details_chemical_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX extruder_details_chemical_id_idx ON public.extruder_details USING btree (chemical_id);


--
-- Name: extruder_details_production_record_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX extruder_details_production_record_id_key ON public.extruder_details USING btree (production_record_id);


--
-- Name: fabric_check_details_production_record_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fabric_check_details_production_record_id_key ON public.fabric_check_details USING btree (production_record_id);


--
-- Name: inventory_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_company_id_idx ON public.inventory USING btree (company_id);


--
-- Name: inventory_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_date_idx ON public.inventory USING btree (date);


--
-- Name: inventory_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_group_id_idx ON public.inventory USING btree (group_id);


--
-- Name: inventory_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_name_idx ON public.inventory USING btree (name);


--
-- Name: inventory_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_type_idx ON public.inventory USING btree (type);


--
-- Name: kora_balances_color_id_size_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kora_balances_color_id_size_id_key ON public.kora_balances USING btree (color_id, size_id);


--
-- Name: kora_balances_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kora_balances_company_id_idx ON public.kora_balances USING btree (company_id);


--
-- Name: kora_ledger_entries_kora_balance_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kora_ledger_entries_kora_balance_id_created_at_idx ON public.kora_ledger_entries USING btree (kora_balance_id, created_at);


--
-- Name: kora_ledger_entries_production_record_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kora_ledger_entries_production_record_id_key ON public.kora_ledger_entries USING btree (production_record_id);


--
-- Name: load_sent_color_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX load_sent_color_id_idx ON public.load_sent USING btree (color_id);


--
-- Name: load_sent_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX load_sent_company_id_idx ON public.load_sent USING btree (company_id);


--
-- Name: load_sent_production_record_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX load_sent_production_record_id_idx ON public.load_sent USING btree (production_record_id);


--
-- Name: load_sent_production_record_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX load_sent_production_record_id_key ON public.load_sent USING btree (production_record_id);


--
-- Name: load_sent_size_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX load_sent_size_id_idx ON public.load_sent USING btree (size_id);


--
-- Name: loom_details_production_record_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loom_details_production_record_id_key ON public.loom_details USING btree (production_record_id);


--
-- Name: market_value_allocations_distribution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX market_value_allocations_distribution_id_idx ON public.market_value_allocations USING btree (distribution_id);


--
-- Name: market_value_allocations_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX market_value_allocations_employee_id_idx ON public.market_value_allocations USING btree (employee_id);


--
-- Name: market_value_distributions_company_id_effective_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX market_value_distributions_company_id_effective_date_idx ON public.market_value_distributions USING btree (company_id, effective_date);


--
-- Name: modules_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX modules_company_id_idx ON public.modules USING btree (company_id);


--
-- Name: modules_company_id_module_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX modules_company_id_module_code_key ON public.modules USING btree (company_id, module_code);


--
-- Name: payroll_records_company_id_month_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payroll_records_company_id_month_year_idx ON public.payroll_records USING btree (company_id, month, year);


--
-- Name: payroll_records_employee_id_month_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_records_employee_id_month_year_key ON public.payroll_records USING btree (employee_id, month, year);


--
-- Name: platform_admins_mobile_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_admins_mobile_key ON public.platform_admins USING btree (mobile);


--
-- Name: production_records_color_id_size_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_records_color_id_size_id_idx ON public.production_records USING btree (color_id, size_id);


--
-- Name: production_records_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_records_company_id_idx ON public.production_records USING btree (company_id);


--
-- Name: production_records_company_id_is_approved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_records_company_id_is_approved_idx ON public.production_records USING btree (company_id, is_approved);


--
-- Name: production_records_company_id_production_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_records_company_id_production_date_idx ON public.production_records USING btree (company_id, production_date);


--
-- Name: production_records_company_id_stage_production_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_records_company_id_stage_production_date_idx ON public.production_records USING btree (company_id, stage, production_date);


--
-- Name: production_records_reverses_record_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_records_reverses_record_id_idx ON public.production_records USING btree (reverses_record_id);


--
-- Name: rights_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rights_company_id_idx ON public.rights USING btree (company_id);


--
-- Name: rights_company_id_right_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rights_company_id_right_name_key ON public.rights USING btree (company_id, right_name);


--
-- Name: rights_module_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rights_module_id_idx ON public.rights USING btree (module_id);


--
-- Name: rights_tab_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rights_tab_id_idx ON public.rights USING btree (tab_id);


--
-- Name: role_access_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX role_access_company_id_idx ON public.role_access USING btree (company_id);


--
-- Name: role_access_company_id_role_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_access_company_id_role_name_key ON public.role_access USING btree (company_id, role_name);


--
-- Name: role_access_rights_right_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX role_access_rights_right_id_idx ON public.role_access_rights USING btree (right_id);


--
-- Name: role_access_rights_role_access_id_right_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_access_rights_role_access_id_right_id_key ON public.role_access_rights USING btree (role_access_id, right_id);


--
-- Name: salary_advances_company_id_effective_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salary_advances_company_id_effective_date_idx ON public.salary_advances USING btree (company_id, effective_date);


--
-- Name: salary_advances_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salary_advances_employee_id_idx ON public.salary_advances USING btree (employee_id);


--
-- Name: sizes_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sizes_company_id_idx ON public.sizes USING btree (company_id);


--
-- Name: sizes_company_id_item_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sizes_company_id_item_code_key ON public.sizes USING btree (company_id, item_code);


--
-- Name: sizes_company_id_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sizes_company_id_name_key ON public.sizes USING btree (company_id, name);


--
-- Name: tabs_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tabs_company_id_idx ON public.tabs USING btree (company_id);


--
-- Name: tabs_company_id_module_id_tab_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tabs_company_id_module_id_tab_code_key ON public.tabs USING btree (company_id, module_id, tab_code);


--
-- Name: tabs_module_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tabs_module_id_idx ON public.tabs USING btree (module_id);


--
-- Name: users_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_company_id_idx ON public.users USING btree (company_id);


--
-- Name: users_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_company_id_is_active_idx ON public.users USING btree (company_id, is_active);


--
-- Name: users_company_id_mobile_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_company_id_mobile_key ON public.users USING btree (company_id, mobile);


--
-- Name: users_company_id_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_company_id_role_idx ON public.users USING btree (company_id, role);


--
-- Name: users_role_access_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_access_id_idx ON public.users USING btree (role_access_id);


--
-- Name: wastage_records_color_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wastage_records_color_id_idx ON public.wastage_records USING btree (color_id);


--
-- Name: wastage_records_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wastage_records_company_id_idx ON public.wastage_records USING btree (company_id);


--
-- Name: wastage_records_production_record_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wastage_records_production_record_id_idx ON public.wastage_records USING btree (production_record_id);


--
-- Name: wastage_records_wastage_type_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wastage_records_wastage_type_id_idx ON public.wastage_records USING btree (wastage_type_id);


--
-- Name: wastage_types_company_id_stage_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wastage_types_company_id_stage_code_key ON public.wastage_types USING btree (company_id, stage, code);


--
-- Name: wastage_types_company_id_stage_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wastage_types_company_id_stage_is_active_idx ON public.wastage_types USING btree (company_id, stage, is_active);


--
-- Name: attendances attendances_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attendances attendances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: brands brands_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chemicals chemicals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemicals
    ADD CONSTRAINT chemicals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: color_consumption_standards color_consumption_standards_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.color_consumption_standards
    ADD CONSTRAINT color_consumption_standards_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: colors colors_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: employee_details employee_details_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_details
    ADD CONSTRAINT employee_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: expenses expenses_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: extruder_details extruder_details_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extruder_details
    ADD CONSTRAINT extruder_details_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: extruder_details extruder_details_chemical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extruder_details
    ADD CONSTRAINT extruder_details_chemical_id_fkey FOREIGN KEY (chemical_id) REFERENCES public.chemicals(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: extruder_details extruder_details_production_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extruder_details
    ADD CONSTRAINT extruder_details_production_record_id_fkey FOREIGN KEY (production_record_id) REFERENCES public.production_records(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fabric_check_details fabric_check_details_production_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fabric_check_details
    ADD CONSTRAINT fabric_check_details_production_record_id_fkey FOREIGN KEY (production_record_id) REFERENCES public.production_records(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory inventory_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory inventory_chemical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_chemical_id_fkey FOREIGN KEY (chemical_id) REFERENCES public.chemicals(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory inventory_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory inventory_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kora_balances kora_balances_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kora_balances
    ADD CONSTRAINT kora_balances_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kora_balances kora_balances_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kora_balances
    ADD CONSTRAINT kora_balances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kora_balances kora_balances_size_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kora_balances
    ADD CONSTRAINT kora_balances_size_id_fkey FOREIGN KEY (size_id) REFERENCES public.sizes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kora_ledger_entries kora_ledger_entries_kora_balance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kora_ledger_entries
    ADD CONSTRAINT kora_ledger_entries_kora_balance_id_fkey FOREIGN KEY (kora_balance_id) REFERENCES public.kora_balances(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kora_ledger_entries kora_ledger_entries_production_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kora_ledger_entries
    ADD CONSTRAINT kora_ledger_entries_production_record_id_fkey FOREIGN KEY (production_record_id) REFERENCES public.production_records(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: load_sent load_sent_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_sent
    ADD CONSTRAINT load_sent_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: load_sent load_sent_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_sent
    ADD CONSTRAINT load_sent_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: load_sent load_sent_production_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_sent
    ADD CONSTRAINT load_sent_production_record_id_fkey FOREIGN KEY (production_record_id) REFERENCES public.production_records(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: load_sent load_sent_size_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_sent
    ADD CONSTRAINT load_sent_size_id_fkey FOREIGN KEY (size_id) REFERENCES public.sizes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loom_details loom_details_production_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loom_details
    ADD CONSTRAINT loom_details_production_record_id_fkey FOREIGN KEY (production_record_id) REFERENCES public.production_records(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: market_value_allocations market_value_allocations_distribution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_value_allocations
    ADD CONSTRAINT market_value_allocations_distribution_id_fkey FOREIGN KEY (distribution_id) REFERENCES public.market_value_distributions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: market_value_allocations market_value_allocations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_value_allocations
    ADD CONSTRAINT market_value_allocations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: market_value_distributions market_value_distributions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_value_distributions
    ADD CONSTRAINT market_value_distributions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: modules modules_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payroll_records payroll_records_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payroll_records payroll_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_records production_records_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_records
    ADD CONSTRAINT production_records_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: production_records production_records_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_records
    ADD CONSTRAINT production_records_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_records production_records_reverses_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_records
    ADD CONSTRAINT production_records_reverses_record_id_fkey FOREIGN KEY (reverses_record_id) REFERENCES public.production_records(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: production_records production_records_size_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_records
    ADD CONSTRAINT production_records_size_id_fkey FOREIGN KEY (size_id) REFERENCES public.sizes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rights rights_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights
    ADD CONSTRAINT rights_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rights rights_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights
    ADD CONSTRAINT rights_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rights rights_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rights
    ADD CONSTRAINT rights_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_access role_access_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_access
    ADD CONSTRAINT role_access_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_access_rights role_access_rights_right_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_access_rights
    ADD CONSTRAINT role_access_rights_right_id_fkey FOREIGN KEY (right_id) REFERENCES public.rights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_access_rights role_access_rights_role_access_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_access_rights
    ADD CONSTRAINT role_access_rights_role_access_id_fkey FOREIGN KEY (role_access_id) REFERENCES public.role_access(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: salary_advances salary_advances_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_advances
    ADD CONSTRAINT salary_advances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: salary_advances salary_advances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_advances
    ADD CONSTRAINT salary_advances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sizes sizes_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sizes
    ADD CONSTRAINT sizes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tabs tabs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tabs tabs_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_role_access_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_access_id_fkey FOREIGN KEY (role_access_id) REFERENCES public.role_access(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wastage_records wastage_records_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_records
    ADD CONSTRAINT wastage_records_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wastage_records wastage_records_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_records
    ADD CONSTRAINT wastage_records_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wastage_records wastage_records_production_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_records
    ADD CONSTRAINT wastage_records_production_record_id_fkey FOREIGN KEY (production_record_id) REFERENCES public.production_records(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: wastage_records wastage_records_wastage_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_records
    ADD CONSTRAINT wastage_records_wastage_type_id_fkey FOREIGN KEY (wastage_type_id) REFERENCES public.wastage_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: wastage_types wastage_types_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wastage_types
    ADD CONSTRAINT wastage_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict T4Q5ylcLA50H6xGX1vUdbkUHcDZ5Resk5LPX2LLgND7cnqRi8FmRnZjy9slihkz

