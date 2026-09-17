import { z } from "zod";
const point=z.object({x:z.number(),y:z.number()});
const style=z.object({bgColor:z.string().nullish(),borderColor:z.string().nullish(),heading:z.string().nullish(),thumb:z.string().nullish()}).passthrough();
export const publicNodeSchema=z.object({id:z.string(),label:z.string().nullish(),kind:z.string().nullish(),color:z.string().nullish(),description:z.string().nullish(),position:point.nullish(),width:z.number().nullish(),height:z.number().nullish(),image_url:z.string().nullish(),url:z.string().nullish(),checklist_total:z.number().optional(),checklist_done:z.number().optional()}).passthrough();
export const annotationSchema=z.object({id:z.string(),kind:z.string(),x:z.number(),y:z.number(),width:z.number().nullish(),height:z.number().nullish(),z_index:z.number().nullish(),text:z.string().nullish(),style:style.nullish()}).passthrough();
export const mapSchema=z.object({map:z.object({id:z.string(),name:z.string(),viewport:z.object({x:z.number(),y:z.number(),zoom:z.number()}).nullish()}),nodes:z.array(publicNodeSchema),annotations:z.array(annotationSchema),edges:z.array(z.object({id:z.string(),source_id:z.string(),target_id:z.string(),source_kind:z.string(),target_kind:z.string(),style:z.string().nullish(),label:z.string().nullish()}))});
export type PublicNodeData=z.infer<typeof publicNodeSchema>;
export type AnnotationData=z.infer<typeof annotationSchema>;
export type PublicMap=z.infer<typeof mapSchema>;
