import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge Tailwind classes safely — use this instead of template strings
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Format ISO date string to human-readable (e.g. "15 Jan 2026"). Empty input reads as an
// em-dash, so callers can hand it a missing date without guarding first.
export function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Truncate string to maxLength with ellipsis
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

// Generate initials from full name (e.g. "John Doe" → "JD")
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
