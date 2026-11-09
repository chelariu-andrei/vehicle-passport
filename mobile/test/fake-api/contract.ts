/* Reads contracts/openapi.yaml and exposes its routes plus compiled JSON-schema validators. */
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

type Json = Record<string, any>;

export const HTTP_METHODS = ['get', 'put', 'post', 'patch', 'delete'] as const;

export interface ParamSpec {
  name: string;
  in: 'path' | 'query';
  schema: Json;
}

export interface Operation {
  operationId: string;
  method: string;
  template: string;
  pattern: RegExp;
  pathParams: ParamSpec[];
  queryParams: ParamSpec[];
  /** False for operations declared with `security: []` (the public routes). */
  authenticated: boolean;
  requestBody: { required: boolean; contentTypes: string[]; schema: Json | undefined } | null;
  responses: Record<string, Json>;
}

const doc: Json = parse(readFileSync(resolve(__dirname, '../../../contracts/openapi.yaml'), 'utf8'));

const ajv = new Ajv2020({ strict: false, allErrors: true, multipleOfPrecision: 6 });
addFormats(ajv);
ajv.addFormat('binary', true);
ajv.addSchema({ $id: 'contract', components: { schemas: doc.components.schemas } });

/** Points `#/components/...` references at the registered contract document. */
function rebase(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rebase);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [
        k,
        k === '$ref' && typeof v === 'string' && v.startsWith('#/') ? `contract${v}` : rebase(v),
      ]),
    );
  }
  return node;
}

function deref(node: Json): Json {
  if (node && typeof node.$ref === 'string') {
    return node.$ref
      .slice(2)
      .split('/')
      .reduce((acc: Json, key: string) => acc[key], doc);
  }
  return node;
}

const validators = new Map<string, ValidateFunction>();

export function validatorFor(schema: Json): ValidateFunction {
  const key = JSON.stringify(schema);
  let validate = validators.get(key);
  if (!validate) {
    validate = ajv.compile(rebase(schema) as object);
    validators.set(key, validate);
  }
  return validate;
}

export function schemaErrors(validate: ValidateFunction): string {
  return ajv.errorsText(validate.errors, { dataVar: 'body' });
}

function toPattern(template: string): RegExp {
  const source = template
    .split(/(\{[^}]+\})/)
    .map((part) => (part.startsWith('{') ? '([^/]+)' : part.replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${source}$`);
}

function paramSpecs(list: Json[] | undefined): ParamSpec[] {
  return (list ?? []).map((p) => {
    const spec = deref(p);
    return { name: spec.name, in: spec.in, schema: spec.schema };
  });
}

function buildOperations(): Operation[] {
  const out: Operation[] = [];
  for (const [template, item] of Object.entries<Json>(doc.paths)) {
    for (const method of HTTP_METHODS) {
      const op: Json | undefined = item[method];
      if (!op) continue;
      const params = [...paramSpecs(item.parameters), ...paramSpecs(op.parameters)];
      const body = op.requestBody;
      const content: Json = body?.content ?? {};
      out.push({
        operationId: op.operationId,
        method: method.toUpperCase(),
        template,
        pattern: toPattern(template),
        pathParams: [...template.matchAll(/\{([^}]+)\}/g)].map(
          (m) => params.find((p) => p.in === 'path' && p.name === m[1])!,
        ),
        queryParams: params.filter((p) => p.in === 'query'),
        authenticated: !(Array.isArray(op.security) && op.security.length === 0),
        requestBody: body
          ? {
              required: body.required === true,
              contentTypes: Object.keys(content),
              schema: content['application/json']?.schema,
            }
          : null,
        responses: op.responses ?? {},
      });
    }
  }
  return out;
}

export const operations: Operation[] = buildOperations();

export function findOperation(method: string, pathname: string): { op: Operation; params: Record<string, string> } | null {
  for (const op of operations) {
    if (op.method !== method) continue;
    const match = op.pattern.exec(pathname);
    if (!match) continue;
    const params: Record<string, string> = {};
    op.pathParams.forEach((p, i) => {
      params[p.name] = decodeURIComponent(match[i + 1]);
    });
    return { op, params };
  }
  return null;
}

/** The JSON schema a response of `status` is documented to carry, if any. */
export function responseSchema(op: Operation, status: number): Json | undefined {
  const response = op.responses[String(status)];
  if (!response) return undefined;
  return deref(response).content?.['application/json']?.schema;
}

export function documentsStatus(op: Operation, status: number): boolean {
  return String(status) in op.responses;
}
