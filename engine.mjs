// Browser-only deterministic teaching model. No Python keys or live settlement data.
export const RESOURCE_UNITS = {water:'L',oxygen:'kg',food:'kg',energy:'kWh',battery:'kWh',equipment:'parts',human_work:'h',robot_work:'h'};
export const RESERVES = {water:20,oxygen:20,food:10,energy:10,battery:5,equipment:1,human_work:0,robot_work:0};
const INITIAL = {water:100,oxygen:80,food:60,energy:50,battery:30,equipment:10,human_work:20,robot_work:20};
const NAMES = ['ARES','HESTIA','PROMETHEUS'];
const FOCUS = {ARES:'Water · air · greenhouse',HESTIA:'Maintenance · robotics',PROMETHEUS:'Power · storage'};
const copy = value => JSON.parse(JSON.stringify(value));

export function createState(seed=1) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 1000000) throw Error('Seed must be a positive integer.');
  const nodes = Object.fromEntries(NAMES.map(name => [name,{name,focus:FOCUS[name],stock:copy(INITIAL),evidence:[],tasks:[],memory:[],alerts:[],online:true,events:[],seen:[]} ]));
  return {seed,random:seed,step:0,sequence:0,nodes,queue:[],messages:[],events:[],running:false};
}
function nextId(state,prefix) { return `${prefix}-${++state.sequence}`; }
function rand(state) { let x=state.random|0; x^=x<<13; x^=x>>>17; x^=x<<5; state.random=x>>>0; return state.random/4294967296; }
function record(state,node,kind,detail) {
  const item={id:nextId(state,'evt'),step:state.step,settlement:node?.name??'NETWORK',kind,detail,simulated:true};
  state.events.unshift(item); node?.events.unshift(item); return item;
}
function nodeOf(state,name) { const node=state.nodes[name]; if (!node) throw Error('Unknown settlement.'); return node; }
function evidence(state,node,topic,value,unit,source,status='observed',uncertainty='Not measured',supports=[],conflicts=[]) {
  const item={id:nextId(state,'e'),topic,value,unit,source,status,uncertainty,supports,conflicts,step:state.step,settlement:node.name,simulated:true};
  node.evidence.unshift(item); record(state,node,'evidence',`${topic}: ${value} ${unit} (${status}; ${source})`); return item;
}
function propose(state,node,label,evidenceIds,role='engineer',risk='standard',cost=null,why='') {
  if (!evidenceIds.length || evidenceIds.some(id=>!node.evidence.some(e=>e.id===id && e.status!=='predicted' && e.status!=='invalidated'))) throw Error('Action needs suitable evidence.');
  const task={id:nextId(state,'task'),label,evidenceIds,role,risk,cost,status:'pending',approvals:[],why,uncertainty:'Simulation evidence does not prove a real-world outcome.'};
  node.tasks.unshift(task); record(state,node,'task proposed',`${label}; human role ${role}${risk==='high'?' and safety officer':''}`); return task;
}
function inspectConflict(state,node,topic) {
  const readings=node.evidence.filter(e=>e.topic===topic && e.status==='observed').slice(0,2);
  if (readings.length<2 || readings[0].value===readings[1].value) return;
  readings.forEach(e=>{e.status='disputed';e.conflicts=[...new Set([...e.conflicts,...readings.filter(x=>x.id!==e.id).map(x=>x.id)])];});
  node.alerts.unshift({id:nextId(state,'alert'),kind:'conflict',text:`${topic} readings disagree`,why:`${readings.map(e=>`${e.value} ${e.unit} from ${e.source}`).join(' versus ')}. A third independent measurement would separate sensor fault from a real change.`,measurement:`Measure ${topic} with a third independent instrument; compare location and units.`});
  record(state,node,'evidence disputed',`${topic} has conflicting simulated readings`);
}
function loss(state,node,kind,amount) {
  const before=node.stock[kind]; const after=Math.max(0,before-amount); node.stock[kind]=after;
  record(state,node,'external simulated loss',`${kind}: ${before} → ${after} ${RESOURCE_UNITS[kind]}`);
  if(after<=RESERVES[kind]) node.alerts.unshift({id:nextId(state,'alert'),kind:'reserve',text:`${kind} at or below protected reserve`,why:`${after} ${RESOURCE_UNITS[kind]} remains; allocation below ${RESERVES[kind]} ${RESOURCE_UNITS[kind]} is blocked.`,measurement:'Check stock with a second measurement before planning.'});
}
function send(state,from,to,kind,payload,delay=3,id=null) {
  const message={id:id??nextId(state,'msg'),from,to,kind,payload,created:state.step,due:state.step+delay,status:'queued',senderLabel:'browser simulation only',reason:null};
  state.queue.push(message);state.messages.unshift(message);record(state,nodeOf(state,from),'message queued',`${kind} to ${to}; due step ${message.due}`);return message;
}
function deliver(state,message) {
  const receiver=nodeOf(state,message.to);
  if(receiver.seen.includes(message.id)) {message.status='rejected';message.reason='Duplicate/replayed message ID';record(state,receiver,'message rejected',message.reason);return;}
  receiver.seen.push(message.id);
  if(message.from!==message.payload.origin || !state.nodes[message.from]) {message.status='rejected';message.reason='Unknown or mismatched sender label';record(state,receiver,'message rejected',message.reason);return;}
  if(message.kind==='knowledge') {
    const pkg=copy(message.payload);
    if(pkg.compatibility!=='genesis-browser-v1' || pkg.verification!=='verified simulated outcome' || pkg.topic!=='filter-repair') {
      message.status='rejected'; message.reason='Knowledge unverified, unrelated or incompatible';
      receiver.memory.unshift({...pkg,status:'rejected',reason:message.reason});record(state,receiver,'knowledge rejected',message.reason);return;
    }
    const prior=receiver.memory.find(p=>p.status==='accepted' && p.topic===pkg.topic && p.method!==pkg.method);
    pkg.status=prior?'conflict-review':'quarantined'; pkg.reason=prior?'Conflicts with accepted local method; human review required':'Human verification review required';
    receiver.memory.unshift(pkg);message.status='delivered';record(state,receiver,'knowledge received',`${pkg.topic}; ${pkg.status}`);return;
  }
  message.status='delivered';record(state,receiver,'message delivered',message.kind);
}
export function advance(state,steps=1) {
  if(!Number.isInteger(steps)||steps<1||steps>100) throw Error('Invalid step count.');
  for(let i=0;i<steps;i++) {
    state.step++;
    for(const msg of state.queue) if(msg.status==='queued' && msg.due<=state.step && nodeOf(state,msg.from).online && nodeOf(state,msg.to).online) deliver(state,msg);
    state.queue=state.queue.filter(m=>m.status==='queued');
  }
  return state;
}
export function scenario(state,name) {
  const a=state.nodes.ARES,h=state.nodes.HESTIA,p=state.nodes.PROMETHEUS;
  switch(name) {
    case 'water': {loss(state,a,'water',80);const e=evidence(state,a,'water stock',a.stock.water,'L','simulated inventory','reported','Inventory count not independently checked');propose(state,a,'Inspect greenhouse water circuit',[e.id],'engineer','standard',{human_work:1},'Water is at the protected reserve. Inspect before committing more water.');break;}
    case 'conflict': {const x=evidence(state,a,'water pressure',8,'kPa','simulated sensor A');const y=evidence(state,a,'water pressure',5,'kPa','simulated sensor B');inspectConflict(state,a,'water pressure');propose(state,a,'Take independent water-pressure reading',[x.id,y.id],'engineer','standard',{human_work:1},'Two readings disagree; closing a valve would be premature.');break;}
    case 'storm': {loss(state,p,'energy',43);const e=evidence(state,p,'solar output',9,'kWh','simulated solar sensor','observed','Storm forecast is unverified');propose(state,p,'Reserve battery capacity',[e.id],'engineer','high',{battery:2},'Solar loss may threaten power; protected battery reserve still applies.');break;}
    case 'robot': {const e=evidence(state,h,'filter inspection',1,'report','simulated robot','reported','Robot report awaits human inspection');propose(state,h,'Inspect water filter',[e.id],'engineer','standard',{human_work:1},'A robot report is a lead, not independent proof.');break;}
    case 'refusal': {let t=a.tasks.find(t=>t.status==='pending');if(!t) {scenario(state,'conflict');t=a.tasks.find(t=>t.status==='pending');}return decide(state,'ARES',t.id,'engineer','refuse');}
    case 'blackout': {a.online=false;record(state,a,'link outage','ARES cannot receive or send queued messages');break;}
    case 'reconnect': {a.online=true;record(state,a,'link restored','Queued messages may be delivered on the next step');break;}
    case 'share': {const e=evidence(state,h,'filter repair outcome',1,'simulation result','simulated bench test','verified','Only tested in software');const pkg={id:nextId(state,'pkg'),origin:'HESTIA',topic:'filter-repair',method:'Inspect seal before replacement',verification:'verified simulated outcome',evidenceIds:[e.id],compatibility:'genesis-browser-v1',version:1};h.memory.unshift({...pkg,status:'local-verified',reason:'Simulated outcome recorded locally'});send(state,'HESTIA','ARES','knowledge',pkg,3);break;}
    case 'false-knowledge': {const pkg={id:nextId(state,'pkg'),origin:'HESTIA',topic:'filter-repair',method:'Bypass filter safety check',verification:'prediction only',evidenceIds:[],compatibility:'genesis-browser-v1',version:1};send(state,'HESTIA','ARES','knowledge',pkg,2);break;}
    case 'allocation': {const e=evidence(state,a,'shared water requests',120,'L','simulated planning request','reported','Requests not yet verified');for(const recipient of ['HESTIA','PROMETHEUS'])propose(state,a,`Allocate 60 L water to ${recipient}`,[e.id],'crew-operator','standard',{water:60},`Two requests total 120 L; only ${a.stock.water-RESERVES.water} L is above reserve. A human must choose.`);a.alerts.unshift({id:nextId(state,'alert'),kind:'allocation',text:'Competing requests exceed safe stock',why:`120 L requested, ${a.stock.water-RESERVES.water} L available above reserve. Both cannot proceed.`,measurement:'Confirm actual needs and current stock.'});record(state,a,'allocation conflict','Two 60 L requests exceed water above reserve');break;}
    case 'duplicate': {const original=state.messages.find(m=>m.status==='delivered');if(!original) {scenario(state,'share');advance(state,3);}send(state,original?.from??'HESTIA',original?.to??'ARES',original?.kind??'knowledge',original?.payload??{},0,original?.id??state.messages[0].id);advance(state);break;}
    default: throw Error('Unknown scenario.');
  }
  return state;
}
export function decide(state,settlement,taskId,role,decision) {
  const node=nodeOf(state,settlement),task=node.tasks.find(t=>t.id===taskId);
  if(!task||task.status!=='pending') throw Error('Task is not awaiting a decision.');
  if(!['approve','refuse'].includes(decision)||![task.role,...(task.risk==='high'?['safety-officer']:[])].includes(role)||task.approvals.some(a=>a.role===role))throw Error('Role cannot make this decision.');
  task.approvals.push({role,decision,step:state.step,actor:'simulated visitor'});
  if(decision==='refuse')task.status='refused';
  else if([task.role,...(task.risk==='high'?['safety-officer']:[])].every(r=>task.approvals.some(a=>a.role===r&&a.decision==='approve')))task.status='approved';
  record(state,node,'human decision',`${role} ${decision}d ${task.label}; status ${task.status}`);return state;
}
export function act(state,settlement,taskId) {
  const node=nodeOf(state,settlement),task=node.tasks.find(t=>t.id===taskId);
  if(!task||task.status!=='approved')throw Error('Human approval is required.');
  const [kind,qty]=Object.entries(task.cost??{})[0]??[];
  if(!kind||node.stock[kind]-qty<RESERVES[kind]) {task.status='blocked';record(state,node,'safety gate blocked',`${task.label}; ${kind??'resource'} reserve would be breached`);return state;}
  node.stock[kind]-=qty;task.status='completed';
  const recipient=task.label.match(/^Allocate 60 L water to (HESTIA|PROMETHEUS)$/)?.[1];
  if(recipient&&kind==='water') {
    nodeOf(state,recipient).stock.water+=qty;
    record(state,nodeOf(state,recipient),'simulated transfer received',`${qty} L water from ${settlement}; task ${task.id}`);
  }
  record(state,node,'simulated action',`${task.label}; used ${qty} ${RESOURCE_UNITS[kind]} of ${kind}; outcome: ${recipient?'resource transfer recorded':'inspection or allocation recorded'}, physical success unverified`);return state;
}
export function review(state,settlement,packageId,decision) {
  const node=nodeOf(state,settlement),pkg=node.memory.find(p=>p.id===packageId);
  if(!pkg||pkg.status!=='quarantined'||!['accept','reject'].includes(decision))throw Error('Package is not open for review.');
  pkg.status=decision==='accept'?'accepted':'rejected';pkg.reason=`${decision}ed by simulated independent verifier at step ${state.step}`;
  record(state,node,'knowledge review',`${pkg.topic}: ${pkg.reason}`);return state;
}
export function recommend(node) {
  const conflict=node.alerts.find(a=>a.kind==='conflict');
  if(conflict)return {action:'Request more evidence',why:conflict.why,measurement:conflict.measurement};
  const shortage=node.alerts.find(a=>a.kind==='reserve');
  if(shortage)return {action:'Protect reserve',why:shortage.why,measurement:shortage.measurement};
  return {action:'Continue monitoring',why:'No unresolved sensor conflict or reserve alert in this simulated record.',measurement:'No additional measurement selected yet.'};
}
export const SETTLEMENTS=NAMES;
