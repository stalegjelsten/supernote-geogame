/**
 * Er sidemalen blank? «White» (helt hvit) og sider uten mal regnes som blanke,
 * så arket kan lages rett på siden. `null` betyr at enheten ikke oppga malen.
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
