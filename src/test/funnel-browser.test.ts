import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
const code = readFileSync("public/funnel.js", "utf8");
interface Api { decorate(u:string):string; getIdentity():{visitor_id:string;session_id:string;click_id:string}; getTouches():{first:{params:Record<string,string>};last:{params:Record<string,string>}}; getDiagnostics():{pending:number;failed:number};track(s:string):void; }
const instances: JSDOM[] = [];
function setup(query = "", options: { storage?: Record<string,string>; failStorage?: boolean; consent?:boolean; failure?:boolean } = {}) {
  const dom = new JSDOM('<html><head></head><body><a class="buylink" href="https://checkout.test/pay?hid=original&affid=owner&package=6">Buy</a><vturb-smartplayer id="vid-test"></vturb-smartplayer></body></html>',{url:"https://own.test/"+query,runScripts:"outside-only"}); instances.push(dom);
  const w = dom.window;
  Object.defineProperty(w,"Date",{value:Date});
  if(vi.isFakeTimers()) Object.assign(w,{setTimeout,clearTimeout,setInterval,clearInterval});
  Object.assign(w,{IMPERIO_FUNNEL:{projectId:"leaftide",playerId:"test",pitchSeconds:100,trackingConsent:options.consent},fetch:vi.fn().mockResolvedValue({ok:!options.failure,status:options.failure?503:200,json:async()=>({ok:!options.failure})})});
  if(options.storage) for(const [k,v] of Object.entries(options.storage)) w.localStorage.setItem(k,v);
  if(options.failStorage) { Object.defineProperty(w,"localStorage",{get(){throw Error("blocked");}}); }
  w.eval(code);
  return {dom,w,api:(w as unknown as {imperioTracker:Api}).imperioTracker,fetch:w.fetch};
}
afterEach(()=>{for(const d of instances.splice(0))d.window.close();vi.clearAllTimers();vi.useRealTimers();});
describe("browser journey and delivery",()=>{
  it("preserves registered-link identity without attaching an old link to a new campaign",()=>{
    const one=setup("?imp_link_id=link-1&utm_source=facebook");
    expect(new URL(one.api.decorate("https://checkout.test/pay")).searchParams.get("imp_link_id")).toBe("link-1");
    expect(JSON.parse(String(vi.mocked(one.fetch).mock.calls[0][1]?.body)).meta.link_id).toBe("link-1");
    const storage:Record<string,string>={}; for(let i=0;i<one.w.localStorage.length;i++){const k=one.w.localStorage.key(i)!;storage[k]=one.w.localStorage.getItem(k)!;}
    const two=setup("?utm_source=google",{storage});
    expect(new URL(two.api.decorate("https://checkout.test/pay")).searchParams.get("imp_link_id")).toBeNull();
  });
  it("preserves affiliate identity and carries click/session across domains",()=>{
    const {api}=setup("?utm_source=codex-validation&affid=attacker&hid=wrong&email=private");
    const dest=new URL(api.decorate("https://checkout.test/pay?hid=original&affid=owner&package=6"));
    expect(dest.searchParams.get("affid")).toBe("owner");expect(dest.searchParams.get("hid")).toBe("original");expect(dest.searchParams.get("email")).toBeNull();
    expect(dest.searchParams.get("click_id")).toBe(api.getIdentity().click_id);
    const next=setup(dest.search); expect(next.api.getIdentity()).toEqual(api.getIdentity());
  });
  it("replaces the last contact as a unit, preserving first touch",()=>{
    const one=setup("?utm_source=facebook&utm_campaign=old&utm_content=old-ad");
    const storage:Record<string,string>={}; for(let i=0;i<one.w.localStorage.length;i++){const k=one.w.localStorage.key(i)!;storage[k]=one.w.localStorage.getItem(k)!;}
    const two=setup("?utm_source=google&utm_campaign=new",{storage});
    expect(two.api.getTouches().last.params).toEqual({utm_source:"google",utm_campaign:"new"});
    expect(two.api.getTouches().first.params.utm_content).toBe("old-ad");expect(two.api.getIdentity().click_id).not.toBe(one.api.getIdentity().click_id);
  });
  it("keeps checkout operational when storage is blocked",()=>{const {api}=setup("?utm_source=codex-validation",{failStorage:true});expect(new URL(api.decorate("https://checkout.test/pay")).searchParams.get("imp_click_id")).toBeTruthy();});
  it("does not collect/store identifiers when explicitly opted out",()=>{const {w,fetch,api}=setup("",{consent:false});expect(fetch).not.toHaveBeenCalled();expect(w.localStorage.length).toBe(0);expect(api.decorate("https://checkout.test/pay")).toBe("https://checkout.test/pay");});
  it("uses immutable IDs when retrying, stops after three attempts",async()=>{
    vi.useFakeTimers();const {w,fetch,api}=setup("?utm_source=codex-validation",{failure:true});
    await vi.advanceTimersByTimeAsync(20000);
    const calls=vi.mocked(fetch).mock.calls;expect(calls.length).toBe(3);
    const ids=calls.map(c=>JSON.parse(String(c[1]?.body)).event_id);expect(new Set(ids).size).toBe(1);expect(api.getDiagnostics().failed).toBe(1);
    w.close();
  });
  it("measures real SmartPlayer events once and distinguishes pitch from purchase",async()=>{
    const {w,fetch}=setup("?utm_source=codex-validation");const p=w.document.querySelector('vturb-smartplayer')!;
    Object.defineProperties(p,{duration:{value:200},currentTime:{value:120},inSmartAutoPlay:{value:false}});
    p.dispatchEvent(new w.Event("player:ready"));p.dispatchEvent(new w.Event("video:play"));
    p.dispatchEvent(new w.CustomEvent("video:timeupdate",{detail:{time:120}}));p.dispatchEvent(new w.CustomEvent("video:timeupdate",{detail:{time:120}}));
    await new Promise(r=>setTimeout(r,1100));
    const q=JSON.parse(w.localStorage.getItem("imperio_tracker_leaftide_queue")||"[]") as {payload:{step:string}}[];
    const sent=vi.mocked(fetch).mock.calls.map(c=>JSON.parse(String(c[1]?.body)).step as string);
    const steps=[...sent,...q.map(e=>e.payload.step)];expect(steps.filter(s=>s==="vsl_pitch").length).toBe(1);expect(steps).not.toContain("purchase");expect(steps).toContain("vsl_50");
  });
});
