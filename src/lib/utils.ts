import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** className 合并（clsx + tailwind-merge）：条件类 + Tailwind 冲突去重。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
