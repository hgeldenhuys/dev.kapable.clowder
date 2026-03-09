import { describe, test, expect } from "bun:test";
import { parseDataModel } from "../builder.server";

describe("parseDataModel", () => {
  test("parses valid JSON data model from ```json:data_model``` block", () => {
    const spec = `Some intro text
\`\`\`json:data_model
[{"name":"users","columns":[{"name":"email","type":"text","required":true}]}]
\`\`\`
Some outro text`;
    const tables = parseDataModel(spec);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns).toHaveLength(1);
    expect(tables[0].columns[0].name).toBe("email");
    expect(tables[0].columns[0].type).toBe("text");
  });

  test("parses from plain ```json``` block as fallback", () => {
    const spec = `Here is the model:
\`\`\`json
[{"name":"recipes","columns":[{"name":"title","type":"text"},{"name":"prep_time","type":"integer"}]}]
\`\`\``;
    const tables = parseDataModel(spec);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("recipes");
    expect(tables[0].columns).toHaveLength(2);
  });

  test("returns empty array for malformed JSON", () => {
    const spec = '```json\n{not valid json}\n```';
    expect(parseDataModel(spec)).toEqual([]);
  });

  test("returns empty array when no code block found", () => {
    expect(parseDataModel("just plain text")).toEqual([]);
    expect(parseDataModel("")).toEqual([]);
  });

  test("filters out invalid column types", () => {
    const spec = `\`\`\`json
[{"name":"items","columns":[
  {"name":"title","type":"text"},
  {"name":"bad_col","type":"bigserial"},
  {"name":"active","type":"boolean"}
]}]
\`\`\``;
    const tables = parseDataModel(spec);
    expect(tables).toHaveLength(1);
    // bigserial is not in VALID_TYPES, should be filtered
    expect(tables[0].columns).toHaveLength(2);
    expect(tables[0].columns.map((c) => c.name)).toEqual(["title", "active"]);
  });

  test("filters out tables with no valid columns", () => {
    const spec = `\`\`\`json
[
  {"name":"good","columns":[{"name":"x","type":"text"}]},
  {"name":"empty","columns":[{"name":"y","type":"unknowntype"}]}
]
\`\`\``;
    const tables = parseDataModel(spec);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("good");
  });

  test("normalizes table names to lowercase with underscores", () => {
    const spec = `\`\`\`json
[{"name":"My Table-Name!","columns":[{"name":"x","type":"text"}]}]
\`\`\``;
    const tables = parseDataModel(spec);
    expect(tables[0].name).toBe("my_table_name_");
  });

  test("handles nested object with array key (e.g. { tables: [...] })", () => {
    const spec = `\`\`\`json
{"tables":[{"name":"events","columns":[{"name":"title","type":"text"}]}]}
\`\`\``;
    const tables = parseDataModel(spec);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("events");
  });

  test("handles multiple tables", () => {
    const spec = `\`\`\`json:data_model
[
  {"name":"users","columns":[{"name":"email","type":"text","required":true},{"name":"name","type":"text"}]},
  {"name":"posts","columns":[{"name":"title","type":"text"},{"name":"body","type":"text"},{"name":"published","type":"boolean"}]},
  {"name":"comments","columns":[{"name":"body","type":"text"},{"name":"author_id","type":"uuid"}]}
]
\`\`\``;
    const tables = parseDataModel(spec);
    expect(tables).toHaveLength(3);
    expect(tables.map((t) => t.name)).toEqual(["users", "posts", "comments"]);
    expect(tables[0].columns).toHaveLength(2);
    expect(tables[1].columns).toHaveLength(3);
    expect(tables[2].columns).toHaveLength(2);
  });

  test("supports all valid column types", () => {
    const validTypes = ["text", "integer", "boolean", "timestamp", "json", "uuid", "vector"];
    const columns = validTypes.map((t, i) => ({ name: `col_${i}`, type: t }));
    const spec = `\`\`\`json\n[{"name":"all_types","columns":${JSON.stringify(columns)}}]\n\`\`\``;
    const tables = parseDataModel(spec);
    expect(tables[0].columns).toHaveLength(validTypes.length);
  });
});
