# MICEVA Children Connect

MICEVA Children Connect is a private management system for the Children's Department of Eglise MICEVA de Puits-Sales, Haiti. It replaces a paper register with a secure, responsive web application for authorized department members.

The application is designed for internal administration. It is not a public registration site, school-management platform, parent portal, or payment system.

## What it provides

- Secure sign-in with protected application routes
- A dashboard with child, profile-completeness, committee, and activity summaries
- Searchable child records with profile details and guardian contact information
- Create, edit, and review child profiles
- Profile-completeness checks that highlight missing important information
- Clickable phone numbers for calling a guardian from a mobile device
- Children's Department committee and administration records
- Calendar events and recurring activities
- Reports and application settings
- Responsive navigation for desktop and mobile screens

## Technology

- React 19 and TypeScript
- TanStack Start and TanStack Router
- Vite
- Tailwind CSS
- Supabase Auth and PostgreSQL
- React Query for server data and cache management
- Zod and React Hook Form for form validation
- Radix UI and Lucide React for accessible interface components

## Requirements

- Node.js 22 or later
- Bun (recommended) or a compatible npm workflow
- A Supabase project with the required database migrations applied

## Getting started

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create a local `.env` file in the project root. It must contain:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

   The application also accepts `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for server-side rendering.

3. Apply the SQL files in `supabase/migrations/` to the Supabase project. Use the Supabase CLI or the SQL editor in the Supabase dashboard.

4. Start the development server:

   ```bash
   bun run dev
   ```

   Vite will print the local URL in the terminal.

## Available scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Vite development server |
| `bun run build` | Create a production build |
| `bun run build:dev` | Create a development-mode build |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format the project with Prettier |

## Supabase and security

Supabase is the system of record. The browser uses the publishable key and authenticated sessions; private keys must never be added to client code or committed to Git.

- Keep `.env` local and out of version control.
- Configure authentication users and permissions in Supabase.
- Keep Row Level Security enabled for application tables.
- Apply and review database policies whenever the schema changes.
- Never document or share user passwords in this repository.
- The login route is public, but application routes require an authenticated session.

The current project ID is stored in `supabase/config.toml`. Update it if the project is connected to a different Supabase instance.

## Project structure

```text
src/
  components/       Shared application and UI components
  integrations/     Supabase client, auth helpers, and generated types
  lib/              Queries, child utilities, recurrence, and auth logic
  routes/            TanStack file-based routes
supabase/
  migrations/       Database schema and policy migrations
public/              Static public assets
```

The main authenticated areas are Dashboard, Children, Administration, Calendar, Activities, Reports, and Settings. The sign-in page is defined at the root route.

## Development notes

This project uses TanStack file-based routing. When adding or renaming route files, regenerate `src/routeTree.gen.ts` using the repository's normal TanStack/Vite workflow.

Before opening a pull request, run:

```bash
bun run lint
bun run build
```

Do not commit `.env`, Supabase secret keys, passwords, or exported production data.

## License and access

This repository contains software for the internal administration of the MICEVA Children's Department. Access to the deployed application and its data should remain restricted to authorized department members.