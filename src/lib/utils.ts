import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a niche + city pair into a consistent cache key.
 * - Lowercases everything
 * - Strips punctuation (commas, periods, etc.)
 * - Collapses multiple spaces
 * - Extracts just the city name (before the first comma) to avoid
 *   "Seattle, WA, USA" vs "Seattle, Washington" mismatches
 */
export function normalizeQueryKey(niche: string, city: string): string {
  const cleanNiche = niche
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // remove punctuation
    .replace(/\s+/g, ' ');    // collapse spaces

  const cleanCity = city
    .toLowerCase()
    .trim()
    .split(',')[0]            // take only city name before first comma
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

  return `${cleanNiche} in ${cleanCity}`;
}
