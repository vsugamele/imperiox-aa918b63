import { fireEvent, render, screen, within, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Escritorio from '@/pages/Escritorio';
import { readOffice, type OfficeDevice } from '@/lib/office-command';

vi.mock('@/contexts/auth-context',()=>({useAuth:()=>({isAdmin:true})}));
vi.mock('@/hooks/use-mobile',()=>({useIsMobile:()=>false}));
vi.mock('@/lib/office-command',()=>({readOffice:vi.fn(),sendOfficeCommand:vi.fn()}));

// Isolated fixtures exercise routing and stale-session protection; never shown in the app.
function device(online=true): OfficeDevice {
  return {id:'00000000-0000-4000-8000-000000000001',name:'Dispositivo de teste',lastSeen:new Date().toISOString(),online,commands:[],snapshot:{
    rooms:[{id:'tech',name:'Tecnologia',areaName:'Tecnologia',businessId:'imperio',businessName:'Império',permanent:true},{id:'boletins',name:'Boletins',areaName:'Boletins',businessId:'consultoria-bandeiras',businessName:'Consultoria',permanent:true}],
    agents:[{id:'agent-1',sessionId:'session-1',name:'Agente Império',roomId:'tech',businessId:'imperio',provider:'codex',status:'working',title:'',activity:'Revisando a tarefa',waitingFor:'',permission:null,canMessage:true,tasks:[]},{id:'agent-2',sessionId:'session-2',name:'Agente Consultoria',roomId:'boletins',businessId:'consultoria-bandeiras',provider:'claude',status:'idle',title:'',activity:'Disponível',waitingFor:'',permission:null,canMessage:true,tasks:[]}]
  }};
}
function mount(d:OfficeDevice){
  const state={serverTime:new Date().toISOString(),devices:[d]};
  vi.mocked(readOffice).mockResolvedValue(state);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  render(<QueryClientProvider client={client}><Escritorio/></QueryClientProvider>);
  return client;
}
beforeEach(()=>{vi.clearAllMocks();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);});

describe('Escritório visual e comandos',()=>{
  it('keeps each agent in its company wing and opens the selected session',async()=>{
    mount(device());
    const imperio=await screen.findByRole('region',{name:'Ala Império'});
    const consultoria=screen.getByRole('region',{name:'Ala Consultoria de Bandeiras'});
    expect(within(imperio).queryByRole('button',{name:/Abrir Agente Consultoria/})).not.toBeInTheDocument();
    fireEvent.click(within(consultoria).getByRole('button',{name:/Abrir Agente Consultoria/}));
    const panel=screen.getByRole('dialog');
    expect(within(panel).getByLabelText('Instrução para Agente Consultoria')).toBeEnabled();
    expect(within(panel).queryByLabelText('Instrução para Agente Império')).not.toBeInTheDocument();
  });
  it('blocks the composer while the device is offline',async()=>{
    mount(device(false));
    fireEvent.click(await screen.findByRole('button',{name:/Abrir Agente Império/}));
    expect(within(screen.getByRole('dialog')).getByLabelText('Instrução para Agente Império')).toBeDisabled();
  });
  it('does not retarget an open composer to a replacement session',async()=>{
    const d=device();const client=mount(d);
    fireEvent.click(await screen.findByRole('button',{name:/Abrir Agente Império/}));
    const replacement={...d,snapshot:{...d.snapshot,agents:d.snapshot.agents.map(a=>a.id==='agent-1'?{...a,sessionId:'replacement-session'}:a)}};
    await act(async()=>{client.setQueryData(['office-command'],{serverTime:new Date().toISOString(),devices:[replacement]});});
    expect(await screen.findByText('Sessão encerrada')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByLabelText('Instrução para Agente Império')).not.toBeInTheDocument();
    client.clear();
  });
  it('moves an agent to its updated room while keeping the same session selected',async()=>{
    const d=device();const client=mount(d);
    fireEvent.click(await screen.findByRole('button',{name:/Abrir Agente Império/}));
    const moved={...d,snapshot:{...d.snapshot,rooms:[...d.snapshot.rooms,{...d.snapshot.rooms[0],id:'social',name:'Social Media',areaName:'Social Media'}],agents:d.snapshot.agents.map(a=>a.id==='agent-1'?{...a,roomId:'social'}:a)}};
    await act(async()=>{client.setQueryData(['office-command'],{serverTime:new Date().toISOString(),devices:[moved]});});
    await waitFor(()=>expect(within(screen.getByRole('region',{name:'Sala Tecnologia',hidden:true})).queryByRole('button',{name:/Abrir Agente Império/,hidden:true})).not.toBeInTheDocument());
    expect(within(screen.getByRole('region',{name:'Sala Social Media',hidden:true})).getByRole('button',{name:/Abrir Agente Império/,hidden:true})).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByLabelText('Instrução para Agente Império')).toBeEnabled();
    client.clear();
  });
});
