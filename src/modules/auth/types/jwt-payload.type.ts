export type JwtPayload = {
  sub: string;
  tenantId: string;
  roles: string[];
};
