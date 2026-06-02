// githubShim.ts - Client-side fallback wrapper for running serverless on GitHub Pages
// Overrides window.fetch for /api/* requests so they route directly to Google Apps Script and SUPLA APIs.

import { ActivityLog, GateStatus } from '../types';

// Detect if we should run entirely client-side
export const isStaticMode = 
  window.location.hostname.includes('github.io') || 
  window.location.hostname.includes('github.dev') ||
  window.location.hash.includes('static') ||
  localStorage.getItem('FORCE_STATIC_MODE') === 'true' ||
  (window.location.hostname !== 'localhost' && !window.location.hostname.endsWith('.run.app'));

// Retrieve keys with fallback to localStorage so they are fully customizable in client mode
export function getSavedGoogleScriptUrl(): string {
  const envVal = (import.meta as any).env.VITE_GOOGLE_SCRIPT_URL;
  const localVal = localStorage.getItem('GOOGLE_SCRIPT_URL');
  let raw = localVal || envVal || 'https://script.google.com/macros/s/AKfycbwfG0_c_46FKnbr1oIeslYTU2mrvviQj7V9JrsYvrdb8o5CvSATTLKrNKVtXPNjRJjX/exec';
  
  // Clean duplicates/nested paste
  let cleanUrl = raw.trim();
  const macroMarker = 'https://script.google.com/macros/s/';
  const lastIndex = cleanUrl.lastIndexOf(macroMarker);
  if (lastIndex > 0) {
    cleanUrl = cleanUrl.substring(lastIndex);
  }
  return cleanUrl;
}

export function getSavedSuplaServerUrl(): string {
  return localStorage.getItem('SUPLA_SERVER_URL') || (import.meta as any).env.VITE_SUPLA_SERVER_URL || 'https://svr150.supla.org';
}

export function getSavedSuplaToken(): string {
  return localStorage.getItem('SUPLA_ACCESS_TOKEN') || (import.meta as any).env.VITE_SUPLA_ACCESS_TOKEN || '';
}

export function getSavedGateChannelId(): string {
  return localStorage.getItem('GATE_CHANNEL_ID') || (import.meta as any).env.VITE_GATE_CHANNEL_ID || '2012';
}

export function getSavedSensorChannelId(): string {
  return localStorage.getItem('SENSOR_CHANNEL_ID') || (import.meta as any).env.VITE_SENSOR_CHANNEL_ID || '2014';
}

export function getSavedInvertSensor(): boolean {
  const localVal = localStorage.getItem('INVERT_SENSOR');
  if (localVal !== null) {
    return localVal !== 'false';
  }
  return (import.meta as any).env.VITE_INVERT_SENSOR !== 'false';
}

// Simulated transition state in-memory
const localGateState: {
  state: 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING';
  lastTriggeredTime?: number;
  lastTriggeredAction?: 'OPEN' | 'CLOSE';
} = {
  state: 'CLOSED'
};

// Help to trigger remote Settings fetch
async function getRemoteSettingsDirectly(googleScriptUrl: string) {
  if (!googleScriptUrl) {
    return {
      partyMode: false,
      suplaServerUrl: getSavedSuplaServerUrl(),
      gateChannelId: getSavedGateChannelId(),
      sensorChannelId: getSavedSensorChannelId(),
      invertSensor: getSavedInvertSensor()
    };
  }
  try {
    const response = await fetch(`${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}action=getSettings`);
    if (response.ok) {
      const settings = await response.json();
      return {
        partyMode: !!settings.partyMode,
        suplaServerUrl: settings.suplaServerUrl || getSavedSuplaServerUrl(),
        gateChannelId: settings.gateChannelId || getSavedGateChannelId(),
        sensorChannelId: settings.sensorChannelId || getSavedSensorChannelId(),
        invertSensor: settings.invertSensor !== undefined 
          ? (settings.invertSensor === true || settings.invertSensor === 'TRUE') 
          : getSavedInvertSensor()
      };
    }
  } catch (e) {
    console.error('[Static Client] Failed to fetch settings from Google Apps Script:', e);
  }
  return {
    partyMode: false,
    suplaServerUrl: getSavedSuplaServerUrl(),
    gateChannelId: getSavedGateChannelId(),
    sensorChannelId: getSavedSensorChannelId(),
    invertSensor: getSavedInvertSensor()
  };
}

async function addClientLogDirectly(googleScriptUrl: string, userName: string, actionText: string, details: string) {
  if (!googleScriptUrl) {
    console.log(`[Static fallack log] User: ${userName}, Action: ${actionText}, Details: ${details}`);
    return;
  }
  try {
    await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'addLog',
        user: userName,
        actionText: actionText,
        details: details
      })
    });
  } catch (e) {
    console.error('[Static Client] log could not be saved to Sheet:', e);
  }
}

// Only mount interceptor if we are running in static mode
if (isStaticMode) {
  console.log('🚀 [STATIC CLIENT SHIM] GITHUB PAGES MODE ACTIVATED. All requests proxying direct client-to-API calls.');

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = input.toString();

    // Check if it's a request to our Express /api backend
    if (urlString.startsWith('/api/') || urlString.includes('/api/')) {
      const url = new URL(urlString, window.location.origin);
      const path = url.pathname;
      const googleScriptUrl = getSavedGoogleScriptUrl();

      try {
        // 1. HEALTH CHECK fallback
        if (path === '/api/health') {
          return new Response(JSON.stringify({ status: 'ok', environment: 'github-pages' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 2. AUTH LOGIN
        if (path === '/api/auth/login') {
          const body = JSON.parse(init?.body as string || '{}');
          const { firstName, lastName, plotNumber, passcode } = body;

          if (!googleScriptUrl) {
            return new Response(JSON.stringify({ success: false, error: 'Wklej URL skryptu Google Sheets w panelu ustawień lokalnych na dole strony.' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const queryParams = new URLSearchParams({
            action: 'login',
            firstName: (firstName || '').trim(),
            lastName: (lastName || '').trim(),
            plotNumber: (plotNumber || '').trim(),
            pin: (passcode || '').trim()
          }).toString();

          const targetUrl = `${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}${queryParams}`;
          const response = await originalFetch(targetUrl, { method: 'GET' });

          if (response.ok) {
            const data = await response.json();
            if (data && data.status === 'blocked') {
              return new Response(JSON.stringify({
                success: false,
                blocked: true,
                error: data.message || 'Twój dostęp został zablokowany.',
                reason: data.reason || 'Brak podanej przyczyny.'
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            if (data && data.status === 'success') {
              const role = (data.role || 'dzialkowiec').toLowerCase().trim();
              const cleanRole = (role === 'admin' || role === 'administrator') ? 'admin' : (role === 'gosc' || role === 'gość') ? 'gosc' : 'dzialkowiec';
              const fullname = data.name || `${firstName} ${lastName || ''} (Działka ${plotNumber})`;

              addClientLogDirectly(googleScriptUrl, fullname, 'LOGIN', 'Pomyślne zalogowanie (GitHub Pages)').catch(() => {});

              return new Response(JSON.stringify({
                success: true,
                user: {
                  id: 'sh_' + plotNumber,
                  name: fullname,
                  role: cleanRole,
                  status: 'active',
                  suplaAccessToken: data.token || ''
                }
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } else {
              return new Response(JSON.stringify({ success: false, error: data?.message || 'Niepoprawne dane logowania (imię, nr działki lub PIN).' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          } else {
            return new Response(JSON.stringify({ success: false, error: `Błąd połączenia ze skryptem Google (Status ${response.status}).` }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // 3. FORGOT PIN
        if (path === '/api/auth/forgot-pin') {
          const body = JSON.parse(init?.body as string || '{}');
          const { firstName, lastName, plotNumber, contactDetails } = body;

          const userDisplayName = `${firstName} ${lastName || ''} (Działka ${plotNumber})`;
          const details = `PROŚBA O RESET PINU! Kontakt: ${contactDetails || 'Brak danych'}`;

          await addClientLogDirectly(googleScriptUrl, userDisplayName, 'SYSTEM', details);

          return new Response(JSON.stringify({
            success: true,
            message: 'Zgłoszenie pomyślnie zapisane w logach Twojego Arkusza. Administrator wkrótce nada Ci nowy PIN.'
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 4. GET LOGS
        if (path === '/api/logs') {
          if (!googleScriptUrl) {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const response = await originalFetch(`${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}action=getLogs`);
          if (response.ok) {
            const fetchedLogs = await response.json();
            if (Array.isArray(fetchedLogs)) {
              const mappedLogs = fetchedLogs.map((item: any, idx: number) => {
                const userName = item.user || item.userName || 'Użytkownik';
                const details = item.details || item.action || '';
                const timestamp = item.timestamp || new Date().toISOString();
                const userRole = (userName === 'Administrator' || userName === 'System' || userName === 'SYSTEM') ? 'admin' : 'dzialkowiec';
                const actionType = item.action || 'OPEN';

                return {
                  id: `sheet_${idx}_${new Date(timestamp).getTime() || Date.now()}`,
                  timestamp: new Date(timestamp).toISOString(),
                  userName,
                  userRole,
                  action: actionType,
                  details
                };
              });
              return new Response(JSON.stringify(mappedLogs), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
          }
          return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 5. GET USERS FOR ADMIN
        if (path === '/api/admin/users') {
          if (!googleScriptUrl) {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const response = await originalFetch(`${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}action=getUsers`);
          if (response.ok) {
            const usersList = await response.json();
            return new Response(JSON.stringify(usersList), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 6. SAVE USER DETAILS
        if (path === '/api/admin/users/save') {
          if (!googleScriptUrl) {
            return new Response(JSON.stringify({ error: 'Skrypt Google Sheets nie jest skonfigurowany.' }), { status: 400 });
          }
          const body = JSON.parse(init?.body as string || '{}');
          const response = await originalFetch(googleScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'saveUser', ...body })
          });
          if (response.ok) {
            const data = await response.json();
            return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ error: 'Błąd połączenia ze skryptem.' }), { status: 500 });
        }

        // 7. DELETE USER
        if (path === '/api/admin/users/delete') {
          if (!googleScriptUrl) {
            return new Response(JSON.stringify({ error: 'Skrypt Google Sheets nie jest skonfigurowany.' }), { status: 400 });
          }
          const body = JSON.parse(init?.body as string || '{}');
          const response = await originalFetch(googleScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'deleteUser', plotNumber: body.plotNumber })
          });
          if (response.ok) {
            const data = await response.json();
            return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ error: 'Błąd połączenia ze skryptem.' }), { status: 500 });
        }

        // 8. GET CONFIG (SETTINGS)
        if (path === '/api/admin/config') {
          const settings = await getRemoteSettingsDirectly(googleScriptUrl);
          return new Response(JSON.stringify({
            suplaServerUrl: settings.suplaServerUrl,
            gateChannelId: settings.gateChannelId,
            sensorChannelId: settings.sensorChannelId,
            invertSensor: settings.invertSensor,
            adminPassword: '',
            hasToken: !!getSavedSuplaToken(),
            googleScriptUrl: googleScriptUrl,
            partyModeActive: settings.partyMode
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 9. SAVE SHEET SETTINGS (PARTY MODE)
        if (path === '/api/admin/save-sheets-settings') {
          if (!googleScriptUrl) {
            return new Response(JSON.stringify({ error: 'Skrypt Google Sheets nie jest skonfigurowany.' }), { status: 400 });
          }
          const body = JSON.parse(init?.body as string || '{}');
          const partyMode = !!body.partyMode;

          const response = await originalFetch(googleScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'saveSettings', partyMode })
          });

          if (response.ok) {
            await addClientLogDirectly(googleScriptUrl, 'Administrator', 'SYSTEM', `Zmieniono Tryb Imprezy na: ${partyMode ? 'WŁĄCZONY' : 'WYŁĄCZONY'} (GitHub Pages).`);
            return new Response(JSON.stringify({ success: true, partyMode }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ error: 'Nie udało się zapisać statusu w Arkuszu Google.' }), { status: 500 });
        }

        // 10. GET GATE STATUS (Direct browser SUPLA fetching)
        if (path === '/api/gate/status') {
          const settings = await getRemoteSettingsDirectly(googleScriptUrl);

          // Handle memory-based active transitions
          const TRANSITION_MS = 18000;
          const lastTriggeredTime = localGateState.lastTriggeredTime;
          const lastTriggeredAction = localGateState.lastTriggeredAction;
          const now = Date.now();
          const isTransitioning = lastTriggeredTime && (now - lastTriggeredTime < TRANSITION_MS);

          if (isTransitioning) {
            localGateState.state = lastTriggeredAction === 'CLOSE' ? 'CLOSING' : 'OPENING';
          } else if (lastTriggeredTime) {
            localGateState.state = lastTriggeredAction === 'CLOSE' ? 'CLOSED' : 'OPEN';
            localGateState.lastTriggeredTime = undefined;
            localGateState.lastTriggeredAction = undefined;
          }

          // Read SUPLA Access token
          let token = getSavedSuplaToken();
          const authHeader = init?.headers ? (init.headers as any)['Authorization'] || (init.headers as any)['authorization'] : undefined;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          }

          let suplaConnected = false;
          const checkChannel = settings.sensorChannelId || settings.gateChannelId;

          if (token && settings.suplaServerUrl && checkChannel) {
            try {
              const rootUrl = settings.suplaServerUrl.replace(/\/$/, '');
              const suplaUrl1 = `${rootUrl}/api/v3/channels/${checkChannel}?include=state`;
              const suplaUrl2 = `${rootUrl}/api/v2.3.0/channels/${checkChannel}?include=state`;
              
              let responseBody: any = null;
              let responseOk = false;

              if (googleScriptUrl) {
                // Proxy via Google Apps Script to bypass browser CORS constraints
                const proxyRes = await originalFetch(googleScriptUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain' },
                  body: JSON.stringify({
                    action: 'proxySupla',
                    url: suplaUrl1,
                    method: 'GET',
                    token: token
                  })
                });

                if (proxyRes.ok) {
                  const proxyPayload = await proxyRes.json();
                  if (proxyPayload.status >= 200 && proxyPayload.status < 300) {
                    try {
                      responseBody = JSON.parse(proxyPayload.body);
                      responseOk = true;
                    } catch (e) {
                      console.error('[Static Client] Failed to parse proxy SUPLA response body:', e);
                    }
                  }
                }

                if (!responseOk) {
                  const proxyRes2 = await originalFetch(googleScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                      action: 'proxySupla',
                      url: suplaUrl2,
                      method: 'GET',
                      token: token
                    })
                  });
                  if (proxyRes2.ok) {
                    const proxyPayload2 = await proxyRes2.json();
                    if (proxyPayload2.status >= 200 && proxyPayload2.status < 300) {
                      try {
                        responseBody = JSON.parse(proxyPayload2.body);
                        responseOk = true;
                      } catch (e) {
                        console.error('[Static Client] Failed to parse proxy SUPLA (v2) response body:', e);
                      }
                    }
                  }
                }
              } else {
                // Fallback direct call (might fail due to browser CORS, but useful as offline fallback)
                let response = await originalFetch(suplaUrl1, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                  }
                });

                if (!response.ok) {
                  response = await originalFetch(suplaUrl2, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Accept': 'application/json'
                    }
                  });
                }
                
                if (response.ok) {
                  responseBody = await response.json();
                  responseOk = true;
                }
              }

              if (responseOk && responseBody) {
                const sData = responseBody;
                const sensorOn = sData.state?.hi || sData.state?.on || false;

                let physicalState: 'OPEN' | 'CLOSED' = sensorOn ? 'OPEN' : 'CLOSED';
                if (settings.invertSensor) {
                  physicalState = sensorOn ? 'CLOSED' : 'OPEN';
                }

                suplaConnected = true;

                if (!isTransitioning) {
                  localGateState.state = physicalState;
                } else if (lastTriggeredAction === 'CLOSE' && physicalState === 'CLOSED') {
                  localGateState.state = 'CLOSED';
                  localGateState.lastTriggeredTime = undefined;
                  localGateState.lastTriggeredAction = undefined;
                }
              }
            } catch (err) {
              console.error('[Static Client] SUPLA fetch error:', err);
            }
          }

          const responsePayload: GateStatus = {
            state: localGateState.state,
            lastUpdated: new Date().toISOString(),
            suplaConnected,
            suplaServerUrl: settings.suplaServerUrl,
            channelId: settings.gateChannelId,
            sensorChannelId: settings.sensorChannelId,
            invertSensor: settings.invertSensor,
            partyModeActive: settings.partyMode
          };

          return new Response(JSON.stringify(responsePayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 11. GATE CONTROL TRIGGER
        if (path === '/api/gate/control') {
          const body = JSON.parse(init?.body as string || '{}');
          const { action, userName, userRole } = body;

          const settings = await getRemoteSettingsDirectly(googleScriptUrl);

          if (userRole !== 'admin' && settings.partyMode) {
            addClientLogDirectly(googleScriptUrl, userName, 'REJECTED', 'Próba wjazdu zablokowana - aktywny Tryb Imprezy (GitHub Pages).').catch(() => {});
            return new Response(JSON.stringify({ success: false, error: 'Wjazd zablokowany - na terenie ogrodów trwa impreza.' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          let token = getSavedSuplaToken();
          const authHeader = init?.headers ? (init.headers as any)['Authorization'] || (init.headers as any)['authorization'] : undefined;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          }

          const serverUrl = settings.suplaServerUrl.replace(/\/$/, '');
          const channelId = settings.gateChannelId;

          let suplaTriggered = false;
          let suplaDetails = 'Sterowanie wirtualne (GitHub Pages: brak tokenu).';

          if (token && serverUrl && channelId) {
            const commandsToTry = action === 'OPEN' 
              ? ['OPEN', 'OPEN_CLOSE', 'open', 'open_close']
              : ['CLOSE', 'OPEN_CLOSE', 'close', 'open_close'];

            const endpointsToTry = [
              { url: `${serverUrl}/api/v3/channels/${channelId}`, method: 'PATCH' },
              { url: `${serverUrl}/api/v3/channels/${channelId}`, method: 'POST' },
              { url: `${serverUrl}/api/v2.3.0/channels/${channelId}`, method: 'POST' },
              { url: `${serverUrl}/api/v2.3.0/channels/${channelId}`, method: 'PATCH' }
            ];

            let success = false;
            let lastStatus = 0;
            let lastErrorText = '';

            for (const cmd of commandsToTry) {
              for (const ep of endpointsToTry) {
                try {
                  let responseOk = false;
                  let responseStatus = 0;
                  let responseText = '';

                  if (googleScriptUrl) {
                    // Proxy SUPLA trigger command via Google Apps Script to bypass browser CORS constraints
                    const proxyRes = await originalFetch(googleScriptUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'text/plain' },
                      body: JSON.stringify({
                        action: 'proxySupla',
                        url: ep.url,
                        method: ep.method,
                        token: token,
                        body: { action: cmd }
                      })
                    });

                    if (proxyRes.ok) {
                      const proxyPayload = await proxyRes.json();
                      responseStatus = proxyPayload.status;
                      responseOk = (proxyPayload.status >= 200 && proxyPayload.status < 300);
                      responseText = proxyPayload.body || '';
                    } else {
                      responseStatus = proxyRes.status;
                      responseText = 'Proxy request failed';
                    }
                  } else {
                    // Direct browser call fallback (fails due to CORS in general)
                    const response = await originalFetch(ep.url, {
                      method: ep.method,
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                      },
                      body: JSON.stringify({ action: cmd })
                    });
                    responseStatus = response.status;
                    responseOk = response.ok;
                    responseText = await response.text().catch(() => 'brak szczegółów');
                  }

                  lastStatus = responseStatus;
                  if (responseOk) {
                    success = true;
                    suplaTriggered = true;
                    suplaDetails = `Wysłano poprawny sygnał do SUPLA: ${cmd} za pomocą ${ep.method} (GitHub Pages Proxy).`;
                    break;
                  } else {
                    lastErrorText = responseText;
                  }
                } catch (err: any) {
                  lastErrorText = err.message || String(err);
                }
              }
              if (success) break;
            }

            if (!success) {
              suplaDetails = `Błąd SUPLA przez Proxy (status: ${lastStatus}, ${lastErrorText}). Tryb rezerwowy aktywowany.`;
            }
          }

          const targetState = action === 'CLOSE' ? 'CLOSED' : 'OPEN';
          const transitState = action === 'OPEN' ? 'OPENING' : 'CLOSING';

          localGateState.state = transitState;
          localGateState.lastTriggeredTime = Date.now();
          localGateState.lastTriggeredAction = action;

          await addClientLogDirectly(googleScriptUrl, userName, action, `${action === 'OPEN' ? 'Otwarcie' : 'Zamknięcie'} bramy. ${suplaDetails}`);

          // End transition after 18s
          setTimeout(() => {
            if (localGateState.state === transitState) {
              localGateState.state = targetState;
              localGateState.lastTriggeredTime = undefined;
              localGateState.lastTriggeredAction = undefined;
            }
          }, 18000);

          const payload = {
            success: true,
            gateState: {
              state: localGateState.state,
              lastUpdated: new Date().toISOString(),
              suplaConnected: suplaTriggered,
              suplaServerUrl: settings.suplaServerUrl,
              channelId: settings.gateChannelId,
              sensorChannelId: settings.sensorChannelId,
              invertSensor: settings.invertSensor,
              partyModeActive: settings.partyMode
            },
            details: suplaDetails
          };

          return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Catch-all response for other unimplemented paths
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

      } catch (err: any) {
        console.error('[Static Client Proxy API Error]', err);
        return new Response(JSON.stringify({ success: false, error: err.message || 'Wystąpił błąd podczas symulacji API w przeglądarce.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Default to native fetch if it's not a /api/* request
    return originalFetch(input, init);
  };
}
