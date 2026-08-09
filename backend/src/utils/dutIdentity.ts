const DUT_PREFIX_MAP: Record<string, { class_name: string; faculty_name: string }> = {};

/**
 * Resolve the DUT class/faculty metadata from the first 3 digits of student_id.
 * The map is intentionally centralized so it can be filled with the real DUT
 * prefix table without touching auth code.
 */
export function resolveDutIdentity(studentId: string): { class_name: string | null; faculty_name: string | null } {
  const prefix = studentId.slice(0, 3);
  const known = DUT_PREFIX_MAP[prefix];

  if (known) {
    return known;
  }

  return {
    class_name: `DUT-${prefix}`,
    faculty_name: `DUT-${prefix}`,
  };
}