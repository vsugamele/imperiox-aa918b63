import { describe, expect, it } from "vitest";
import { typebotToBlueprint } from "@/lib/typebot-parser";

describe("Typebot import boundaries", () => {
  it("preserves order, start edge, block routing and original unknown block payload", () => {
    const block = { id: "b1", type: "text", content: { richText: [{ children: [{ text: "Hello" }] }] }, extra: { retained: true } };
    const unknown = { id: "b2", type: "custom block", options: { original: [1, 2] } };
    const result = typebotToBlueprint({
      name: "Original", groups: [
        { id: "g1", title: "First", graphCoordinates: { x: -100, y: 25 }, blocks: [block, unknown] },
        { id: "g2", title: "Second", blocks: [] },
      ],
      events: [{ id: "start", type: "start", outgoingEdgeId: "e1" }],
      edges: [{ id: "e1", from: { eventId: "start" }, to: { groupId: "g1" } }, { id: "e2", from: { blockId: "b1" }, to: { groupId: "g2" } }],
      variables: [{ id: "v1", name: "name", defaultValue: "Jane" }],
    });
    expect(result.nodes.map(node => node.id)).toEqual(["g1", "g2"]);
    expect(result.nodes[0]).toMatchObject({ x: 1400, y: 825 });
    expect(result.nodes[0].blocks[0]).toMatchObject({ text: "Hello" });
    expect(result.nodes[0].blocks[0].raw).toBe(block);
    expect(result.nodes[0].blocks[1]).toMatchObject({ type: "unknown", raw: unknown });
    expect(result.start_node_id).toBe("g1");
    expect(result.edges[1]).toMatchObject({ from: "g1", to: "g2", from_block: "b1" });
    expect(result.variables[0].default).toBe("Jane");
  });

  it("accepts omitted optional collections and optional block fields", () => {
    expect(typebotToBlueprint({ groups: [{ id: "group", blocks: [{ id: "b", type: "image" }] }] }).nodes[0].blocks[0].image_url).toBeUndefined();
    expect(typebotToBlueprint({})).toMatchObject({ nodes: [], edges: [], variables: [] });
  });

  it.each([null, [], { groups: {} }, { groups: [null] }, { groups: [{ blocks: [] }] }])("rejects malformed structure without guessing a graph", value => {
    expect(() => typebotToBlueprint(value)).toThrow(/Typebot/);
  });
});
