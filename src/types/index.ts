import { Request } from 'express';

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
}

export interface UserAttributes {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  isAdmin: boolean;
  senha?: string;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  page: number;
}

export interface ProductQueryResult {
  total: number;
}