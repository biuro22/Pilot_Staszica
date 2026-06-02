import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { ActivityLog, GateStatus } from './src/types';

dotenv.config();

// Helper to sanitize Google Script URL against duplicate/nested copy-paste patterns
function getGoogleScriptUrl(): string {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) return '';
  let cleanUrl = url.trim();
  const macroMarker = 'https://script.google.com/macros/s/';
  const lastIndex = cleanUrl.lastIndexOf(macroMarker);
  if (lastIndex > 0) {
    cleanUrl = cleanUrl.substring(lastIndex);
  }
  return cleanUrl;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory gate simulated state (persists while the server is running)
let gateState: GateStatus = {
  state: 'CLOSED',
  lastUpdated: new Date().toISOString(),
  suplaConnected: false,
  suplaServerUrl: process.env.SUPLA_SERVER_URL || 'https://svr150.supla.org',
  channelId: process.env.GATE_CHANNEL_ID || '2012',
  sensorChannelId: process.env.SENSOR_CHANNEL_ID || '2014',
  invertSensor: process.env.INVERT_SENSOR !== 'false',
  lastActionBy: 'System'
};

// Helper to retrieve remote settings from Google Sheets fallback to .env variables
async function getRemoteSettings() {
  const googleScriptUrl = getGoogleScriptUrl();
  if (!googleScriptUrl) {
    return {
      partyMode: false,
      suplaServerUrl: process.env.SUPLA_SERVER_URL || 'https://svr150.supla.org',
      gateChannelId: process.env.GATE_CHANNEL_ID || '2012',
      sensorChannelId: process.env.SENSOR_CHANNEL_ID || '2014',
      invertSensor: process.env.INVERT_SENSOR !== 'false'
    };
  }
  try {
    const response = await fetch(`${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}action=getSettings`, {
      signal: AbortSignal.timeout(15000)
    });
    if (response.ok) {
      const settings: any = await response.json();
      return {
        partyMode: !!settings.partyMode,
        suplaServerUrl: settings.suplaServerUrl || process.env.SUPLA_SERVER_URL || 'https://svr150.supla.org',
        gateChannelId: settings.gateChannelId || process.env.GATE_CHANNEL_ID || '2012',
        sensorChannelId: settings.sensorChannelId || process.env.SENSOR_CHANNEL_ID || '2014',
        invertSensor: settings.invertSensor !== undefined ? (settings.invertSensor === true || settings.invertSensor === 'TRUE') : (process.env.INVERT_SENSOR !== 'false')
      };
    }
  } catch (e: any) {
    console.error('Failed to get settings from Google Sheets:', e.message);
  }
  return {
    partyMode: false,
    suplaServerUrl: process.env.SUPLA_SERVER_URL || 'https://svr150.supla.org',
    gateChannelId: process.env.GATE_CHANNEL_ID || '2012',
    sensorChannelId: process.env.SENSOR_CHANNEL_ID || '2014',
    invertSensor: process.env.INVERT_SENSOR !== 'false'
  };
}

// Helper to append a log entry inside the "Logi" sheet in real-time
async function addLog(userName: string, actionText: string, details: string) {
  const googleScriptUrl = getGoogleScriptUrl();
  if (!googleScriptUrl) {
    console.log(`[Local fallback log] User: ${userName}, Action: ${actionText}, Details: ${details}`);
    return;
  }
  try {
    await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addLog',
        user: userName,
        actionText: actionText,
        details: details
      }),
      signal: AbortSignal.timeout(15000)
    });
  } catch (e: any) {
    console.error('Failed to send log to Google Sheets:', e.message);
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Secure Login (checks name, plot, and PIN against Google Sheets)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { firstName, lastName, plotNumber, passcode } = req.body;
    if (!passcode) {
      return res.status(200).json({ success: false, error: 'PIN dostępu jest wymagany.' });
    }
    if (!plotNumber) {
      return res.status(200).json({ success: false, error: 'Numer działki jest wymagany.' });
    }
    if (!firstName) {
      return res.status(200).json({ success: false, error: 'Imię jest wymagane dla zalogowania.' });
    }

    const googleScriptUrl = getGoogleScriptUrl();
    if (!googleScriptUrl) {
       return res.status(200).json({ success: false, error: 'Serwer nie został jeszcze skonfigurowany w pliku .env (brak klucza GOOGLE_SCRIPT_URL).' });
    }

    const queryParams = new URLSearchParams({
      action: 'login',
      firstName: firstName.trim(),
      lastName: (lastName || '').trim(),
      plotNumber: plotNumber.trim(),
      pin: passcode.trim()
    }).toString();

    const targetUrl = `${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}${queryParams}`;
    console.log(`[Gate Server] Attempting login verification with URL: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      const data: any = await response.json();
      if (data && data.status === 'blocked') {
        return res.json({
          success: false,
          blocked: true,
          error: data.message || 'Twój dostęp został zablokowany.',
          reason: data.reason || 'Brak podanej przyczyny.'
        });
      }
      if (data && data.status === 'success') {
        const role = (data.role || 'dzialkowiec').toLowerCase().trim();
        const cleanRole = (role === 'admin' || role === 'administrator') ? 'admin' : (role === 'gosc' || role === 'gość') ? 'gosc' : 'dzialkowiec';
        const fullname = data.name || `${firstName} ${lastName || ''} (Działka ${plotNumber})`;

        // Append log to Google Sheets
        addLog(fullname, 'LOGIN', 'Pomyślne zalogowanie do aplikacji.').catch(() => {});

        return res.json({
          success: true,
          user: {
            id: 'sh_' + plotNumber,
            name: fullname,
            role: cleanRole,
            status: 'active',
            suplaAccessToken: data.token || ''
          }
        });
      } else {
        return res.json({ success: false, error: data?.message || 'Nieprawidłowe dane logowania (imię, numer działki lub PIN).' });
      }
    } else {
       return res.json({ success: false, error: `Błąd połączenia ze skryptem Google Sheets (Status ${response.status}). Spróbuj ponownie.` });
    }
  } catch (err: any) {
    console.error('Login processing error: ', err);
    const errMessage = err?.message || err || 'Nieznany błąd sieci';
    return res.json({ 
      success: false, 
      error: `Wystąpił błąd podczas weryfikacji tożsamości (${errMessage}). Upewnij się, że poprawnie wdrożono i wklejono GOOGLE_SCRIPT_URL w pliku .env, a wdrożenie ma status 'Każdy' (Anyone).` 
    });
  }
});

// 2. Forgot PIN request (Saves requests as special entries in "Logi" sheet)
app.post('/api/auth/forgot-pin', async (req, res) => {
  try {
    const { firstName, lastName, plotNumber, contactDetails } = req.body;
    if (!firstName || !plotNumber) {
      return res.status(400).json({ error: 'Imię oraz numer działki są wymagane.' });
    }

    const userDisplayName = `${firstName} ${lastName || ''} (Działka ${plotNumber})`;
    const details = `PROŚBA O RESET PINU! Kontakt: ${contactDetails || 'Brak danych kontaktowych'}`;

    await addLog(userDisplayName, 'SYSTEM', details);

    return res.json({
      success: true,
      message: 'Zgłoszenie zostało pomyślnie zarejestrowane w logach Twojego Arkusza Google. Administrator nada Ci nowy PIN.'
    });
  } catch (err) {
    console.error('Forgot pin request processing error: ', err);
    return res.status(500).json({ error: 'Błąd rejestrowania prośby o reset PINu.' });
  }
});

// 3. Force change-pin endpoint (PIN is changed directly inside Google Sheet)
app.post('/api/auth/change-pin', async (req, res) => {
  return res.status(400).json({ error: 'Kody PIN są nadawane i zmieniane wyłącznie bezpośrednio przez zarządcę w Arkuszu Google.' });
});

// 4. Fetch logs directly from Google Sheets
app.get('/api/logs', async (req, res) => {
  const googleScriptUrl = getGoogleScriptUrl();
  if (!googleScriptUrl) {
    return res.json([]);
  }
  try {
    const response = await fetch(`${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}action=getLogs`, {
      signal: AbortSignal.timeout(15000)
    });
    if (response.ok) {
      const fetchedLogs: any = await response.json();
      if (Array.isArray(fetchedLogs)) {
        const mappedLogs = fetchedLogs.map((item: any, idx: number) => {
          const userName = item.user || item.userName || 'Użytkownik';
          const details = item.details || item.action || '';
          const timestamp = item.timestamp || new Date().toISOString();
          const userRole = (userName === 'Administrator' || userName === 'System') ? 'admin' : 'dzialkowiec';
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
        return res.json(mappedLogs);
      }
    }
  } catch (e: any) {
    console.error('Failed to load logs from Google Sheets: ', e.message);
  }
  return res.json([]);
});

// 5. Gate status retrieval
app.get('/api/gate/status', async (req, res) => {
  try {
    const settings = await getRemoteSettings();

    // Dynamically update latest configurations from Google Sheets
    gateState.suplaServerUrl = settings.suplaServerUrl;
    gateState.channelId = settings.gateChannelId;
    gateState.sensorChannelId = settings.sensorChannelId;
    gateState.invertSensor = settings.invertSensor;
    gateState.partyModeActive = settings.partyMode;

    // Handle transition counters in memory
    const TRANSITION_MS = 18000;
    const lastTriggeredTime = gateState.lastTriggeredTime;
    const lastTriggeredAction = gateState.lastTriggeredAction;
    const now = Date.now();
    const isTransitioning = lastTriggeredTime && (now - lastTriggeredTime < TRANSITION_MS);

    if (isTransitioning) {
      gateState.state = lastTriggeredAction === 'CLOSE' ? 'CLOSING' : 'OPENING';
    } else if (lastTriggeredTime) {
      gateState.state = lastTriggeredAction === 'CLOSE' ? 'CLOSED' : 'OPEN';
      gateState.lastTriggeredTime = undefined;
      gateState.lastTriggeredAction = undefined;
    }

    // Resolve bearer token: try header, then fallback to .env
    let token = process.env.SUPLA_ACCESS_TOKEN || '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    const checkChannel = gateState.sensorChannelId || gateState.channelId;
    if (token && gateState.suplaServerUrl && checkChannel) {
      try {
        const rootUrl = gateState.suplaServerUrl.replace(/\/$/, '');
        let response = await fetch(`${rootUrl}/api/v3/channels/${checkChannel}?include=state`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(4000)
        });

        if (!response.ok) {
          response = await fetch(`${rootUrl}/api/v2.3.0/channels/${checkChannel}?include=state`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(4000)
          });
        }

        if (response.ok) {
          const sData: any = await response.json();
          const sensorOn = sData.state?.hi || sData.state?.on || false;

          let physicalState: 'OPEN' | 'CLOSED' = sensorOn ? 'OPEN' : 'CLOSED';
          if (gateState.invertSensor !== false) {
            physicalState = sensorOn ? 'CLOSED' : 'OPEN';
          }

          gateState.suplaConnected = true;

          if (!isTransitioning) {
            gateState.state = physicalState;
          } else if (lastTriggeredAction === 'CLOSE' && physicalState === 'CLOSED') {
            gateState.state = 'CLOSED';
            gateState.lastTriggeredTime = undefined;
            gateState.lastTriggeredAction = undefined;
          }
        } else {
          gateState.suplaConnected = false;
        }
      } catch (err) {
        gateState.suplaConnected = false;
      }
    }

    gateState.lastUpdated = new Date().toISOString();
    return res.json(gateState);

  } catch (error: any) {
    console.error('Gate status endpoint error:', error);
    return res.status(500).json({ error: error.message, state: 'CLOSED' });
  }
});

// 6. Gate control trigger (Otwórz / Zamknij)
app.post('/api/gate/control', async (req, res) => {
  try {
    const { action, userName, userRole } = req.body;
    if (!userName || !userRole) {
      return res.status(401).json({ error: 'Uwierzytelnienie użytkownika wymagane.' });
    }
    if (action !== 'OPEN' && action !== 'CLOSE') {
      return res.status(400).json({ error: 'Nieprawidłowa operacja.' });
    }

    const settings = await getRemoteSettings();

    // Prevent non-admin users from controlling the gate if party mode is active
    if (userRole !== 'admin' && settings.partyMode) {
      addLog(userName, 'REJECTED', 'Próba wjazdu zablokowana - aktywny Tryb Imprezy.').catch(() => {});
      return res.status(200).json({ success: false, error: 'Wjazd zablokowany - na terenie ogrodów trwa impreza.' });
    }

    // Capture Token
    let token = process.env.SUPLA_ACCESS_TOKEN || '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    const serverUrl = settings.suplaServerUrl.replace(/\/$/, '');
    const channelId = settings.gateChannelId;

    let suplaTriggered = false;
    let suplaDetails = 'Sterowanie wirtualne (brak tokenu).';

    if (token && serverUrl && channelId) {
      const commandsToTry = [];
      if (action === 'OPEN') {
        commandsToTry.push('OPEN');
        commandsToTry.push('OPEN_CLOSE');
        commandsToTry.push('open');
        commandsToTry.push('open_close');
      } else {
        commandsToTry.push('CLOSE');
        commandsToTry.push('OPEN_CLOSE');
        commandsToTry.push('close');
        commandsToTry.push('open_close');
      }

      const endpointsToTry = [
        { url: `${serverUrl}/api/v3/channels/${channelId}`, method: 'PATCH' },
        { url: `${serverUrl}/api/v3/channels/${channelId}`, method: 'POST' },
        { url: `${serverUrl}/api/v2.3.0/channels/${channelId}`, method: 'POST' },
        { url: `${serverUrl}/api/v2.3.0/channels/${channelId}`, method: 'PATCH' }
      ];

      let success = false;
      let lastStatus = 0;
      let lastErrorText = '';

      console.log(`[SUPLA] Initiating gate control for action=${action}. Channel ID: ${channelId}.`);
      for (const cmd of commandsToTry) {
        for (const ep of endpointsToTry) {
          try {
            console.log(`[SUPLA API attempt] Sending ${ep.method} to ${ep.url} with action=${cmd}`);
            const response = await fetch(ep.url, {
              method: ep.method,
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ action: cmd }),
              signal: AbortSignal.timeout(6000)
            });

            lastStatus = response.status;
            if (response.ok) {
              success = true;
              suplaTriggered = true;
              suplaDetails = `Wysłano poprawny sygnał do SUPLA: ${cmd} za pomocą ${ep.method} na ${ep.url.replace(serverUrl, '')}.`;
              console.log(`[SUPLA API success] Gate commanded successfully with cmd=${cmd} on endpoint=${ep.url}`);
              break;
            } else {
              lastErrorText = await response.text().catch(() => 'brak szczegółów');
              console.log(`[SUPLA API fail] Endpoint returned ${response.status}: ${lastErrorText}`);
            }
          } catch (err: any) {
            lastErrorText = err.message || String(err);
            console.log(`[SUPLA API error] connection failed to ${ep.url}: ${lastErrorText}`);
          }
        }
        if (success) {
          break;
        }
      }

      if (!success) {
        suplaDetails = `Błąd SUPLA API (ostatni status: ${lastStatus}, błąd: ${lastErrorText}). Tryb rezerwowy aktywowany.`;
      }
    }

    // Set transition parameters
    const targetState = action === 'CLOSE' ? 'CLOSED' : 'OPEN';
    const transitState = action === 'OPEN' ? 'OPENING' : 'CLOSING';

    gateState.state = transitState;
    gateState.lastTriggeredTime = Date.now();
    gateState.lastTriggeredAction = action;
    gateState.lastUpdated = new Date().toISOString();
    gateState.lastActionBy = userName;
    gateState.suplaConnected = suplaTriggered;

    // Log action trigger to Google Sheets
    await addLog(userName, action, `${action === 'OPEN' ? 'Otwarcie' : 'Zamknięcie'} bramy. ${suplaDetails}`);

    // Schedule final physical completion guard
    setTimeout(() => {
      if (gateState.state === transitState) {
        gateState.state = targetState;
        gateState.lastTriggeredTime = undefined;
        gateState.lastTriggeredAction = undefined;
        gateState.lastUpdated = new Date().toISOString();
      }
    }, 18000);

    return res.json({
      success: true,
      gateState: gateState,
      details: suplaDetails
    });

  } catch (err: any) {
    console.error('Trigger command error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get users for Admin Dashboard from Google Sheets (omits PINs & Tokens)
app.get('/api/admin/users', async (req, res) => {
  const googleScriptUrl = getGoogleScriptUrl();
  if (!googleScriptUrl) {
    return res.json([]);
  }
  try {
    const response = await fetch(`${googleScriptUrl}${googleScriptUrl.includes('?') ? '&' : '?'}action=getUsers`, {
      signal: AbortSignal.timeout(15000)
    });
    if (response.ok) {
      const usersList = await response.json();
      return res.json(usersList);
    }
  } catch (err: any) {
    console.error('Failed to fetch user list from Sheet: ', err.message);
  }
  return res.json([]);
});

// 7a. Save User Details (Add/Edit)
app.post('/api/admin/users/save', async (req, res) => {
  const googleScriptUrl = getGoogleScriptUrl();
  if (!googleScriptUrl) {
    return res.status(400).json({ error: 'Skrypt Google Sheets nie jest skonfigurowany.' });
  }
  try {
    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveUser',
        ...req.body
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    } else {
      return res.status(500).json({ error: 'Błąd połączenia ze skryptem Google Sheets.' });
    }
  } catch (err: any) {
    console.error('Failed to save user in Sheet: ', err.message);
    return res.status(500).json({ error: `Problem z zapisem: ${err.message}` });
  }
});

// 7b. Delete User
app.post('/api/admin/users/delete', async (req, res) => {
  const googleScriptUrl = getGoogleScriptUrl();
  if (!googleScriptUrl) {
    return res.status(400).json({ error: 'Skrypt Google Sheets nie jest skonfigurowany.' });
  }
  try {
    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteUser',
        plotNumber: req.body.plotNumber
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    } else {
      return res.status(500).json({ error: 'Błąd połączenia podczas usuwania ze skryptu Google Sheets.' });
    }
  } catch (err: any) {
    console.error('Failed to delete user in Sheet: ', err.message);
    return res.status(500).json({ error: `Problem z usunięciem: ${err.message}` });
  }
});

// 8. Unused resolving requested PIN re-routes to error details
app.get('/api/admin/pin-requests', (req, res) => res.json([]));
app.post('/api/admin/pin-requests/resolve', (req, res) => res.status(400).json({ error: 'PINy są zmieniane u źródła w Arkuszu Google.' }));

// 9. Fetch configuration details (Settings)
app.get('/api/admin/config', async (req, res) => {
  const settings = await getRemoteSettings();
  return res.json({
    suplaServerUrl: settings.suplaServerUrl,
    gateChannelId: settings.gateChannelId,
    sensorChannelId: settings.sensorChannelId,
    invertSensor: settings.invertSensor,
    adminPassword: '',
    hasToken: !!process.env.SUPLA_ACCESS_TOKEN,
    googleScriptUrl: getGoogleScriptUrl(),
    partyModeActive: settings.partyMode
  });
});

app.post('/api/admin/config', (req, res) => {
  return res.status(400).json({ error: 'Konfiguracja sprzętowa SUPLA jest zaczytywana z pliku .env i z Arkusza.' });
});

// 10. Toggle Party Mode (partyMode)
app.post('/api/admin/save-sheets-settings', async (req, res) => {
  const { partyMode } = req.body;
  const googleScriptUrl = getGoogleScriptUrl();
  if (!googleScriptUrl) {
    return res.status(400).json({ error: 'Skrypt Google Sheets nie jest skonfigurowany.' });
  }
  try {
    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSettings',
        partyMode: !!partyMode
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (response.ok) {
      gateState.partyModeActive = !!partyMode;
      await addLog('Administrator', 'SYSTEM', `Zmieniono Tryb Imprezy w Arkuszu Google na: ${partyMode ? 'WŁĄCZONY' : 'WYŁĄCZONY'}.`);
      return res.json({ success: true, partyMode });
    } else {
      return res.status(500).json({ error: 'Nie udało się zapisać statusu w Arkuszu Google.' });
    }
  } catch (err: any) {
    console.error('Error toggling partyMode inside Sheet:', err.message);
    return res.status(500).json({ error: 'Połączenie z Arkuszem Google zostało przerwane.' });
  }
});

// Unused Notifications mockups returned as empty
app.get('/api/push/subscribers', (req, res) => res.json([]));
app.post('/api/push/subscribe', (req, res) => res.json({ success: true }));
app.post('/api/push/test', (req, res) => res.json({ success: true }));

// ----------------------------------------------------
// SERVER SERVING LOGIC
// ----------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || 
                 (typeof __filename !== 'undefined' && __filename.includes('dist')) || 
                 (typeof __dirname !== 'undefined' && __dirname.includes('dist'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Gate Server] running at http://0.0.0.0:${PORT}`);
    console.log(`[Gate Server] Node Environment: ${process.env.NODE_ENV || 'development'}, isProd: ${isProd}`);
  });
}

startServer();
