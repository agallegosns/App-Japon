declare const worker: { fetch(request: Request, env: Record<string, unknown>): Promise<Response> };
export default worker;
