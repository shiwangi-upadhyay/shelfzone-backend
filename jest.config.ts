import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        isolatedModules: true,
      },
      diagnostics: false,
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '@prisma/client': '<rootDir>/tests/__mocks__/@prisma/client.ts',
  },
};

export default config;
