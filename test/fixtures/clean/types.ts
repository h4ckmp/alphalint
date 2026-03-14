/**
 * Clean type definitions — no lint issues expected
 */

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function createUser(name: string, email: string): User {
  return {
    id: crypto.randomUUID(),
    name,
    email,
    createdAt: new Date(),
  };
}

function wrapResponse<T>(data: T, status: number): ApiResponse<T> {
  return { data, status, message: 'ok' };
}

export { createUser, wrapResponse };
export type { User, ApiResponse, Result };
