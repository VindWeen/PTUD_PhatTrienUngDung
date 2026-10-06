import fs from "node:fs";
const id = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const pgId = {
  type: "string",
  pattern: "^[0-9]+$",
  description: "pg BIGINT response",
};
const text = (max) => ({ type: "string", minLength: 1, maxLength: max });
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const ids = {
  type: "array",
  items: id,
  maxItems: 100,
  uniqueItems: true,
  default: [],
};
const schemas = {
  ApplicationInput: {
    ...object(
      {
        lecturerId: id,
        organizationUnitId: id,
        cycleId: id,
        targetAwardTypeId: id,
        purpose: { ...text(2000), minLength: 5 },
        achievementIds: ids,
        awardRecordIds: ids,
      },
      ["cycleId", "targetAwardTypeId", "purpose"],
    ),
    oneOf: [
      { required: ["lecturerId"], not: { required: ["organizationUnitId"] } },
      { required: ["organizationUnitId"], not: { required: ["lecturerId"] } },
    ],
  },
  CycleInput: object({
    code: text(50),
    name: text(255),
    startDate: { type: "string", format: "date" },
    endDate: { type: "string", format: "date" },
  }),
  SubmitInput: object({ version: id, reason: text(1000) }, ["version"]),
  ForwardInput: object({ version: id, reason: text(1000) }),
  Application: {
    type: "object",
    properties: {
      application_id: pgId,
      award_period_id: pgId,
      target_award_type_id: pgId,
      lecturer_id: { ...pgId, nullable: true },
      unit_id: { ...pgId, nullable: true },
      context_unit_id: pgId,
      created_by: pgId,
      purpose: { type: "string" },
      status: {
        type: "string",
        enum: [
          "DRAFT",
          "SUBMITTED",
          "COUNCIL_PENDING",
          "UNDER_REVIEW",
          "APPROVED",
          "REJECTED",
        ],
      },
      version: pgId,
      achievement_ids: { type: "array", items: pgId },
      award_record_ids: { type: "array", items: pgId },
    },
  },
  Cycle: {
    type: "object",
    properties: {
      award_period_id: pgId,
      code: text(50),
      name: text(255),
      start_date: { type: "string", format: "date" },
      end_date: { type: "string", format: "date" },
      status: {
        type: "string",
        enum: ["PLANNED", "OPEN", "IN_REVIEW", "COMPLETED", "CLOSED"],
      },
    },
  },
  FrozenInput: {
    type: "object",
    nullable: true,
    properties: {
      application_id: pgId,
      input_version: { type: "integer", enum: [1] },
      submitted_by: pgId,
      submitted_at: { type: "string", format: "date-time" },
      snapshot: {
        type: "object",
        properties: {
          schemaVersion: { type: "integer", enum: [1] },
          inputVersion: { type: "integer", enum: [1] },
          source: { type: "string", enum: ["SUPABASE_POSTGRESQL"] },
          cycle: { type: "object" },
          target: { type: "object" },
          purpose: { type: "string" },
          achievements: {
            type: "array",
            items: {
              type: "object",
              description:
                "record (id/version/status VERIFIED), submission (revision_no/snapshot_data), frozen files (id/version/hash)",
            },
          },
          awards: {
            type: "array",
            items: {
              type: "object",
              description:
                "record (id/version/status RECORDED), decision, versioned files",
            },
          },
          workflow: {
            type: "array",
            items: { type: "string", enum: ["UNIT", "COUNCIL"] },
          },
          criteriaEvaluation: {
            nullable: true,
            description: "Always null; no AI or eligibility evaluation",
          },
        },
      },
    },
  },
  History: {
    type: "object",
    properties: {
      history_id: pgId,
      application_id: pgId,
      from_status: { type: "string", nullable: true },
      to_status: { type: "string" },
      actor_id: pgId,
      reason: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
    },
  },
};
schemas.Detail = {
  allOf: [
    { $ref: "#/components/schemas/Application" },
    {
      type: "object",
      properties: {
        input: { $ref: "#/components/schemas/FrozenInput" },
        histories: {
          type: "array",
          items: { $ref: "#/components/schemas/History" },
        },
      },
    },
  ],
};
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const paths = {};
function op(path, method, summary, response, input, status = "200") {
  paths[path] ||= {};
  const operation = {
    summary,
    security: [{ bearerAuth: [] }],
    responses: {
      [status]: {
        description: "Success",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", enum: [true] },
                data: response,
              },
            },
          },
        },
      },
      400: {
        description: "Missing/invalid cycle, target, source status or revision",
      },
      401: { description: "Authentication required" },
      403: {
        description:
          "Active role/ownership/scope required; self-forward prohibited",
      },
      404: { description: "Resource missing" },
      409: { description: "Wrong state/version or duplicate cycle" },
    },
  };
  if (path.includes("{id}"))
    operation.parameters = [
      { name: "id", in: "path", required: true, schema: id },
    ];
  if (input)
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: ref(input) } },
    };
  paths[path][method] = operation;
}
op("/award-cycles", "get", "List cycles (authenticated)", {
  type: "array",
  items: ref("Cycle"),
});
op(
  "/award-cycles",
  "post",
  "RecordsOfficer opens cycle",
  ref("Cycle"),
  "CycleInput",
  "201",
);
op(
  "/award-applications",
  "post",
  "Owner/active representative creates DRAFT",
  ref("Application"),
  "ApplicationInput",
  "201",
);
op(
  "/award-applications",
  "get",
  "Own submissions or exact unit in Manager/RecordsOfficer scope",
  {
    type: "object",
    properties: {
      items: { type: "array", items: ref("Application") },
      page: { type: "integer" },
      pageSize: { type: "integer" },
    },
  },
);
paths["/award-applications"].get.parameters = [
  { name: "contextUnitId", in: "query", schema: id },
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
];
op(
  "/award-applications/{id}",
  "get",
  "Authorized detail with immutable input and history",
  ref("Detail"),
);
op(
  "/award-applications/{id}/submit",
  "post",
  "DRAFT → SUBMITTED; atomic input snapshot v1",
  ref("Application"),
  "SubmitInput",
);
op(
  "/award-applications/{id}/forward",
  "post",
  "Scoped Manager: SUBMITTED → COUNCIL_PENDING",
  ref("Application"),
  "ForwardInput",
);
const doc = {
  openapi: "3.0.3",
  info: {
    title: "W3-P3 Award Applications / Cycles",
    version: "1.0.0",
    description:
      "Supabase PostgreSQL via pg. Cycles reuse award_periods. See AWARD_APPLICATIONS_W3_P3.md; existing record/revoke/replacement contract remains W2_P2.openapi.json. Council adjudication is a draft extension, never creates AwardRecord.",
  },
  servers: [{ url: "/api/v1" }],
  paths,
  components: {
    schemas,
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};
fs.writeFileSync(
  new URL("../docs/api/W3_P3.openapi.json", import.meta.url),
  JSON.stringify(doc, null, 2) + "\n",
);
console.log("W3-P3 contract: 5 paths, 7 operations");
