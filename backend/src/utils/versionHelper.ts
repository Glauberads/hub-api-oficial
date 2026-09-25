import axios, { AxiosRequestConfig } from 'axios';

interface VersionInfo {
  version: string;
  beta: boolean;
  released: string;
  expire: string;
}

interface VersionsResponse {
  currentBeta: string | null;
  currentVersion: string;
  versions: VersionInfo[];
}

/**
 * Busca a versão MAIS RECENTE do WhatsApp Web automaticamente.
 * 1º) Tenta scraping direto do sw.js (sempre a mais atual)
 * 2º) Fallback: JSON do GitHub (usa currentVersion)
 * 3º) Fallback final: versão fixa
 */
export async function getVersionByIndexFromUrl(_index?: number): Promise<[number, number, number]> {
  // 1. Tentar direto do WhatsApp Web (mais confiável e atual)
  try {
    console.log('[VERSION] Buscando versão mais recente direto do WhatsApp Web...');
    const version = await getWaVersion();
    console.log('[VERSION] ✅ Versão obtida do WhatsApp Web:', version);
    return version;
  } catch (err) {
    console.warn('[VERSION] ⚠️ Falha ao buscar do WhatsApp Web:', err?.message || err);
  }

  // 2. Fallback: JSON do GitHub (usar currentVersion = sempre a mais recente estável)
  try {
    console.log('[VERSION] Tentando fallback via GitHub JSON...');
    const url = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json';
    const response = await axios.get<VersionsResponse>(url, { timeout: 5000 });
    const versionsData = response.data;

    // Usar currentVersion (a mais recente estável)
    const current = versionsData.currentVersion;
    if (current) {
      const cleaned = current.replace('-alpha', '');
      const [major, minor, patch] = cleaned.split('.').map(Number);
      if (!isNaN(major) && !isNaN(minor) && !isNaN(patch)) {
        console.log('[VERSION] ✅ Versão obtida do GitHub (currentVersion):', [major, minor, patch]);
        return [major, minor, patch];
      }
    }

    // Se currentVersion falhar, pegar a primeira (mais recente) do array
    if (versionsData.versions && versionsData.versions.length > 0) {
      const latest = versionsData.versions[0];
      const cleaned = latest.version.replace('-alpha', '');
      const [major, minor, patch] = cleaned.split('.').map(Number);
      if (!isNaN(major) && !isNaN(minor) && !isNaN(patch)) {
        console.log('[VERSION] ✅ Versão obtida do GitHub (versions[0]):', [major, minor, patch]);
        return [major, minor, patch];
      }
    }
  } catch (err) {
    console.warn('[VERSION] ⚠️ Falha ao buscar do GitHub:', err?.message || err);
  }

  // 3. Fallback final
  const fallback: [number, number, number] = [2, 3000, 1029130979];
  console.log('[VERSION] ⚠️ Usando versão fallback fixa:', fallback);
  return fallback;
}

export async function getWaVersion(): Promise<[number, number, number]> {
  const config: AxiosRequestConfig = {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0',
      'Sec-Fetch-Dest': 'script',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'same-origin',
      'Referer': 'https://web.whatsapp.com/',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  };

  const baseURL = 'https://web.whatsapp.com';
  const { data: serviceworker } = await axios.get(`${baseURL}/sw.js`, config);

  const versions = [...serviceworker.matchAll(/client_revision\\":([\d\.]+),/g)].map((r: RegExpMatchArray) => r[1]);

  if (!versions.length) {
    throw new Error('No version found in service worker response');
  }

  const version = versions[0];
  const versionWA = `2.3000.${version}`;

  const [major, minor, patch] = versionWA.split('.').map(Number);

  return [major, minor, patch];
}