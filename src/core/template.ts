/**
 * Is the page template blank? "White" (pure white) and pages without a template count as blank,
 * so the sheet can be made right on the page. `null` means the device did not report the template.
 */
export function isBlankTemplate(name: string | null): boolean {
  if (name === null) {
    return false;
  }
  const base = name
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/\.(png|pdf|note)$/i, '');
  return base === '' || /^(style[_-]?)?(white|blank|empty|none)$/i.test(base);
}
