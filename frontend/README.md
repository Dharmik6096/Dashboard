# DevOps Monitor V2 Frontend

The frontend is a Next.js 16 application with public marketing, authentication, and protected observability surfaces. See the repository-level `README.md` for setup, configuration, security, billing, and verification instructions.

```bash
npm ci
npm run dev -- -p 3002
```

Production validation:

```bash
npm run lint
npx tsc --noEmit
npm run build
```
