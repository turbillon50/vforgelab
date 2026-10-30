import pg from 'pg';
import { createWebHandler } from '../src/web-adapter.mjs';

let handler;
export default async function api(req,res) {
  if (!handler) {
    const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
    pool.on('error',()=>console.error('database_connection_error'));
    handler = createWebHandler({pool});
  }
  return handler(req,res);
}
