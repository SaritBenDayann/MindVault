import API from "./api";

export async function fetchVaultEntries() {
  const timestamp = Date.now();
  const { data } = await API.get(`/vault/vaults?t=${timestamp}`);
  return data;
}

export async function revealPassword(site, username) {
  const { data } = await API.post("/vault/reveal-password", { site, username });
  return data.password;
}

export async function savePassword(site, username, encryptedPassword) {
  const response = await API.post("/vault/save", {
    site,
    username,
    password: encryptedPassword,
  });
  return response.data;
}

export async function deleteVaultEntry(site, username) {
  const encodedSite = encodeURIComponent(site);
  const encodedUsername = encodeURIComponent(username);
  const { data } = await API.delete(`/vault/${encodedSite}/${encodedUsername}`);
  return data;
}

export async function checkPasswordBreach(password, site = 'manual_check', username = 'manual_check') {
  try {
    const response = await API.post('/breach/check-password', { password, site, username });
    return response.data;
  } catch (error) {
    console.error('Error checking password breach:', error);
    throw error.response?.data || { error: 'Failed to check password breach' };
  }
}

export async function getPasswordBreachData() {
  try {
    const response = await API.get('/breach/password-breach-data');
    return response.data;
  } catch (error) {
    console.error('Error getting password breach data:', error);
    throw error.response?.data || { error: 'Failed to get password breach data' };
  }
}

export async function checkVaultPasswords(vaultEntries) {
  try {
    const response = await API.post('/breach/check-vault-passwords', { vault_entries: vaultEntries });
    return response.data;
  } catch (error) {
    console.error('Error checking vault passwords:', error);
    throw error.response?.data || { error: 'Failed to check vault passwords' };
  }
}