export const subAdminPositions = [
  "Developer",
  "WordPress",
  "WordPress Developer",
  "Graphic Designer",
  "UI/UX Designer",
  "Video Editor",
  "Content Writer",
  "Social Media Manager",
  "Project Manager",
] as const;

export type SubAdminPosition = (typeof subAdminPositions)[number];

export function isSubAdminPosition(value: string): value is SubAdminPosition {
  return subAdminPositions.includes(value as SubAdminPosition);
}
