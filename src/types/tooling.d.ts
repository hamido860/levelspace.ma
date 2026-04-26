declare module "@vercel/node" {
  export interface VercelRequest {
    method?: string;
    body?: any;
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
  }

  export interface VercelResponse {
    status(code: number): VercelResponse;
    json(body: any): VercelResponse;
    send(body: any): VercelResponse;
  }
}

declare module "vitest" {
  export const describe: any;
  export const it: any;
  export const expect: any;
  export const beforeEach: any;
  export const afterEach: any;
  export const vi: any;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
