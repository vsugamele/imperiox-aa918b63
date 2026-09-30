import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { z } from "zod";
import { record } from "@shared/value";

function server(secret: string | undefined, profile = true) {
  let handler: (req: Request) => Promise<Response> = async () => new Response("uninitialized", {status:500});
  const listUsers = vi.fn(async () => ({ data: { users: [{id:"fixture-user",email:"fixture@example.test",phone:"+5511999999999",user_metadata:{}}] }, error:null }));
  const from = vi.fn((table: string) => {
    const result = table === "areamembrojp_profiles" ? {data:profile ? {id:"fixture-user",email:"fixture@example.test",name:"Fixture"} : null,error:null}
      : table === "areamembrojp_user_entitlements" ? {data:[{scope:"program",program_id:"fixture-course",is_active:true}],error:null}
      : {data:null,error:null};
    const query = {select:()=>query,ilike:()=>query,eq:()=>query,maybeSingle:async()=>result,insert:async()=>({error:null}),then:<T>(fn:(value:typeof result)=>T)=>Promise.resolve(fn(result))};
    return query;
  });
  const source = readFileSync(resolve(process.cwd(),"supabase/functions/crm-bridge/index.ts"),"utf8").replace(/^import .*;\r?\n/gm,"");
  const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("Deno","createClient","z","record",code)({env:{get:(key:string)=>key==="JPFREITAS_CRM_BRIDGE_SECRET" ? secret : "test"},serve:(fn:typeof handler)=>{handler=fn;}},()=>({from,auth:{admin:{listUsers}}}),z,record);
  return {handler,from,listUsers};
}
describe("Published JP CRM request boundary",()=>{
  it("uses the existing environment secret when the database setting is absent",async()=>{
    const app=server("test-secret");
    const response=await app.handler(new Request("https://example.test",{method:"POST",headers:{"x-crm-secret":"test-secret"},body:JSON.stringify({action:"lookup_lead",email:"fixture@example.test"})}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({exists:true,entitlements:[{program_id:"fixture-course"}]});
    expect(app.from.mock.calls.some(([table])=>table==="areamembrojp_settings")).toBe(false);
  });
  it("rejects an invalid secret before reading student data",async()=>{
    const app=server("test-secret");
    expect((await app.handler(new Request("https://example.test",{method:"POST",headers:{"x-crm-secret":"wrong"},body:'{"action":"lookup_lead"}'}))).status).toBe(401);
    expect(app.from).not.toHaveBeenCalled();
  });
  it("fails closed if neither environment nor stored secret exists",async()=>{
    const app=server(undefined);
    expect((await app.handler(new Request("https://example.test",{method:"POST",body:'{}'}))).status).toBe(503);
  });
  it("uses the supported Admin listUsers fallback for accounts missing profile email",async()=>{
    const app=server("test-secret",false);
    const response=await app.handler(new Request("https://example.test",{method:"POST",headers:{"x-crm-secret":"test-secret"},body:JSON.stringify({action:"lookup_lead",email:"fixture@example.test"})}));
    expect(response.status).toBe(200);expect((await response.json()).exists).toBe(true);
    expect(app.listUsers).toHaveBeenCalledWith({page:1,perPage:1000});
  });
  it("resolves the phone-only lookup already used by the WhatsApp caller",async()=>{
    const app=server("test-secret");
    const response=await app.handler(new Request("https://example.test",{method:"POST",headers:{"x-crm-secret":"test-secret"},body:JSON.stringify({action:"lookup_lead",phone:"5511999999999"})}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({exists:true,email:"fixture@example.test"});
  });
  it("accepts only the exact administrator credential for internal service calls",async()=>{
    const app=server("test-secret");
    const body=JSON.stringify({action:"lookup_lead",email:"fixture@example.test"});
    expect((await app.handler(new Request("https://example.test",{method:"POST",headers:{authorization:"Bearer test"},body}))).status).toBe(200);
    expect((await app.handler(new Request("https://example.test",{method:"POST",headers:{authorization:"Bearer invalid"},body}))).status).toBe(401);
  });
});
