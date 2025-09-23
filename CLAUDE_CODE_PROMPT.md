# PagerDuty Service Management Dashboard - Claude Code Implementation Guide

## Project Overview
Build a comprehensive PagerDuty service management dashboard that enables organizations to track service onboarding progress, manage team assignments, and enrich service data with ownership information. The goal is to achieve 100% completion of service data fields for better PagerDuty organization and management.

## Business Requirements from Management Discussion

### Core Objectives
1. **Service Onboarding Tracking**: Monitor the percentage of services that have been properly onboarded to PagerDuty
2. **Data Enrichment**: Populate missing fields like team names, ownership, and technical service associations
3. **Progress Monitoring**: Track completion percentages for critical fields to reach 100% data quality
4. **Ownership Confirmation**: Allow prime managers to select and confirm their services and associated technical services
5. **Automated Data Population**: Reduce manual input by leveraging existing PagerDuty data and Excel imports

### Key Features Required

#### 1. Summary Dashboard (Landing Page)
- **Progress Metrics Display**: Show percentage of onboarded services, services with defined team names, and confirmed services
- **Summary Excel Sheet View**: Display columns for:
  - CMDB ID
  - Service Name (service_name_mp)
  - Prime Manager
  - Prime Director
  - Prime VP
  - Team Name
  - API Name
  - Onboarding Status in PagerDuty
  - Completion Percentage
- **Filterable Columns**: Enable filtering by CMDB ID, service name, prime manager, prime director, prime VP, API name, and team name
- **Progress Indicators**: Visual completion tracking for each service and overall statistics

#### 2. Service Management Actions
- **Edit Service**: Redirect to dedicated service editor page (`/service-editor/[serviceName]`)
- **Team Assignment**: Allow selection of PagerDuty teams instead of manual entry
- **Ownership Updates**: Enable prime managers to update ownership and technical service configurations
- **Service Confirmation**: Process for users to confirm service ownership and team assignments

#### 3. Data Integration & APIs
- **PagerDuty API Integration**:
  - Fetch service data including service ID and owned team
  - Retrieve team information to populate dropdowns
  - Update service configurations and team assignments
  - Sync ownership and technical service associations
- **Excel File Processing**: Import and process Excel files containing service data
- **Automated Population**: Auto-populate team names and other fields based on existing PagerDuty data

#### 4. UI/UX Requirements
- **Apple-Style Design**: Clean, modern interface with glassmorphism effects, rounded corners, and subtle shadows
- **Responsive Layout**: Support for desktop and mobile viewing
- **Scroll on Load**: Implement automatic scrolling for large datasets
- **Progress Visualization**: Individual service progress cards separate from main data table
- **Enterprise-Grade Appearance**: Professional styling suitable for corporate environments

## Technical Implementation Details

### Current Architecture
- **Framework**: Next.js 15 with App Router and TypeScript
- **Styling**: Tailwind CSS 4 with Apple-inspired design system
- **State Management**: React hooks with custom `useExcelData` hook
- **File Processing**: xlsx library for Excel file handling
- **API Integration**: Mock PagerDuty API endpoints (to be replaced with actual API calls)

### Key Components
1. **ServiceManagementDashboard** (`src/components/ServiceManagementDashboard.tsx`)
   - Main dashboard with data table, filters, and progress tracking
   - No inline editing - all edits through dedicated pages
   - Separate progress tracking container with individual service cards

2. **Service Editor** (`src/app/service-editor/[serviceName]/page.tsx`)
   - Dedicated page for editing individual services
   - PagerDuty team selection dropdown
   - Service information management
   - API integration for service updates

3. **Excel Data Hook** (`src/hooks/useExcelData.ts`)
   - Data loading from Excel files
   - CRUD operations for service data
   - Progress calculation and validation

### API Endpoints to Implement

#### PagerDuty Service API
```typescript
// GET /api/pagerduty/services/[serviceId]
// Fetch individual service data
{
  id: string;
  name: string;
  teams: PagerDutyTeam[];
  html_url: string;
  status: string;
}

// PUT /api/pagerduty/services/[serviceId]
// Update service configuration
{
  serviceId: string;
  teamId: string;
  ownerId?: string;
  // Additional fields as needed
}
```

#### PagerDuty Teams API
```typescript
// GET /api/pagerduty/teams
// Fetch available teams for selection
{
  teams: PagerDutyTeam[];
}

interface PagerDutyTeam {
  id: string;
  name: string;
  summary: string;
}
```

#### Service Management API
```typescript
// POST /api/services/confirm
// Confirm service ownership and team assignment
{
  serviceId: string;
  primeManager: string;
  teamId: string;
  confirmed: boolean;
}

// GET /api/services/progress
// Get overall progress metrics
{
  totalServices: number;
  onboardedServices: number;
  servicesWithTeams: number;
  confirmedServices: number;
  completionPercentage: number;
}
```

### Data Model
```typescript
interface ExcelServiceRow {
  id: string;
  service_name_mp: string;        // Primary service identifier
  service_path: string;
  cmdb_id: string;               // CMDB identifier
  api_name: string;              // API service name
  prime_manager: string;         // Primary manager
  prime_director: string;        // Director level
  prime_vp: string;             // VP level
  mse: string;
  dyna_service_name: string;
  next_hop_process_group: string;
  analysis_status: string;
  next_hop_service_code: string;
  enrichment_status: string;
  team_name: string;            // PagerDuty team assignment
  confirmed: string;            // Confirmation status
  owned_team: string;           // Team ownership
  service_id: string;           // PagerDuty service ID
  completion: number;           // Percentage of completed fields
  lastUpdated: string;
}
```

## Implementation Steps

### Phase 1: Core Dashboard Enhancement
1. **Enhanced Progress Tracking**
   - Implement comprehensive metrics display
   - Add overall completion percentage calculations
   - Create visual progress indicators for different categories

2. **Advanced Filtering**
   - Ensure all required filter columns are working
   - Add search functionality across multiple fields
   - Implement filter state persistence

3. **Data Loading Optimization**
   - Implement scroll on load for large datasets
   - Add virtual scrolling if needed for performance
   - Loading states and error handling

### Phase 2: PagerDuty API Integration
1. **Service Data Fetching**
   - Replace mock data with actual PagerDuty API calls
   - Implement authentication and error handling
   - Cache management for API responses

2. **Team Management**
   - Fetch and display available PagerDuty teams
   - Implement team assignment functionality
   - Sync team data with Excel import

3. **Service Updates**
   - Enable service configuration updates through API
   - Implement confirmation workflows
   - Track and display update status

### Phase 3: Workflow Enhancement
1. **Prime Manager Workflow**
   - Service selection interface for prime managers
   - Technical service association confirmation
   - Ownership validation and updates

2. **Automated Data Population**
   - Auto-populate team names from PagerDuty data
   - Intelligent field completion based on existing data
   - Bulk update capabilities

3. **Reporting and Analytics**
   - Summary reports with completion metrics
   - Export capabilities for management reporting
   - Progress tracking over time

## Design Guidelines

### Visual Style (Apple-Inspired)
- **Colors**: Clean whites, subtle grays (#f8f9fa, #e9ecef), accent blues (#007AFF)
- **Typography**: System fonts, clear hierarchy, readable sizes
- **Components**: Rounded corners (12-16px), subtle shadows, glassmorphism effects
- **Interactions**: Smooth transitions, hover states, focus indicators
- **Layout**: Generous whitespace, card-based design, responsive grid

### User Experience
- **Progressive Disclosure**: Show essential information first, details on demand
- **Clear Actions**: Obvious buttons and interactive elements
- **Feedback**: Loading states, success/error messages, progress indicators
- **Accessibility**: Keyboard navigation, screen reader support, sufficient color contrast

## Success Criteria
1. **Data Quality**: Achieve 100% completion of service data fields
2. **User Adoption**: Prime managers actively use the system to confirm services
3. **Process Efficiency**: Reduce manual data entry through automation
4. **Data Accuracy**: Ensure technical service associations are correct
5. **Management Visibility**: Provide clear progress metrics and reporting

## Current Status
- ✅ Basic dashboard with Excel file import
- ✅ Apple-style UI implementation
- ✅ Service editor page framework
- ✅ Progress tracking separation
- ✅ Filtering and pagination
- 🔄 PagerDuty API integration (mock implementation ready)
- 📋 Prime manager workflows (to be implemented)
- 📋 Automated data population (to be implemented)

## Next Steps
1. Implement actual PagerDuty API integration
2. Build prime manager service selection workflow
3. Add automated team name population
4. Enhance progress reporting and analytics
5. Implement service confirmation workflows

---

This dashboard serves as a critical tool for achieving complete service onboarding and data quality in PagerDuty, enabling better incident management and organizational visibility.