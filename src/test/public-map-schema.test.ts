import { describe, expect, it } from "vitest";
import { mapSchema } from "@/pages/public-map-schema";
describe("public map contract", () => {
 it("retains public node metadata and annotation styling", () => {
 const payload={map:{id:"map",name:"Map",viewport:{x:1,y:2,zoom:1}},nodes:[{id:"node",label:"Node",position:{x:2,y:3},checklist_total:2,checklist_done:1}],annotations:[{id:"note",kind:"note",x:1,y:2,text:"Note",style:{bgColor:"#fff",extra:"preserved"}}],edges:[]};
 expect(mapSchema.parse(payload)).toEqual(payload);
 });
 it("rejects malformed graph positions instead of passing them to ReactFlow", () => {
 expect(mapSchema.safeParse({map:{id:"map",name:"Map"},nodes:[{id:"node",position:{x:"bad",y:3}}],annotations:[],edges:[]}).success).toBe(false);
 });
});
