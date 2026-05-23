export function normalizePhoneInput(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let compact = raw.replace(/[()\s.-]/g, '');
  if (compact.startsWith('00')) {
    compact = `+${compact.slice(2)}`;
  }

  const digits = compact.replace(/\D/g, '');
  if (compact.startsWith('+')) {
    compact = `+${digits}`;
  } else if (digits.startsWith('252')) {
    compact = `+${digits}`;
  } else if (digits.startsWith('0')) {
    compact = `+252${digits.slice(1)}`;
  } else if (/^[67]\d{7,8}$/.test(digits)) {
    compact = `+252${digits}`;
  } else {
    compact = `+${digits}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : '';
}

export function normalizeUsernameInput(value: string) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

export function usernameError(username: string) {
  if (!username) return 'Username waa waajib';
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return 'Username-ku waa inuu ahaadaa 3-30 xaraf: a-z, 0-9 ama _.';
  }
  return '';
}
