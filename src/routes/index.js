import express from 'express';
import { getConnections, testConnection } from '../controllers/connectionController.js';
import { getTables } from '../controllers/tableController.js';
import { getSchemasOverview, getSchemaForTable } from '../controllers/schemaController.js';
import { getRowCounts, comparePrimaryKeys, compareRows, compareRowTable } from '../controllers/dataController.js';
import { compareIndexes } from '../controllers/indexController.js';
import { getApiTables, getApiEndpointsByTable, getApiEndpoints } from '../controllers/apiController.js';
import { getFlowTables, getFlowColumns } from '../controllers/flowController.js';

const router = express.Router();

router.get('/api/connections', getConnections);
router.get('/api/test-connection', testConnection);

router.get('/api/tables', getTables);

router.get('/api/schemas-overview', getSchemasOverview);
router.get('/api/schema/:table', getSchemaForTable);

router.get('/api/row-counts', getRowCounts);
router.get('/api/pk-compare/:table', comparePrimaryKeys);
router.get('/api/row-compare/:table', compareRows);
router.get('/api/row-table/:table', compareRowTable);

router.get('/api/indexes/:table', compareIndexes);

router.get('/api/api-tables', getApiTables);
router.get('/api/api-tables/endpoints/:table', getApiEndpointsByTable);
router.get('/api/api-endpoints', getApiEndpoints);

router.get('/api/flow/tables', getFlowTables);
router.get('/api/flow/columns', getFlowColumns);

export default router;
