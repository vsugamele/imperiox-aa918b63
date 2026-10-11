import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BellRing, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OfficeAgent, OfficeDevice } from '@/lib/office-command';
import { useIsMobile } from '@/hooks/use-mobile';
import { appearanceFromSeed, characterSprite, drawFloor, drawWallFace, furnitureSprites, hash32, type FurnitureKind, type Sprite } from '@/vendor/habblaud/art';
import '@/components/office/office-map.css';

export type OfficeRoom = OfficeDevice['snapshot']['rooms'][number];
export const BUSINESSES = [{ id:'imperio', name:'Império', subtitle:'Marketing e operação', color:'#d6ff4b' }, { id:'consultoria-bandeiras', name:'Consultoria de Bandeiras', subtitle:'Consultoria e projetos', color:'#84c5f4' }] as const;

interface AvatarProps { agent: OfficeAgent; online: boolean }
function AgentAvatar({ agent, online }: AvatarProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const permissionId = agent.permission?.id;
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const appearance = appearanceFromSeed(hash32(agent.id));
    const pose = permissionId || agent.status === 'waiting' ? 'raise_hand' : agent.status === 'working' ? 'type' : 'sit';
    let frame = 0;
    const paint = () => {
      const sprite = characterSprite({ appearance, dir:pose === 'type' ? 'up' : 'down', pose, frame:frame++ });
      context.clearRect(0,0,64,80);
      context.imageSmoothingEnabled = false;
      context.drawImage(sprite.canvas,32-sprite.ax*2,70-sprite.ay*2,sprite.canvas.width*2,sprite.canvas.height*2);
    };
    paint();
    if (reduceMotion || !online) return;
    const timer = window.setInterval(paint,350);
    return () => window.clearInterval(timer);
  }, [agent.id, agent.status, permissionId, online, reduceMotion]);
  return <canvas ref={canvas} width={64} height={80} aria-hidden="true" className="office-avatar" />;
}

interface RoomProps { room: OfficeRoom; agents: OfficeAgent[]; online: boolean; selectedId?: string; onSelect: (agent: OfficeAgent) => void }
function OfficeRoomScene({ room, agents, online, selectedId, onSelect }: RoomProps) {
  const floor = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const sorted = [...agents].sort((a,b) => a.id.localeCompare(b.id));
  const rows = Math.max(1,Math.ceil(sorted.length/3));
  const height = 144 + (rows-1)*96;
  const seats = Math.max(3,sorted.length);
  useEffect(() => {
    const ctx = floor.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const seed = hash32(room.id);
    drawFloor(ctx,room.permanent?'carpet':'wood',0,0,256,height,{seed,tint:room.businessId==='imperio'?'#cbd2c1':'#c2ced8',tint2:'#e0e5dc'});
    drawWallFace(ctx,0,0,256,{base:'#e5e8e5',trim:'#89949a',pattern:'plain'});
    const draw = (sprite: Sprite,x:number,y:number) => ctx.drawImage(sprite.canvas,x-sprite.ax,y-sprite.ay);
    const furniture = (kind: FurnitureKind,x:number,y:number) => draw(furnitureSprites(kind,undefined,0,{seed}).base,x,y);
    furniture('plant_small',13,43);
    furniture('plant_small',243,43);
    for (let i=0;i<seats;i++) {
      const x = 43+(i%3)*85;
      const y = 56+Math.floor(i/3)*96;
      furniture('desk',x,y);
      furniture('office_chair',x,y+17);
    }
    ctx.fillStyle = '#a8b2b5';
    ctx.fillRect(0,32,3,height-32);
    ctx.fillRect(253,32,3,height-32);
    ctx.fillRect(0,height-3,105,3);
    ctx.fillRect(151,height-3,105,3);
  }, [room.id,room.businessId,room.permanent,height,seats]);
  const pending = agents.filter(a=>!!a.permission || a.status==='waiting').length;
  return <section className="office-room" aria-label={`Sala ${room.permanent?room.areaName:room.name}`}>
    <header className="office-room-header"><h3>{room.permanent?room.areaName:room.name}</h3><span>{agents.length} {agents.length===1?'agente':'agentes'}</span></header>
    {!room.permanent && <p className="office-project-label">Sala de projeto</p>}
    <div className="office-room-scene" style={{aspectRatio:`256 / ${height}`}}>
      <canvas ref={floor} width={256} height={height} className="office-floor" aria-hidden="true" />
      {sorted.map((agent,index)=> {
        const needsYou = !!agent.permission || agent.status==='waiting';
        return <motion.button key={agent.id} layoutId={`office-agent-${agent.id}`} transition={{duration:reduceMotion?0:0.65}}
          className={`office-person ${selectedId===agent.id?'office-person-selected':''}`}
          style={{left:`${(43+(index%3)*85)/256*100}%`,top:`${(34+Math.floor(index/3)*96)/height*100}%`}}
          aria-label={`Abrir ${agent.name}, ${needsYou?'precisa de você':agent.status==='working'?'trabalhando':'disponível'}`}
          onClick={()=>onSelect(agent)}>
          {needsYou && <span className="office-person-alert" aria-hidden="true">!</span>}
          <AgentAvatar agent={agent} online={online} />
          <span className="office-person-name">{agent.name}</span>
          <span className={`office-person-status ${needsYou?'office-needs-you':''}`}>{!online?'Último estado':needsYou?'Precisa de você':agent.status==='working'?'Trabalhando':agent.status==='shell'?'Executando':'Disponível'}</span>
        </motion.button>;
      })}
      {!agents.length && <span className="office-room-empty">Sala disponível</span>}
    </div>
    {pending>0 && <p className="office-room-pending"><BellRing className="h-3 w-3" />{pending} {pending===1?'agente precisa':'agentes precisam'} de você</p>}
  </section>;
}

interface OfficeMapProps { device: OfficeDevice; online: boolean; business: string; onBusiness: (id:string)=>void; selectedId?: string; onSelect: (agent:OfficeAgent)=>void }
export function OfficeMap({ device,online,business,onBusiness,selectedId,onSelect }: OfficeMapProps) {
  const [roomId,setRoomId] = useState('');
  const mobile = useIsMobile();
  const roomsFor = (company:string) => device.snapshot.rooms.filter(r=>r.businessId===company && (r.permanent || device.snapshot.agents.some(a=>a.roomId===r.id && a.businessId===company)));
  const mobileRooms = roomsFor(business);
  const activeRoom = mobileRooms.find(r=>r.id===roomId) || mobileRooms.find(r=>device.snapshot.agents.some(a=>a.roomId===r.id && a.businessId===business)) || mobileRooms[0];
  const agentsFor = (room:OfficeRoom) => device.snapshot.agents.filter(a=>a.roomId===room.id && a.businessId===room.businessId);
  const pendingAgents = device.snapshot.agents.filter(a=>!!a.permission || a.status==='waiting');
  return <LayoutGroup id={device.id}>
    <div className="office-mobile-navigation">
      <nav aria-label="Empresa" className="grid grid-cols-2 gap-2">{BUSINESSES.map(company=><Button key={company.id} variant={business===company.id?'default':'outline'} className="whitespace-normal h-auto min-h-12" onClick={()=>{onBusiness(company.id);setRoomId('');}}>{company.name}</Button>)}</nav>
      <label className="block text-sm">Sala<select aria-label="Sala" className="office-room-select" value={activeRoom?.id || ''} onChange={e=>setRoomId(e.target.value)}>{mobileRooms.map(room=><option key={room.id} value={room.id}>{room.permanent?room.areaName:room.name} · {agentsFor(room).length} agentes</option>)}</select></label>
    </div>
    {pendingAgents.length>0 && <div className="office-attention" aria-label="Agentes com pendências"><BellRing className="h-4 w-4 shrink-0" /><span>Precisam de você</span>{pendingAgents.map(agent=><button key={agent.id} onClick={()=>{onBusiness(agent.businessId);setRoomId(agent.roomId);onSelect(agent);}}>{agent.name}<ArrowRight className="h-3 w-3" /></button>)}</div>}
    {!mobile && <div className="office-desktop-map">{BUSINESSES.map(company=><section key={company.id} className="office-wing" style={{'--wing-color':company.color} as CSSProperties} aria-label={`Ala ${company.name}`}>
      <header className="office-wing-header"><Building2 className="h-5 w-5" /><div><h2>{company.name}</h2><p>{company.subtitle}</p></div><span>{device.snapshot.agents.filter(a=>a.businessId===company.id).length} agentes</span></header>
      <div className="office-wing-rooms">{roomsFor(company.id).map(room=><OfficeRoomScene key={room.id} room={room} agents={agentsFor(room)} online={online} selectedId={selectedId} onSelect={onSelect} />)}</div>
      {!roomsFor(company.id).length && <p className="p-5 text-sm text-muted-foreground">Nenhuma sala recebida para esta empresa.</p>}
    </section>)}</div>}
    {mobile && <div className="office-mobile-scene">{activeRoom ? <OfficeRoomScene room={activeRoom} agents={agentsFor(activeRoom)} online={online} selectedId={selectedId} onSelect={onSelect} /> : <p>Nenhuma sala recebida para esta empresa.</p>}</div>}
    <p className="office-map-help">Toque em um agente para ver a tarefa, mandar uma instrução ou responder uma pendência.</p>
  </LayoutGroup>;
}
