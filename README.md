# VPM Intake Platform

A modern **Next.js + TypeScript** foundation for Visa Pass Migration's secure client intake experience.

## Project Goals

This repository establishes the initial structure for a professional intake platform with:

- Public landing/home page
- Intake workflow page
- Staff dashboard placeholder
- Shared top navigation
- Clear separation for future client/staff modules

> This phase intentionally excludes database, email, storage, and calendar integrations.

## Tech Stack

- Next.js (App Router)
- TypeScript
- React
- ESLint

## Folder Structure

```text
.
├── public/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── intake/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       └── Nav.tsx
├── .eslintrc.json
├── .gitignore
├── next.config.ts
├── next-env.d.ts
├── package.json
├── README.md
└── tsconfig.json
```

## Routes

- `/` — Home page for Visa Pass Migration
- `/intake` — Client intake placeholders:
  - client questionnaire
  - document uploads
  - estimated points calculator
  - consultation booking after approval
- `/dashboard` — Staff dashboard placeholder with internal review status section

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

## Recommended Next Steps

1. Add authentication and authorization for staff and clients.
2. Define form schemas and validation for the intake questionnaire.
3. Implement secure file upload flow and storage strategy.
4. Add data persistence and case lifecycle APIs.
5. Integrate notification and booking workflows after approval logic is defined.

## Security Notes (Planned)

Future iterations should include:

- Role-based access control
- Audit trails for case updates
- Encrypted document handling
- Input validation and abuse protection
- Operational logging and monitoring
