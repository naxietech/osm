/**
 * Services barrel. Mock, frontend-only data layer — each module owns an in-memory
 * store plus the functions the pages call. Import the specific service at call sites
 * (`@/services/exam.service`); this barrel exists so the folder follows the project's
 * "index.ts in every folder" rule and gives one place to see the layer's surface.
 */
export * from './academic.service';
export * from './api-client';
export * from './auth.service';
export * from './client.service';
export * from './exam-registration.service';
export * from './exam.service';
export * from './institute-category.service';
export * from './institute.service';
export * from './mock-store';
export * from './roles.service';
export * from './slo.service';
export * from './users.service';
