import { query } from '../config/db.js';

export async function checkDatabaseConnection(): Promise<{ connected: boolean; serverTime: Date }> {
    const result = await query<{ current_time: Date }>('SELECT NOW() AS current_time');
    return { connected: true, serverTime: result.rows[0].current_time };
}
