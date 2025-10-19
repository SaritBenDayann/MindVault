import { decryptWithAES } from './CryptoUtils';
import { fetchVaultEntries, revealPassword } from '../services/vault';

export async function sha1HexUpper(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function fetchRange(prefix) {
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!res.ok) throw new Error(`HIBP range error: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const map = new Map();
  for (const line of lines) {
    const [suffix, countStr] = line.split(':');
    map.set(suffix.toUpperCase(), parseInt(countStr, 10));
  }
  return map;
}

export async function checkPasswordPwned(password) {
  const sha1 = await sha1HexUpper(password);
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const rangeMap = await fetchRange(prefix);
  const count = rangeMap.get(suffix) || 0;
  return { isBreached: count > 0, breachCount: count };
}

export async function checkPasswordsPwnedBatch(passwords, { delayMs = 0 } = {}) {
  const sha1s = await Promise.all(passwords.map(pw => sha1HexUpper(pw)));
  const grouped = new Map();
  sha1s.forEach((h, idx) => {
    const prefix = h.slice(0, 5);
    const suffix = h.slice(5);
    if (!grouped.has(prefix)) grouped.set(prefix, []);
    grouped.get(prefix).push({ idx, suffix });
  });

  const results = Array(passwords.length).fill(null);
  for (const [prefix, list] of grouped.entries()) {
    const rangeMap = await fetchRange(prefix);
    for (const { idx, suffix } of list) {
      const count = rangeMap.get(suffix) || 0;
      results[idx] = { isBreached: count > 0, breachCount: count };
    }
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }

  const total = results.length;
  const breached = results.filter(r => r && r.isBreached).length;
  const totalBreaches = results.reduce((sum, r) => sum + (r ? r.breachCount : 0), 0);
  return { results, stats: { total, breached, safe: total - breached, totalBreaches } };
}

export async function scanVaultPasswords(aesKey, { delayMsPerPrefix = 0 } = {}) {
  const entries = await fetchVaultEntries(); 

  const plaintexts = [];
  const indexToEntry = [];

  for (const entry of entries) {
    try {
      const enc = await revealPassword(entry.site, entry.username); 
      const pw = await decryptWithAES(enc, aesKey);
      plaintexts.push(pw);
      indexToEntry.push(entry);
    } catch (e) {
      plaintexts.push(null);
      indexToEntry.push(entry);
    }
  }

  const checkList = plaintexts.map((pw) => (typeof pw === 'string' ? pw : ''));
  const { results, stats } = await checkPasswordsPwnedBatch(checkList, { delayMs: delayMsPerPrefix });

  const detailed = indexToEntry.map((entry, idx) => {
    const r = results[idx];
    const decryptFailed = plaintexts[idx] === null;
    return {
      site: entry.site,
      username: entry.username,
      tag: entry.tag,
      decryptFailed,
      isBreached: decryptFailed ? false : !!(r && r.isBreached),
      breachCount: decryptFailed ? 0 : (r && r.breachCount) || 0,
    };
  });

  const byTag = {};
  for (const item of detailed) {
    const key = item.tag || 'other';
    if (!byTag[key]) byTag[key] = { total: 0, breached: 0 };
    byTag[key].total += 1;
    if (item.isBreached) byTag[key].breached += 1;
  }

  return { entries: detailed, stats, byTag };
}
