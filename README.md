# Fodan College LMS

Fodan College is a full-stack Learning Management System (LMS) built with modern web technologies, designed to provide a comprehensive, secure, and fast learning environment for students and staff.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (or SQLite for dev), managed with Prisma ORM
- **Styling**: Tailwind CSS v4, Radix UI primitives
- **Testing**: Vitest
- **File Storage**: AWS S3 compatible object storage
- **Authentication**: Custom session-based auth with Role-Based Access Control (RBAC)

## Core Features

- **Robust Role-Based Access**: Students, Mini-Admins, and Super-Admins with fine-grained permissions.
- **Admin Dashboard**: Comprehensive management of students, admins, classes, subjects, materials, and tasks.
- **Learning Materials**: Upload, organize, and distribute files securely through pre-signed URLs.
- **Examinations**: Support for importing DOCX question papers, structured exams, and auto-scoring.
- **Results & Analytics**: Detailed performance tracking across classes and subjects.
- **Access Code System**: Secure student activation via one-time access codes.
- **Forum**: Class-specific and global discussion forums with moderation tools.
- **Audit Logging**: Comprehensive tracking of sensitive administrative actions.

## Local Development Setup

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in the required values.
   ```bash
   cp .env.example .env
   ```
4. **Database Setup**:
   To set up a local SQLite database with seed data:
   ```bash
   npm run setup:dev
   ```
5. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

## Default Seed Accounts

The `npm run setup:dev` script will create the following accounts (password is `password123` for all):

- **Super Admin**: `admin@fodan.edu`
- **Mini Admin**: `staff@fodan.edu`
- **Student**: `student@fodan.edu` (Requires activation via an access code, or you can activate manually in the DB).

## Architecture & Security

- **Authentication**: We use a custom, session-based authentication system rather than NextAuth/Auth.js to maintain full control over session revocation, concurrent logins, and audit trails.
- **File Storage**: Uploads use short-lived presigned URLs for both upload and download, ensuring the application server isn't bottlenecked by file streams.
- **Guards & Permissions**: Access control is enforced at multiple layers:
  - `guardAuth()`: Requires an active session.
  - `guardStaff()`: Requires Mini-Admin or Super-Admin role.
  - `requirePermission()`: Checks for specific feature flags (e.g., `manage_students`, `manage_exams`).
  - Database queries are automatically scoped so staff only see data relevant to their assigned classes/subjects.

## Available Scripts

- `npm run dev`: Start the development server.
- `npm run build`: Build the production application.
- `npm run start`: Start the production server.
- `npm run typecheck`: Run TypeScript type checking.
- `npm run test`: Run Vitest tests.
- `npm run lint`: Run ESLint.
- `npm run db:studio`: Open Prisma Studio to explore the database.

## Deployment

1. Set up a PostgreSQL database.
2. Run `npm run db:use:postgres` to switch the Prisma schema to PostgreSQL.
3. Apply migrations: `npm run db:deploy`.
4. Build and start the Next.js app.
