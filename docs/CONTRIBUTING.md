# Contributing to ShelfZone Backend

## Commit Format

```
[TASK-ID] type(scope): description
```

Types: feat, fix, chore, docs, test, refactor, perf
Examples:
- `[L0.1] chore(api): initialize fastify server`
- `[3.21] feat(payroll): add salary calculator`

## Branch Naming

```
feature/<descriptive-name>
```

Examples: `feature/hr-employee-crud`, `feature/agent-registry`

## Code Standards

- TypeScript strict mode — no `any` types
- All API inputs validated with Zod
- All new endpoints need unit + integration tests
- ESLint and Prettier must pass before commit
