import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {tmpLedger} from './helpers.js';
import {saveConfig,loadConfig,loadCatalog} from '../src/rooms.js';
import {createApi} from '../src/api.js';
import {createRaceResearch} from '../src/race-research.js';
import {costUsd} from '../src/cost.js';
import {mapSvg} from '../art/folk-kit/mapSvg.js';

test('production stays calm until extreme volume and grows monotonically with bounded density',()=>{
 const html=fs.readFileSync(new URL('../src/station.html',import.meta.url),'utf8');
 const text=html.slice(html.indexOf('  function productionDensity('),html.indexOf('  function roomFlow('));
 const density=vm.runInNewContext(text+';productionDensity');
 for(const sales of [-1,0,1,100,1000,9999]){const d=density(sales);assert.equal(d.maxItems,2);assert.ok(d.every>13);assert.equal(d.spacing,8);}
 let prev=density(0);
 for(const sales of [100,9999,10000,10001,100000,1e6,1e9]){const d=density(sales);assert.ok(d.every<=prev.every);assert.ok(d.maxItems>=prev.maxItems&&d.maxItems<=8);assert.ok(d.spacing<=prev.spacing&&d.spacing>=2.8);prev=d;}
 assert.equal(density(NaN).maxItems,2);
});

test('room design saves shapes and swapped plots without touching money or room identity',async()=>{
 const {dir,ledger}=tmpLedger();saveConfig(dir,{name:'Test',rooms:[{name:'Red',position:[0,0]},{name:'Blue',position:[1,0]}]});
 const api=createApi({ledger,dataDir:dir});
 const before=ledger.readAll();
 const saved=await api('POST','/api/rooms/design',async()=>({rooms:[{id:'red',shape:'round',position:[1,0],name:'Injected',usd:99},{id:'blue',shape:'courtyard',position:[0,0]}]}));
 assert.equal(saved.code,200);assert.equal(loadConfig(dir).rooms[0].name,'Red');assert.equal(loadConfig(dir).rooms[0].shape,'round');assert.deepEqual(loadCatalog(dir)[0].position,[1,0]);assert.deepEqual(ledger.readAll(),before);
 for(const patch of [{position:[1,1]},{shape:'nope'},{position:[0,0]}])assert.equal((await api('POST','/api/rooms/design',async()=>({rooms:[{id:'red',...patch}]}))).code,400);
});

test('maps reflect moved rooms and profit extensions without losing navigation',()=>{
 const svg=mapSvg('lab',{rooms:[{id:'red',name:'Red',accent:'#ff4455',position:[3,2],shape:'round',growth:3}]});
 assert.match(svg,/data-sel="red"/);assert.equal((svg.match(/data-extension=/g)||[]).length,3);assert.ok(!svg.includes('NaN'));
 assert.notEqual(svg,mapSvg('lab',{rooms:[{id:'red',name:'Red',accent:'#ff4455'}]}));
});

function setupResearch(extra={}){
 const {dir,ledger}=tmpLedger();saveConfig(dir,{rooms:[{name:'Red'},{name:'Blue'}]});
 const calls=[];
 const service=createRaceResearch({ledger,dataDir:dir,ready:()=>true,makeProvider:async()=>({kind:'anthropic'}),run:async args=>{calls.push(args);return {reason:'done',usd:.12,summary:'Fresh evidence',runId:'run'+calls.length};},...extra});
 const race=()=>ledger.append({kind:'race',stakeUsd:250,evidence:'simulated',rooms:['red','blue']});
 return {service,ledger,dir,calls,race};
}

test('resident agents research once per new simulation, keep identity and remember prior work',async()=>{
 const {service,race,calls,ledger,dir}=setupResearch();
 const first=race();assert.equal(service.enqueue(first.id),null);assert.equal(calls.length,0);
 service.configure({enabled:true,totalUsd:8});service.enqueue(first.id);service.enqueue(first.id);await service.wait();
 assert.equal(calls.length,2);assert.equal(service.status().race.spentUsd,.24);assert.equal(service.status().race.status,'complete');assert.equal(calls[0].maxUsd,4);
 const second=race();service.enqueue(second.id);await service.wait();assert.equal(calls.length,4);assert.equal(calls[0].jobId,calls[2].jobId);assert.equal(calls[2].memory.length,1);assert.equal(calls[2].expectedRaceId,second.id);
 const restored=createRaceResearch({ledger,dataDir:dir,ready:()=>true,makeProvider:async()=>{throw Error('must not auto restart');}});assert.equal(restored.status().racers[0].previousRaces,2);
});

test('live research refuses missing keys and replay providers, and cancellation stops queued rooms',async()=>{
 const missing=setupResearch({ready:()=>false});assert.throws(()=>missing.service.configure({enabled:true,totalUsd:8}),/API_KEY/);
 const fake=setupResearch({makeProvider:async()=>({kind:'replay'})});fake.service.configure({enabled:true,totalUsd:8});fake.service.enqueue(fake.race().id);await fake.service.wait();assert.equal(fake.calls.length,0);assert.equal(fake.service.status().race.status,'partial');
 let unblock;
 const stop=setupResearch({run:()=>new Promise(resolve=>{unblock=()=>resolve({reason:'cancelled',usd:.05,summary:'Stopped',runId:'r'});})});
 stop.service.configure({enabled:true,totalUsd:8});stop.service.enqueue(stop.race().id);await Promise.resolve();assert.throws(()=>stop.service.guardNewRace(),/still running/);stop.service.stop();unblock();await stop.service.wait();assert.equal(stop.service.status().race.status,'cancelled');assert.equal(stop.service.status().race.rooms[1].status,'cancelled');
});

test('reported web-search requests are charged along with input and output tokens',()=>{
 assert.ok(Math.abs(costUsd('claude-sonnet-5',{input_tokens:100000,output_tokens:8000,server_tool_use:{web_search_requests:10}})-.38)<1e-9);
});
