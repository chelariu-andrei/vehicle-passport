/* In-memory API behind globalThis.fetch. Every request is checked against contracts/openapi.yaml. */
import { documentsStatus, findOperation, responseSchema, schemaErrors, validatorFor } from './contract';
import type { Operation } from './contract';
import { handlers, problem } from './handlers';
import type { Ctx, FakeState, Reply, UploadForm } from './handlers';

export * from './builders';
export type { FakeState } from './handlers';
export { operations } from './contract';
export { handlers } from './handlers';

export interface RecordedPart {
  field: string;
  name: string;
  type: string;
  size: number;
}

export interface RecordedCall {
  path: string;
  headers: Record<string, string>;
  body: unknown;
  parts: RecordedPart[];
}

export interface FakeApi {
  state: FakeState;
  /** The next call to `operationId` answers `status` with problem+json carrying `code`; null code means an empty body. */
  failNext(operationId: string, status: number, code: string | null): void;
  /** Requests bearing this token answer 401 with an empty body. */
  expireToken(token: string): void;
  callsTo(operationId: string): RecordedCall[];
  /** Requests the fake refused because the app broke the contract. `setup.ts` fails any test that leaves one behind. */
  violations: string[];
}

/** Read by `test/setup.ts` without importing this module, so tests that never install the fake pay nothing. */
export interface InstalledFake {
  violations: string[];
  uninstall(): void;
}
const INSTALLED = '__vehiclePassportFakeApi';

const empty = (status: number) => new Response(null, { status });

function toResponse(reply: Reply): Response {
  if (reply.bytes) {
    return new Response(reply.bytes as BodyInit, { status: reply.status, headers: { 'content-type': reply.contentType ?? 'application/octet-stream' } });
  }
  if (reply.body === undefined) return empty(reply.status);
  return new Response(JSON.stringify(reply.body), {
    status: reply.status,
    headers: { 'content-type': reply.contentType ?? 'application/json' },
  });
}

export function installFakeApi(): FakeApi {
  const previousFetch = globalThis.fetch;
  const state: FakeState = {
    vehicles: [],
    events: {},
    claims: {},
    otherOwnerVins: new Set(),
    scans: {},
    passports: [],
  };
  const scanVins = new Map<string, string>();
  const violations: string[] = [];
  const expired = new Set<string>();
  const failures = new Map<string, { status: number; code: string | null }[]>();
  const calls = new Map<string, RecordedCall[]>();

  const violate = (message: string) => violations.push(message);

  function refuseShape(op: Operation, what: string): Reply {
    violate(`${op.operationId}: ${what}`);
    return problem(400, 'validation-failed');
  }

  async function dispatch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = findOperation(request.method.toUpperCase(), url.pathname);
    if (!route) {
      violate(`no route for ${request.method} ${url.pathname}`);
      return toResponse(problem(404, 'not-found'));
    }
    const { op, params } = route;
    const handler = handlers[op.operationId];
    if (!handler) {
      violate(`${op.operationId}: the fake has no handler`);
      return toResponse(problem(404, 'not-found'));
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const contentType = headers['content-type'] ?? '';
    const record: RecordedCall = { path: url.pathname + url.search, headers, body: undefined, parts: [] };
    if (!calls.has(op.operationId)) calls.set(op.operationId, []);
    calls.get(op.operationId)!.push(record);

    let form: UploadForm | null = null;
    let rawBody = '';
    if (contentType.startsWith('multipart/form-data')) {
      const parsed = (await request.clone().formData()) as unknown as UploadForm & {
        forEach(cb: (value: any, field: string) => void): void;
      };
      form = parsed;
      parsed.forEach((value, field) => {
        if (typeof value === 'string') record.parts.push({ field, name: '', type: '', size: value.length });
        else record.parts.push({ field, name: (value as File).name ?? '', type: value.type, size: value.size });
      });
    } else {
      rawBody = await request.clone().text();
      if (rawBody !== '') {
        try {
          record.body = JSON.parse(rawBody);
        } catch {
          record.body = rawBody;
        }
      }
    }

    const bearer = /^Bearer (.+)$/.exec(headers.authorization ?? '');
    if (op.authenticated && (!bearer || expired.has(bearer[1]))) return empty(401);

    const queued = failures.get(op.operationId)?.shift();
    if (queued) return toResponse(queued.code === null ? { status: queued.status } : problem(queued.status, queued.code));

    for (const spec of op.pathParams) {
      const check = validatorFor(spec.schema);
      if (!check(params[spec.name])) return toResponse(refuseShape(op, `path ${spec.name}: ${schemaErrors(check)}`));
    }

    if (op.requestBody && form === null) {
      if (rawBody === '') {
        if (op.requestBody.required) return toResponse(refuseShape(op, 'empty body'));
      } else if (op.requestBody.schema) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return toResponse(refuseShape(op, 'malformed JSON'));
        }
        const check = validatorFor(op.requestBody.schema);
        if (parsed === null || !check(parsed)) return toResponse(refuseShape(op, schemaErrors(check)));
      }
    }

    const ctx: Ctx = { state, scanVins, params, query: url.searchParams, body: record.body, form };
    const reply = await handler(ctx);

    if (!documentsStatus(op, reply.status)) violate(`${op.operationId}: answered undocumented status ${reply.status}`);
    const schema = reply.contentType === undefined || reply.contentType === 'application/json' ? responseSchema(op, reply.status) : undefined;
    if (schema && reply.body !== undefined) {
      const check = validatorFor(schema);
      if (!check(reply.body)) violate(`${op.operationId}: response ${reply.status} breaks the contract: ${schemaErrors(check)}`);
    }
    return toResponse(reply);
  }

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    dispatch(input instanceof Request && init === undefined ? input : new Request(input, init))) as typeof fetch;

  const installed: InstalledFake = {
    violations,
    uninstall() {
      globalThis.fetch = previousFetch;
      delete (globalThis as Record<string, unknown>)[INSTALLED];
    },
  };
  (globalThis as Record<string, unknown>)[INSTALLED] = installed;

  return {
    state,
    violations,
    failNext(operationId, status, code) {
      failures.set(operationId, [...(failures.get(operationId) ?? []), { status, code }]);
    },
    expireToken(token) {
      expired.add(token);
    },
    callsTo(operationId) {
      return calls.get(operationId) ?? [];
    },
  };
}
