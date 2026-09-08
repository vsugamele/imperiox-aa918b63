import { describe,it,expect } from "vitest";
import { parseFlowBlueprint } from "@/components/funis/flow-blueprint-data";
describe("persisted flow blueprint",()=>{
 it("preserves raw blocks, metadata and legacy extension fields through parsing",()=>{
 const input={title:"Existing",nodes:[{id:"n",title:"N",x:1,y:2,extra:true,blocks:[{id:"b",type:"text",text:"Hi",raw:{original:1},extension:"keep"}]}],edges:[],variables:[],meta:{skill_log:[{before:"original",after:"edited"}]}};
 expect(parseFlowBlueprint(input)).toEqual(input);
 });
 it("rejects invalid block types rather than relabeling and overwriting them",()=>{
 expect(()=>parseFlowBlueprint({title:"Existing",nodes:[{id:"n",title:"N",x:0,y:0,blocks:[{id:"b",type:"custom-unsupported"}]}],edges:[],variables:[]})).toThrow();
 });
});
