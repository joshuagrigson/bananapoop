import fs from 'node:fs';
import path from 'node:path';
import { reduce } from './reduce.js';
import { raceBoard } from './race.js';
import { loadCatalog } from './rooms.js';
import { runRoom } from './racerun.js';

// A durable, serial queue. One identity per room; one fresh investigation per race.
// The browser never sees credentials. A static preview deliberately has no instance of this service.
export function createRaceResearch({ledger,dataDir,makeProvider,ready=()=>false,run=runRoom,now=()=>Date.now()}) {
  const file=path.join(dataDir,'race-research.json');
  let state={settings:{enabled:false,totalUsd:8,model:'claude-sonnet-5'},racers:{},races:{}};
  if(fs.existsSync(file)) state=JSON.parse(fs.readFileSync(file,'utf8'));
  let active=null,stopping=false,task=null;
  const save=()=>{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(state,null,2));fs.renameSync(file+'.tmp',file);};
  for(const race of Object.values(state.races)) if(['queued','running'].includes(race.status)){race.status='interrupted';for(const room of race.rooms)if(['queued','running'].includes(room.status))room.status='interrupted';}
  const catalog=()=>loadCatalog(dataDir);
  function roster(){
    for(const room of catalog()) if(!state.racers[room.id])state.racers[room.id]={id:'race-agent-'+room.id,roomId:room.id,name:room.short+' researcher',memory:[]};
    return catalog().map(r=>state.racers[r.id]);
  }
  roster();save();
  function status(){
    const current=reduce(ledger.readAll(),catalog()).race;
    return {available:true,ready:Boolean(ready()),settings:{...state.settings},active:active?.id||null,racers:roster().map(({memory,...r})=>({...r,previousRaces:memory.length})),race:current?state.races[current.id]||null:null};
  }
  function configure(input){
    if(active)throw new Error('Stop the current research run before changing its settings.');
    const total=Number(input.totalUsd);
    if(!Number.isFinite(total)||total<1||total>100)throw new Error('Choose a research budget target from $1 to $100 per race.');
    if(input.enabled && !ready())throw new Error('Set ANTHROPIC_API_KEY on the server and restart it before enabling live research.');
    state.settings={enabled:input.enabled===true,totalUsd:total,model:'claude-sonnet-5'};save();return status();
  }
  function guardNewRace(){if(active)throw new Error('Research is still running. Stop it and wait for the current request to finish before starting a new race.');if(state.settings.enabled&&!ready())throw new Error('Live research is enabled but the server has no API key. Disable research or restore the server key before starting a race.');}
  function enqueue(raceId){
    if(!state.settings.enabled)return null;
    if(state.races[raceId])return state.races[raceId];
    guardNewRace();
    if(!ready())throw new Error('The server has no Anthropic API key.');
    const cat=catalog(),board=raceBoard(reduce(ledger.readAll(),cat),cat,now());
    if(!board||board.id!==raceId||!board.simMode) return null;
    roster();
    const job={id:raceId,status:'queued',createdAt:new Date(now()).toISOString(),totalUsd:state.settings.totalUsd,spentUsd:0,rooms:board.lanes.map(l=>({roomId:l.id,agentId:state.racers[l.id].id,status:'queued',stage:'Waiting for research',usd:0}))};
    state.races[raceId]=job;save();
    task=drain(job,board,cat).catch(e=>{job.status='failed';job.error=String(e.message).slice(0,400);save();}).finally(()=>{active=null;task=null;});
    return job;
  }
  async function drain(job,board,cat){
    active=job;stopping=false;
    job.status='running';save();
    const startAt=Date.parse(board.startedAt);
    while(now()<startAt&&!stopping)await new Promise(r=>setTimeout(r,Math.min(1000,startAt-now())));
    for(const entry of job.rooms){
      if(stopping){entry.status='cancelled';continue;}
      if(job.spentUsd>=job.totalUsd){entry.status='budget';entry.stage='Race budget reached';continue;}
      const agent=state.racers[entry.roomId];
      entry.status='running';entry.stage='Searching current trends';save();
      try{
        const provider=await makeProvider();
        if(provider.kind!=='anthropic')throw new Error('Live research requires the Anthropic provider; scripted replay is not live research.');
        const result=await run({ledger,catalog:cat,roomId:entry.roomId,provider,model:state.settings.model,
          maxUsd:Math.min(job.totalUsd/job.rooms.length,job.totalUsd-job.spentUsd),maxIterations:18,searches:10,
          jobId:agent.id,agentName:agent.name,memory:agent.memory.slice(-3),expectedRaceId:job.id,shouldStop:()=>stopping,
          log:e=>{entry.stage=e.type==='research'?'Reading and citing sources':e.type==='sim'?'Testing and building ideas':e.type==='play'?'Choosing the business':e.type==='iteration'?'Evaluating evidence':entry.stage;if(e.usd!==undefined)entry.usd=e.usd;save();}});
        entry.usd=result.usd;job.spentUsd+=result.usd;entry.status=result.reason==='done'?'complete':result.reason;entry.stage=result.reason==='done'?'Research complete':result.reason;entry.summary=result.summary;
        entry.runId=result.runId;
        agent.memory.push({raceId:job.id,at:new Date(now()).toISOString(),summary:result.summary.slice(0,4000)});agent.memory=agent.memory.slice(-10);
      }catch(e){entry.status='failed';entry.stage='Needs attention';entry.error=String(e.message).slice(0,400);}
      save();
    }
    job.status=stopping?'cancelled':job.rooms.every(r=>r.status==='complete')?'complete':'partial';job.endedAt=new Date(now()).toISOString();save();
  }
  function stop(){stopping=true;return status();}
  return {status,configure,enqueue,guardNewRace,stop,wait:()=>task||Promise.resolve()};
}
