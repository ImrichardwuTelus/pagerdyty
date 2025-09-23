# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application bootstrapped with `create-next-app` that appears to be intended for PagerDuty service management and onboarding tracking. The project uses the App Router architecture with TypeScript and Tailwind CSS.

## Development Commands

- **Development server**: `npm run dev` (uses Turbopack for faster builds)
- **Production build**: `npm run build` (uses Turbopack)
- **Start production server**: `npm start`
- **Linting**: `npm run lint` (ESLint with Next.js rules)

The application runs on http://localhost:3000 by default.

## Architecture

### Framework & Tooling
- **Next.js 15** with App Router (`src/app/` directory structure)
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling with PostCSS
- **Turbopack** for faster development and builds
- **ESLint** with Next.js TypeScript configuration

### Project Structure
- `src/app/` - App Router pages and layouts
- `src/app/layout.tsx` - Root layout with Geist fonts
- `src/app/page.tsx` - Home page component
- `src/app/globals.css` - Global Tailwind styles
- `public/` - Static assets (SVG icons)

### Key Configuration
- TypeScript path mapping: `@/*` resolves to `./src/*`
- ESLint extends `next/core-web-vitals` and `next/typescript`
- Font optimization using `next/font/google` with Geist and Geist Mono

## PagerDuty Integration Context

Based on project discussions, this application is intended to:
- Display service onboarding metrics and progress tracking
- Show completion percentages for service data (team names, ownership, etc.)
- Provide a dashboard with filterable columns (CMDB ID, service name, prime manager)
- Allow users to confirm service ownership and technical service associations
- Enrich service data with tags and ownership information from Excel files
- Automate team name population from PagerDuty data

The goal is to achieve 100% completion of service data fields for better PagerDuty organization.