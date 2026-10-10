-- Read-only/rolled-back checks against the real device, never dispatch a valid command.
begin;
do $$
declare owner uuid; device uuid; a jsonb; failed boolean; prior public.imphq_office_commands;
begin
 select id,owner_id into device,owner from public.imphq_office_devices order by created_at desc limit 1;
 if device is null then raise exception 'No real device'; end if;
 if has_table_privilege('anon','public.imphq_office_devices','select') or has_table_privilege('authenticated','public.imphq_office_devices','select')
 or has_function_privilege('anon','public.imphq_office_read()','execute')
 or has_function_privilege('anon','public.imphq_office_enqueue(uuid,uuid,text,text,text,text,jsonb)','execute') then raise exception 'Unexpected access'; end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 if jsonb_array_length(public.imphq_office_read()->'devices')<>1 then raise exception 'Owner access failed'; end if;
 select * into prior from public.imphq_office_commands where device_id=device order by created_at desc limit 1;
 if prior.id is not null then
   if public.imphq_office_enqueue(prior.id,device,prior.agent_id,prior.session_id,prior.business_id,prior.kind,prior.payload)<>prior.id
   or (select count(*) from public.imphq_office_commands where id=prior.id)<>1 then raise exception 'Idempotency failed'; end if;
 end if;
 select x into a from public.imphq_office_devices d,jsonb_array_elements(d.snapshot->'agents') x where d.id=device limit 1;
 failed:=false;
 begin perform public.imphq_office_enqueue(gen_random_uuid(),device,a->>'id',a->>'sessionId','other-company','message','{"text":"not dispatched"}');
 exception when others then failed:=true; end;
 if not failed then raise exception 'Cross-company accepted'; end if;
 failed:=false;
 begin perform public.imphq_office_enqueue(gen_random_uuid(),device,a->>'id','wrong-session',a->>'businessId','message','{"text":"not dispatched"}');
 exception when others then failed:=true; end;
 if not failed then raise exception 'Wrong session accepted'; end if;
 update public.imphq_office_devices set last_seen=now()-interval '1 minute' where id=device;
 if (public.imphq_office_read()->'devices'->0->>'online')::boolean then raise exception 'Stale device online'; end if;
 failed:=false;
 begin perform public.imphq_office_enqueue(gen_random_uuid(),device,a->>'id',a->>'sessionId',a->>'businessId','message','{"text":"not dispatched"}');
 exception when others then failed:=true; end;
 if not failed then raise exception 'Offline command accepted'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if jsonb_array_length(public.imphq_office_read()->'devices')<>0 then raise exception 'Other user read device'; end if;
 failed:=false;
 begin perform public.imphq_office_enqueue(gen_random_uuid(),device,a->>'id',a->>'sessionId',a->>'businessId','message','{"text":"not dispatched"}');
 exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'Other user command accepted'; end if;
 perform set_config('request.jwt.claim.sub',(select user_id::text from public.imphq_user_roles where user_id<>owner and role='admin' and status='approved' limit 1),true);
 if jsonb_array_length(public.imphq_office_read()->'devices')<>0 then raise exception 'Other admin read device'; end if;
 failed:=false;
 begin perform public.imphq_office_sync(device,'invalid-device-key',null,'[]');
 exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'Invalid device credential accepted'; end if;
end $$;
rollback;
select 'OFFICE_SECURITY_CHECKS_PASSED' as result;
