import { Router } from 'express';
import {
  createBrand,
  createChemical,
  createColor,
  createSize,
  deleteBrand,
  deleteChemical,
  deleteColor,
  deleteSize,
  getLookups,
  updateBrand,
  updateChemical,
  updateColor,
  updateSize,
} from '../controllers/lookup.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

/**
 * @openapi
 * /api/v1/lookups:
 *   get:
 *     tags: [Lookups]
 *     summary: Master data for dropdowns
 *     description: >
 *       Returns brands, colours, chemicals, and sizes in one call, each sorted
 *       by name. Used to populate the dropdowns on the production entry forms
 *       (Extruder, Looms, Fabric Checking) and the Raw Materials admin screen.
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupsResponse'
 */
router.get('/', getLookups);

/**
 * @openapi
 * /api/v1/lookups/colors:
 *   post:
 *     tags: [Lookups]
 *     summary: Create a color
 *     description: >
 *       itemCode is always server-generated ("CR" + a zero-padded per-company
 *       sequence, e.g. CR001) — never accepted from the client. Requires the ADMIN role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 50, example: White }
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: A color with this name already exists (COLOR_NAME_EXISTS).
 */
router.post('/colors', requireAuth('ADMIN'), createColor);

/**
 * @openapi
 * /api/v1/lookups/colors/{id}:
 *   patch:
 *     tags: [Lookups]
 *     summary: Rename a color
 *     description: itemCode never changes. Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 50 }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       404:
 *         description: No color exists with this id (COLOR_NOT_FOUND).
 *       409:
 *         description: A color with this name already exists (COLOR_NAME_EXISTS).
 *   delete:
 *     tags: [Lookups]
 *     summary: Delete a color
 *     description: Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         description: No color exists with this id (COLOR_NOT_FOUND).
 */
router.patch('/colors/:id', requireAuth('ADMIN'), updateColor);
router.delete('/colors/:id', requireAuth('ADMIN'), deleteColor);

/**
 * @openapi
 * /api/v1/lookups/sizes:
 *   post:
 *     tags: [Lookups]
 *     summary: Create a size
 *     description: >
 *       itemCode is always server-generated ("SE" + a zero-padded per-company
 *       sequence, e.g. SE001) — never accepted from the client. Requires the ADMIN role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 30, example: 160mm }
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: A size with this name already exists (SIZE_NAME_EXISTS).
 */
router.post('/sizes', requireAuth('ADMIN'), createSize);

/**
 * @openapi
 * /api/v1/lookups/sizes/{id}:
 *   patch:
 *     tags: [Lookups]
 *     summary: Rename a size
 *     description: itemCode never changes. Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 30 }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       404:
 *         description: No size exists with this id (SIZE_NOT_FOUND).
 *       409:
 *         description: A size with this name already exists (SIZE_NAME_EXISTS).
 *   delete:
 *     tags: [Lookups]
 *     summary: Delete a size
 *     description: Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         description: No size exists with this id (SIZE_NOT_FOUND).
 */
router.patch('/sizes/:id', requireAuth('ADMIN'), updateSize);
router.delete('/sizes/:id', requireAuth('ADMIN'), deleteSize);

/**
 * @openapi
 * /api/v1/lookups/chemicals:
 *   post:
 *     tags: [Lookups]
 *     summary: Create a chemical
 *     description: >
 *       itemCode is always server-generated ("CL" + a zero-padded per-company
 *       sequence, e.g. CL001) — never accepted from the client. Requires the ADMIN role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100, example: DN+MB }
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: A chemical with this name already exists (CHEMICAL_NAME_EXISTS).
 */
router.post('/chemicals', requireAuth('ADMIN'), createChemical);

/**
 * @openapi
 * /api/v1/lookups/chemicals/{id}:
 *   patch:
 *     tags: [Lookups]
 *     summary: Rename a chemical
 *     description: itemCode never changes. Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       404:
 *         description: No chemical exists with this id (CHEMICAL_NOT_FOUND).
 *       409:
 *         description: A chemical with this name already exists (CHEMICAL_NAME_EXISTS).
 *   delete:
 *     tags: [Lookups]
 *     summary: Delete a chemical
 *     description: Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         description: No chemical exists with this id (CHEMICAL_NOT_FOUND).
 */
router.patch('/chemicals/:id', requireAuth('ADMIN'), updateChemical);
router.delete('/chemicals/:id', requireAuth('ADMIN'), deleteChemical);

/**
 * @openapi
 * /api/v1/lookups/brands:
 *   post:
 *     tags: [Lookups]
 *     summary: Create a brand
 *     description: >
 *       itemCode is always server-generated ("BD" + a zero-padded per-company
 *       sequence, e.g. BD001) — never accepted from the client. Requires the ADMIN role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100, example: Reliance }
 *     responses:
 *       201:
 *         description: Created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: A brand with this name already exists (BRAND_NAME_EXISTS).
 */
router.post('/brands', requireAuth('ADMIN'), createBrand);

/**
 * @openapi
 * /api/v1/lookups/brands/{id}:
 *   patch:
 *     tags: [Lookups]
 *     summary: Rename a brand
 *     description: itemCode never changes. Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupItemResponse'
 *       404:
 *         description: No brand exists with this id (BRAND_NOT_FOUND).
 *       409:
 *         description: A brand with this name already exists (BRAND_NAME_EXISTS).
 *   delete:
 *     tags: [Lookups]
 *     summary: Delete a brand
 *     description: Requires the ADMIN role.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         description: No brand exists with this id (BRAND_NOT_FOUND).
 */
router.patch('/brands/:id', requireAuth('ADMIN'), updateBrand);
router.delete('/brands/:id', requireAuth('ADMIN'), deleteBrand);

export default router;
