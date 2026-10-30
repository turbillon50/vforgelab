import fs from 'node:fs';
export async function gpuStatus() {
 return Promise.all([11441,11442,11443].map(async(port,i)=>{
  const start=Date.now();
  try { const response=await fetch(`http://127.0.0.1:${port}/api/tags`,{signal:AbortSignal.timeout(1500)}); if(!response.ok)throw Error(); const data=await response.json(); return {name:`GPU ${i+1}`,online:true,latency_ms:Date.now()-start,models:(data.models||[]).map(m=>m.name).slice(0,4),utilization:null}; }
  catch {return {name:`GPU ${i+1}`,online:false,models:[],utilization:null};}
 }));
}
export async function processCleanup(pool) {
 const result=await pool.query(`UPDATE app.telemetry_events SET metrics=metrics||'{"status":"running"}'::jsonb WHERE id=(SELECT id FROM app.telemetry_events WHERE source='cleanup-request' AND metrics->>'status'='queued' ORDER BY created_at LIMIT 1) AND metrics->>'status'='queued' RETURNING id`);
 if(result.rows[0]) {
  let bytes=0,files=0; const before=fs.statfsSync('/');
  // Fixed regenerable download caches only. No caller-supplied paths or commands.
  const roots=['/root/.npm/_cacache/content-v2','/var/cache/apt/archives'];
  function walk(p){let entries;try{entries=fs.readdirSync(p,{withFileTypes:true});}catch{return;}
   for(const e of entries){const f=p+'/'+e.name;try{if(e.isSymbolicLink())continue;if(e.isDirectory())walk(f);else if(e.isFile()){const s=fs.lstatSync(f);if(Date.now()-s.mtimeMs>3600000 && !e.name.endsWith('.lock')){fs.unlinkSync(f);bytes+=s.size;files++;}}}catch{}}
  }
  for(const p of roots)walk(p);
  const after=fs.statfsSync('/'); const metrics={status:'done',files,bytes,net_free_bytes:(after.bavail-before.bavail)*after.bsize,finished_at:new Date().toISOString()};
  await pool.query('UPDATE app.telemetry_events SET metrics=$2 WHERE id=$1',[result.rows[0].id,metrics]);
 }
 const latest=await pool.query("SELECT metrics FROM app.telemetry_events WHERE source='cleanup-request' ORDER BY created_at DESC LIMIT 1");
 return latest.rows[0]?.metrics||null;
}
