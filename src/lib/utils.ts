import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (name: string | null | undefined): string => {
  if (!name) return 'U';
  const names = name.split(' ');
  if (names.length > 1 && names[0] && names[names.length - 1]) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  if (names.length > 0 && names[0] && names[0].length > 1) {
      return names[0].substring(0, 2).toUpperCase();
  }
  if (names.length > 0 && names[0] && names[0].length === 1) {
    return names[0][0].toUpperCase();
  }
  return 'U';
};
