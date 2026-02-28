export const jwtConfig = {
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
  accessExpiresIn: '24h' as const,
  refreshExpiresIn: '7d' as const,
};
