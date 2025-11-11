# Database Setup (Team Fitness)

This guide captures the steps you just ran so you can repeat them quickly.

## 1) Environment

Create `.env` in the project root (already present). Example:

```
DATABASE_URL="postgresql://admin:admin@localhost:5432/fitness?schema=public"
```

Note: `prisma.config.ts` loads environment variables via `import "dotenv/config"` so Prisma can read `DATABASE_URL`.

## 2) Start Postgres (Docker)

```
zsh
npm run db:up
```

Stop the DB:

```
zsh
npm run db:down
```

## 3) Prisma (validate, migrate, generate)

```
zsh
npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
```

## 4) Seed the database

```
zsh
npm run db:seed
```

This creates a sample Gym with one Admin and one Member.

## 5) Run the API

```
zsh
npm start
```

Health check:

```
zsh
curl http://localhost:3000/health
```

## 6) Useful endpoints

- GET http://localhost:3000/gyms
- POST http://localhost:3000/gyms
- POST http://localhost:3000/admins
- POST http://localhost:3000/members

## Troubleshooting

- If Prisma says `Missing required environment variable: DATABASE_URL`, ensure `.env` exists and the value matches your DB.
- If the server can’t connect to DB, verify Docker is running and `npm run db:up` succeeded.
- Use Prisma Studio to inspect data:

```
zsh
npm run prisma:studio
```
