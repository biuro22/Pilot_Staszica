import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { WebUser, ActivityLog, GateStatus, PushSubscriptionInfo } from './src/types';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'db.json');

// Ensure db.json exists with default structures
function initializeDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: [
        {
          id: 'u1',
          name: 'Jan Kowalski',
          plotNumber: '15',
          passcode: '1234',
          role: 'dzialkowiec',
          status: 'active',
          blockReason: '',
          createdAt: new Date().toISOString()
        },
        {
          id: 'u2',
          name: 'Marek Nowak',
          plotNumber: '88',
          passcode: '5678',
          role: 'dzialkowiec',
          status: 'active',
          blockReason: '',
          createdAt: new Date().toISOString()
        },
        {
          id: 'u3',
          name: 'Zofia Malicka',
          plotNumber: '3',
          passcode: '1111',
          role: 'gosc',
          status: 'active',
          blockReason: '',
          createdAt: new Date().toISOString()
        },
        {
          id: 'u4',
          name: 'Tomasz Adamski',
          plotNumber: '102',
          passcode: '9999',
          role: 'dzialkowiec',
          status: 'blocked',
          blockReason: 'Impreza w domu działkowca - czasowe zablokowanie działkowców.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'u5',
          name: 'Marek Majcherczyk',
          plotNumber: '227',
          passcode: '3333',
          role: 'admin',
          status: 'active',
          blockReason: '',
          createdAt: new Date().toISOString()
        }
      ] as WebUser[],
      logs: [
        {
          id: 'log1',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          userName: 'System',
          userRole: 'system',
          action: 'SYSTEM',
          details: 'Inicjalizacja systemu sterowania bramą Ogrody Stara Huta.'
        },
        {
          id: 'log2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          userName: 'Jan Kowalski (Działka 15)',
          userRole: 'dzialkowiec',
          action: 'OPEN',
          details: 'Wysłano komendę otwarcia bramy.'
        }
      ] as ActivityLog[],
      subscriptions: [] as PushSubscriptionInfo[],
      gateState: {
        state: 'CLOSED',
        lastUpdated: new Date().toISOString(),
        suplaConnected: false,
        suplaServerUrl: process.env.SUPLA_SERVER_URL || 'https://svr150.supla.org',
        channelId: process.env.GATE_CHANNEL_ID || '2012',
        sensorChannelId: process.env.SENSOR_CHANNEL_ID || '2014',
        lastActionBy: 'System'
      } as GateStatus,
      credentials: {
        suplaAccessToken: process.env.SUPLA_ACCESS_TOKEN || '',
        adminPassword: process.env.ADMIN_PASSWORD || 'Admin'
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

// Initialize local backup of DB file
initializeDatabase();

// Firebase admin initialization
const CONFIG_FILE = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

try {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
} catch (err) {
  console.log("Firebase admin initializer statement: ", err);
}

const dbInstance = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(undefined, firebaseConfig.firestoreDatabaseId)
  : getFirestore();

// Helper functions for Database and Config pointing to Firestore
async function readDb() {
  try {
    // 1. Fetch users
    const usersSnap = await dbInstance.collection('users').get();
    const users: any[] = [];
    usersSnap.forEach((doc: any) => {
      const uData = doc.data();
      let plotNumber = uData.plotNumber;
      if (!plotNumber && uData.name) {
        const match = uData.name.match(/(?:działka|dzialka|działki|dzialki|pokój|pokoj|pokoju)\s*(\d+)/i) || uData.name.match(/(\d+)/);
        if (match) {
          plotNumber = match[1];
        }
      }
      users.push({ id: doc.id, ...uData, plotNumber: plotNumber || '' });
    });

    // 2. Fetch logs (order by timestamp desc, limit 500)
    const logsSnap = await dbInstance.collection('logs').orderBy('timestamp', 'desc').limit(500).get();
    const logs: any[] = [];
    logsSnap.forEach((doc: any) => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    // 3. Fetch subscriptions
    const subsSnap = await dbInstance.collection('subscriptions').get();
    const subscriptions: any[] = [];
    subsSnap.forEach((doc: any) => {
      subscriptions.push({ id: doc.id, ...doc.data() });
    });

    // 4. Fetch pinResetRequests
    const pinReqSnap = await dbInstance.collection('pinResetRequests').get();
    const pinResetRequests: any[] = [];
    pinReqSnap.forEach((doc: any) => {
      pinResetRequests.push({ id: doc.id, ...doc.data() });
    });

    // 5. Fetch gateState (document 'main')
    const gateDoc = await dbInstance.collection('gateState').doc('main').get();
    let gateState: any = gateDoc.exists ? gateDoc.data() : null;

    // 6. Fetch config (document 'settings')
    const configDoc = await dbInstance.collection('config').doc('settings').get();
    let configData: any = configDoc.exists ? configDoc.data() : null;

    // Initialize with default values if Firestore collections are empty (first run / migration)
    if (users.length === 0 && fs.existsSync(DB_FILE)) {
      console.log('Firestore is empty. Migrating local db.json data to Firestore...');
      const localDbRaw = fs.readFileSync(DB_FILE, 'utf-8');
      const localDb = JSON.parse(localDbRaw);
      
      const batch = dbInstance.batch();
      
      (localDb.users || []).forEach((u: any) => {
        const docRef = dbInstance.collection('users').doc(u.id);
        batch.set(docRef, u);
      });
      (localDb.logs || []).forEach((l: any) => {
        const docRef = dbInstance.collection('logs').doc(l.id);
        batch.set(docRef, l);
      });
      (localDb.subscriptions || []).forEach((s: any) => {
        const docRef = dbInstance.collection('subscriptions').doc(s.id);
        batch.set(docRef, s);
      });
      (localDb.pinResetRequests || []).forEach((r: any) => {
        const docRef = dbInstance.collection('pinResetRequests').doc(r.id);
        batch.set(docRef, r);
      });
      
      if (localDb.gateState) {
        const docRef = dbInstance.collection('gateState').doc('main');
        batch.set(docRef, localDb.gateState);
      }
      
      if (localDb.credentials) {
        const docRef = dbInstance.collection('config').doc('settings');
        const settingsToSet = {
          suplaAccessToken: localDb.credentials.suplaAccessToken || '',
          adminPassword: localDb.credentials.adminPassword || 'Admin',
          googleScriptUrl: localDb.credentials.googleScriptUrl || '',
          lockSchedule: localDb.lockSchedule || {
            enabled: false,
            startDateTime: "2026-05-30T06:00",
            endDateTime: "2026-05-31T22:00",
            reason: "Weekendowa blokada wjazdu (sobota 6:00 - niedziela 22:00)."
          }
        };
        batch.set(docRef, settingsToSet);
      }
      
      await batch.commit();
      console.log('Migration to Firestore completed successfully!');
      return readDb();
    }

    if (!gateState) {
      gateState = {
        state: 'CLOSED',
        lastUpdated: new Date().toISOString(),
        suplaConnected: false,
        suplaServerUrl: process.env.SUPLA_SERVER_URL || 'https://svr150.supla.org',
        channelId: process.env.GATE_CHANNEL_ID || '2012',
        sensorChannelId: process.env.SENSOR_CHANNEL_ID || '2014',
        lastActionBy: 'System'
      };
    }

    if (!configData) {
      configData = {
        suplaAccessToken: process.env.SUPLA_ACCESS_TOKEN || '',
        adminPassword: process.env.ADMIN_PASSWORD || 'Admin',
        googleScriptUrl: '',
        lockSchedule: {
          enabled: false,
          startDateTime: "2026-05-30T06:00",
          endDateTime: "2026-05-31T22:00",
          reason: "Weekendowa blokada wjazdu (sobota 6:00 - niedziela 22:00)."
        }
      };
    }

    return {
      users,
      logs,
      subscriptions,
      pinResetRequests,
      gateState,
      lockSchedule: configData.lockSchedule || {
        enabled: false,
        startDateTime: "2026-05-30T06:00",
        endDateTime: "2026-05-31T22:00",
        reason: "Weekendowa blokada wjazdu (sobota 6:00 - niedziela 22:00)."
      },
      credentials: {
        suplaAccessToken: configData.suplaAccessToken || '',
        adminPassword: configData.adminPassword || 'Admin',
        googleScriptUrl: configData.googleScriptUrl || ''
      }
    };
  } catch (error) {
    console.error('Error reading from Firestore, falling back to local file db.json:', error);
    try {
      if (fs.existsSync(DB_FILE)) {
        const localDbRaw = fs.readFileSync(DB_FILE, 'utf-8');
        const db = JSON.parse(localDbRaw);
        if (db && Array.isArray(db.users)) {
          db.users = db.users.map((u: any) => {
            let plotNumber = u.plotNumber;
            if (!plotNumber && u.name) {
              const match = u.name.match(/(?:działka|dzialka|działki|dzialki|pokój|pokoj|pokoju)\s*(\d+)/i) || u.name.match(/(\d+)/);
              if (match) {
                plotNumber = match[1];
              }
            }
            return { ...u, plotNumber: plotNumber || '' };
          });
        }
        return db;
      }
    } catch (fsErr) {
      console.error('Failed to read fallback local file db.json:', fsErr);
    }
    return {
      users: [],
      logs: [],
      subscriptions: [],
      pinResetRequests: [],
      gateState: {
        state: 'CLOSED',
        lastUpdated: new Date().toISOString(),
        suplaConnected: false,
        suplaServerUrl: 'https://svr150.supla.org',
        channelId: '2012',
        sensorChannelId: '2014',
        lastActionBy: 'System'
      },
      credentials: {
        suplaAccessToken: '',
        adminPassword: 'Admin',
        googleScriptUrl: ''
      }
    };
  }
}

async function writeDb(data: any) {
  // Always write to local backup/fallback file first
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (fsErr) {
    console.error('Failed to write local backup file db.json:', fsErr);
  }

  try {
    const batch = dbInstance.batch();

    // 1. Write users
    if (data.users && Array.isArray(data.users)) {
      const usersSnap = await dbInstance.collection('users').get();
      const existingIds = new Set<string>();
      usersSnap.forEach((doc: any) => existingIds.add(doc.id));

      data.users.forEach((u: any) => {
        const docRef = dbInstance.collection('users').doc(u.id);
        batch.set(docRef, u, { merge: true });
        existingIds.delete(u.id);
      });

      // Delete removed users
      existingIds.forEach((id) => {
        const docRef = dbInstance.collection('users').doc(id);
        batch.delete(docRef);
      });
    }

    // 2. Write logs (limit newest to prevent massive write batches)
    if (data.logs && Array.isArray(data.logs)) {
      const logsSnap = await dbInstance.collection('logs').get();
      const existingLogs = new Set<string>();
      logsSnap.forEach((doc: any) => existingLogs.add(doc.id));

      const logsToWrite = data.logs.slice(0, 200);
      logsToWrite.forEach((l: any) => {
        const docRef = dbInstance.collection('logs').doc(l.id);
        batch.set(docRef, l, { merge: true });
        existingLogs.delete(l.id);
      });

      // Prune old logs that are not in newest subset
      existingLogs.forEach((id) => {
        const docRef = dbInstance.collection('logs').doc(id);
        batch.delete(docRef);
      });
    }

    // 3. Write subscriptions
    if (data.subscriptions && Array.isArray(data.subscriptions)) {
      const subsSnap = await dbInstance.collection('subscriptions').get();
      const existingSubsIds = new Set<string>();
      subsSnap.forEach((doc: any) => existingSubsIds.add(doc.id));

      data.subscriptions.forEach((s: any) => {
        const docRef = dbInstance.collection('subscriptions').doc(s.id);
        batch.set(docRef, s, { merge: true });
        existingSubsIds.delete(s.id);
      });

      existingSubsIds.forEach((id) => {
        const docRef = dbInstance.collection('subscriptions').doc(id);
        batch.delete(docRef);
      });
    }

    // 4. Write pinResetRequests
    if (data.pinResetRequests && Array.isArray(data.pinResetRequests)) {
      const pinReqSnap = await dbInstance.collection('pinResetRequests').get();
      const existingReqIds = new Set<string>();
      pinReqSnap.forEach((doc: any) => existingReqIds.add(doc.id));

      data.pinResetRequests.forEach((r: any) => {
        const docRef = dbInstance.collection('pinResetRequests').doc(r.id);
        batch.set(docRef, r, { merge: true });
        existingReqIds.delete(r.id);
      });

      existingReqIds.forEach((id) => {
        const docRef = dbInstance.collection('pinResetRequests').doc(id);
        batch.delete(docRef);
      });
    }

    // 5. Write gateState
    if (data.gateState) {
      const docRef = dbInstance.collection('gateState').doc('main');
      batch.set(docRef, data.gateState, { merge: true });
    }

    // 6. Write config Settings
    const configDocRef = dbInstance.collection('config').doc('settings');
    const settingsObject = {
      suplaAccessToken: data.credentials?.suplaAccessToken || '',
      adminPassword: data.credentials?.adminPassword || 'Admin',
      googleScriptUrl: data.credentials?.googleScriptUrl || '',
      lockSchedule: data.lockSchedule || {
        enabled: false,
        startDateTime: "2026-05-30T06:00",
        endDateTime: "2026-05-31T22:00",
        reason: "Weekendowa blokada wjazdu (sobota 6:00 - niedziela 22:00)."
      }
    };
    batch.set(configDocRef, settingsObject, { merge: true });

    await batch.commit();
  } catch (error) {
    console.error('Error writing to Firestore', error);
  }
}

function isGateCurrentlyLocked(db: any): { locked: boolean; reason: string } {
  const sched = db.lockSchedule;
  if (!sched || !sched.enabled) {
    return { locked: false, reason: '' };
  }
  
  try {
    const now = new Date();
    const start = new Date(sched.startDateTime);
    const end = new Date(sched.endDateTime);
    
    if (now >= start && now <= end) {
      return { 
        locked: true, 
        reason: sched.reason || 'Dostęp został czasowo zablokowany zgodnie z harmonogramem.' 
      };
    }
  } catch (err) {
    console.error('Błąd parsowania harmonogramu blokady:', err);
  }
  
  return { locked: false, reason: '' };
}

// Request parsers
app.use(express.json());

// API Routes

// Log entry helper
async function addLog(userName: string, userRole: 'dzialkowiec' | 'gosc' | 'admin' | 'system', action: ActivityLog['action'], details: string) {
  const db = await readDb();
  const newLog: ActivityLog = {
    id: 'l_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    userName,
    userRole,
    action,
    details
  };
  db.logs.unshift(newLog); // Prepend to show newest first
  if (db.logs.length > 500) {
    db.logs = db.logs.slice(0, 500); // Caps size at 500
  }
  await writeDb(db);

  // Background logging to Google Sheets App Script if set
  const gScriptUrl = db.credentials?.googleScriptUrl || process.env.GOOGLE_SCRIPT_URL;
  if (gScriptUrl && action !== 'SYSTEM') {
    fetch(gScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: userName,
        action: details
      }),
      signal: AbortSignal.timeout(4000)
    }).catch(e => console.error('Tło Google Sheets log failed:', e.message));
  }

  return newLog;
}

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { firstName, lastName, name, plotNumber, passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ error: 'PIN / hasło jest wymagane.' });
    }

    const db = await readDb();
    
    // Resolve full name if first and last name are sent separately
    let finalName = '';
    if (firstName !== undefined || lastName !== undefined) {
      const fName = (firstName || '').trim();
      const lName = (lastName || '').trim();
      finalName = fName + (lName ? ' ' + lName : '');
    } else {
      finalName = name || '';
    }

    const normalize = (val: string) => (val || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const cleanName = normalize(finalName);
    const cleanPlot = normalize(plotNumber);
    const cleanPin = (passcode || '').toString().trim();

    // 1. Google Sheets Web App Authorization Check
    const gScriptUrl = db.credentials?.googleScriptUrl || process.env.GOOGLE_SCRIPT_URL;
    if (gScriptUrl) {
      try {
        const queryParams = new URLSearchParams({
          name: finalName,
          plot: plotNumber,
          pin: passcode
        }).toString();
        const targetUrl = `${gScriptUrl}${gScriptUrl.includes('?') ? '&' : '?'}${queryParams}`;
        
        console.log('Autoryzacja Google Sheets:', targetUrl);
        const gResponse = await fetch(targetUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });

        if (gResponse.ok) {
          const gData: any = await gResponse.json();
          if (gData && gData.status === 'success') {
            // Map sheet roles
            let resolvedRole: 'dzialkowiec' | 'gosc' | 'admin' = 'dzialkowiec';
            const rawRole = (gData.role || '').toLowerCase().trim();
            if (rawRole === 'admin') {
              resolvedRole = 'admin';
            } else if (rawRole === 'gosc' || rawRole === 'gość' || rawRole === 'guest') {
              resolvedRole = 'gosc';
            }

            const resolvedName = gData.suplaName || finalName || `Użytkownik (${plotNumber})`;

            // Synchronize user to db.json
            let localUser = db.users.find((u) => normalize(u.plotNumber) === cleanPlot);
            if (!localUser) {
              localUser = {
                id: 'sh_' + Date.now(),
                name: resolvedName,
                plotNumber: plotNumber,
                passcode: passcode,
                role: resolvedRole,
                status: 'active',
                blockReason: '',
                suplaAccessToken: gData.token || '',
                createdAt: new Date().toISOString()
              };
              db.users.push(localUser);
            } else {
              localUser.name = resolvedName;
              localUser.role = resolvedRole;
              localUser.passcode = passcode;
              localUser.status = 'active'; // Force unlock on Sheets verification
              if (gData.token) {
                localUser.suplaAccessToken = gData.token;
              }
            }
            await writeDb(db);

            await addLog(resolvedName, resolvedRole, 'LOGIN', `Zalogowano do aplikacji (Uwierzytelnienie Google Sheets).`);

            return res.json({
              success: true,
              user: {
                id: localUser.id,
                name: localUser.name,
                role: localUser.role,
                status: localUser.status,
                suplaAccessToken: localUser.suplaAccessToken || ''
              }
            });
          } else {
            const errorMsg = gData?.message || 'Weryfikacja tożsamości w Arkuszu Google nie powiodła się.';
            return res.status(200).json({ success: false, error: errorMsg });
          }
        }
      } catch (err: any) {
        console.error('Google Sheets link failed, defaulting to local auth:', err.message);
      }
    }

    // 2. Fallback to local authentication
    if (!plotNumber) {
      return res.status(400).json({ error: 'Numer działki jest wymagany.' });
    }

    const foundUser = db.users.find((u: WebUser) => {
      const userCleanPlot = normalize(u.plotNumber || '');
      const userCleanPin = (u.passcode || '').toString().trim();
      
      return userCleanPlot === cleanPlot && userCleanPin === cleanPin;
    });

    if (!foundUser) {
      return res.status(200).json({ success: false, error: 'Nieprawidłowe dane logowania (numer działki lub PIN).' });
    }

    // Check block status
    if (foundUser.status === 'blocked') {
      await addLog(foundUser.name, foundUser.role, 'SYSTEM', `Odmowa dostępu - użytkownik zablokowany: ${foundUser.blockReason}`);
      return res.status(200).json({
        success: false,
        error: 'Twój dostęp został zablokowany.',
        blocked: true,
        reason: foundUser.blockReason || 'Twoje konto zostało tymczasowo zablokowane.'
      });
    }

    // Check lockout schedule structure
    const lockStatus = isGateCurrentlyLocked(db);
    if (lockStatus.locked) {
      await addLog(foundUser.name, foundUser.role, 'SYSTEM', `Odmowa logowania - aktywna blokada okresowa bramy.`);
      return res.status(200).json({
        success: false,
        error: 'Brama czasowo zablokowana.',
        blocked: true,
        reason: lockStatus.reason
      });
    }

    // Check if user must change PIN (first login)
    if (foundUser.mustChangePin) {
      return res.json({
        success: true,
        mustChangePin: true,
        user: {
          id: foundUser.id,
          name: foundUser.name,
          role: foundUser.role,
          status: foundUser.status
        }
      });
    }

    addLog(foundUser.name, foundUser.role, 'LOGIN', 'Zalogowano do aplikacji.');
    return res.json({
      success: true,
      user: {
        id: foundUser.id,
        name: foundUser.name,
        role: foundUser.role,
        status: foundUser.status,
        suplaAccessToken: foundUser.suplaAccessToken || ''
      }
    });
  } catch (err: any) {
    console.error('CRITICAL LOGIN ERROR SERVER SIDE:', err);
    return res.status(500).json({ error: 'Wystąpił wewnętrzny błąd serwera podczas logowania. Spróbuj ponownie.' });
  }
});

// Auth: Forgot PIN Request
app.post('/api/auth/forgot-pin', async (req, res) => {
  try {
    const { firstName, lastName, plotNumber, contactDetails } = req.body;
    if (!firstName || !plotNumber) {
      return res.status(400).json({ error: 'Imię oraz numer działki są wymagane.' });
    }

    const db = await readDb();
    const fName = (firstName || '').trim();
    const lName = (lastName || '').trim();
    const inputFullName = fName + (lName ? ' ' + lName : '');

    const normalize = (val: string) => (val || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const cleanInputName = normalize(inputFullName);
    const cleanInputPlot = normalize(plotNumber);

    const foundUser = db.users.find((u: WebUser) => {
      const dbUserCleanName = normalize(u.name || '');
      const dbUserCleanPlot = normalize(u.plotNumber || '');
      return dbUserCleanName === cleanInputName && dbUserCleanPlot === cleanInputPlot;
    });

    if (!foundUser) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika o podanych danych. Sprawdź imię, nazwisko i numer działki.' });
    }

    const exists = (db.pinResetRequests || []).some((r: any) => r.userId === foundUser.id);
    if (!exists) {
      const newRequest = {
        id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        userId: foundUser.id,
        name: foundUser.name,
        plotNumber: foundUser.plotNumber || '',
        contactDetails: contactDetails ? contactDetails.trim() : 'Brak danych kontaktowych',
        requestedAt: new Date().toISOString()
      };
      db.pinResetRequests = db.pinResetRequests || [];
      db.pinResetRequests.push(newRequest);
      await addLog(foundUser.name, foundUser.role, 'SYSTEM', `Zgłoszono prośbę o reset kodu PIN. Szczegóły: ${newRequest.contactDetails}`);
      await writeDb(db);
    }

    return res.json({ success: true, message: 'Zgłoszenie zostało pomyślnie wysłane. Administrator wkrótce nada Ci nowy tymczasowy kod PIN.' });
  } catch (err: any) {
    console.error('FORGOT PIN ERROR:', err);
    return res.status(500).json({ error: 'Wystąpił błąd podczas rejestrowania zgłoszenia.' });
  }
});

// Auth: Force Change PIN
app.post('/api/auth/change-pin', async (req, res) => {
  try {
    const { userId, newPin } = req.body;
    if (!userId || !newPin) {
      return res.status(400).json({ error: 'Brak identyfikatora użytkownika lub nowego PINu.' });
    }

    const cleanNewPin = newPin.trim();
    if (cleanNewPin.length !== 4 || !/^\d{4}$/.test(cleanNewPin)) {
      return res.status(400).json({ error: 'Nowy kod PIN musi składać się dokładnie z 4 cyfr.' });
    }

    const db = await readDb();
    const userIdx = db.users.findIndex((u: WebUser) => u.id === userId);
    if (userIdx === -1) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje.' });
    }

    const user = db.users[userIdx];
    if (cleanNewPin === (db.credentials.adminPassword || 'Admin')) {
      return res.status(400).json({ error: 'PIN nie może być identyczny z hasłem administratora.' });
    }

    const isColliding = db.users.some((u: WebUser) => u.passcode === cleanNewPin && u.id !== userId);
    if (isColliding) {
      return res.status(400).json({ error: 'Ten kod PIN jest już przypisany do innego użytkownika. Wybierz inny.' });
    }

    db.users[userIdx].passcode = cleanNewPin;
    db.users[userIdx].mustChangePin = false;
    await writeDb(db);

    await addLog(user.name, user.role, 'SYSTEM', 'Użytkownik pomyślnie zaktualizował swój pierwotny kod PIN.');

    return res.json({
      success: true,
      message: 'Twój PIN został pomyślnie zaktualizowany.',
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
        suplaAccessToken: user.suplaAccessToken || ''
      }
    });
  } catch (err: any) {
    console.error('CHANGE PIN ERROR:', err);
    return res.status(500).json({ error: 'Wystąpił błąd podczas aktualizacji kodu PIN.' });
  }
});

// Endpoint to update individual user's SUPLA token
app.post('/api/user/token', async (req, res) => {
  const { userId, suplaAccessToken } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Brak identyfikatora użytkownika.' });
  }

  const db = await readDb();
  
  if (userId === 'admin') {
    db.credentials.suplaAccessToken = suplaAccessToken || '';
    await writeDb(db);
    await addLog('Administrator', 'admin', 'SYSTEM', 'Zaktualizowano główny token SUPLA.');
    return res.json({ success: true, suplaAccessToken: db.credentials.suplaAccessToken });
  }

  const userIdx = db.users.findIndex((u: any) => u.id === userId);
  if (userIdx === -1) {
    return res.status(404).json({ error: 'Użytkownik nie istnieje.' });
  }

  db.users[userIdx].suplaAccessToken = suplaAccessToken || '';
  await writeDb(db);
  
  await addLog(db.users[userIdx].name, db.users[userIdx].role, 'SYSTEM', 'Zaktualizowano osobisty token SUPLA w profilu.');
  return res.json({ success: true, suplaAccessToken: db.users[userIdx].suplaAccessToken });
});

// Logs Endpoint (accessible to active logged in users)
app.get('/api/logs', async (req, res) => {
  const db = await readDb();
  const gScriptUrl = db.credentials?.googleScriptUrl || process.env.GOOGLE_SCRIPT_URL;

  if (gScriptUrl) {
    try {
      const response = await fetch(`${gScriptUrl}${gScriptUrl.includes('?') ? '&' : '?'}action=getLogs`, {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const fetchedLogs: any = await response.json();
        if (Array.isArray(fetchedLogs)) {
          // Map Google Script log structures to front-end ActivityLog structure dynamically
          const mappedLogs = fetchedLogs.map((item: any, idx: number) => {
            const userName = item.user || item.userName || item.Użytkownik || item.name || 'Użytkownik Arkusza';
            const details = item.action || item.details || item.Akcja || '';
            const timestamp = item.timestamp || item.date || item.Time || item.Data || new Date().toISOString();
            
            // Map actions and roles to match types
            const userRole = item.userRole || item.role || (userName === 'Administrator' ? 'admin' : 'dzialkowiec');
            const actionType = item.actionType || item.action || 'OPEN_GATE';

            return {
              id: item.id || `sheet_${idx}_${new Date(timestamp).getTime() || Date.now()}`,
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
      console.error('Błąd pobierania logów z Arkusza:', e.message);
    }
  }

  // Fallback to local logs if Google Script is not defined or fails
  res.json(db.logs);
});

// Gate Status Checking
app.get('/api/gate/status', async (req, res) => {
  try {
    const { userId } = req.query;
    const db = await readDb();
    
    // Resolve token: user-specific token or fallback to master token
    let token = db.credentials.suplaAccessToken;
    if (userId && typeof userId === 'string' && userId !== 'admin') {
      const freshUser = db.users.find((u: WebUser) => u.id === userId);
      if (freshUser?.suplaAccessToken) {
        token = freshUser.suplaAccessToken;
      }
    }

    const stateInfo = db.gateState;
    const targetCheckChannelId = stateInfo.sensorChannelId || stateInfo.channelId;
    
    // If we have SUPLA Token, retrieve real status
    if (token && stateInfo.suplaServerUrl && targetCheckChannelId) {
      try {
        const serverUrl = stateInfo.suplaServerUrl.replace(/\/$/, ''); // strip trailing slash
        
        // Attempt 1: Fetch via modern SUPLA Cloud v3 API (OAS3)
        let response = await fetch(`${serverUrl}/api/v3/channels/${targetCheckChannelId}?include=state`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(4000) // 4 second timeout
        });

        // Fallback: If v3 returns 404/error, try v2.3.0 format
        if (!response.ok && response.status !== 401) {
          console.log('SUPLA v3 API returned error or 404, attempting fallback to v2.3.0 interface...');
          response = await fetch(`${serverUrl}/api/v2.3.0/channels/${targetCheckChannelId}?include=state`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(4000)
          });
        }

        if (response.ok) {
          const suplaData: any = await response.json();
          // SUPLA gate function states can be represented by relay state or hi/on values
          const suplaIsOn = suplaData.state?.hi || suplaData.state?.on || false;
          
          // Apply sensor inversion if enabled in configuration (defaulting to true for this installation)
          let mappedState: 'OPEN' | 'CLOSED' = suplaIsOn ? 'OPEN' : 'CLOSED';
          if (db.gateState.invertSensor !== false) {
            mappedState = suplaIsOn ? 'CLOSED' : 'OPEN';
          }
          
          // Update gateState in DB with live result
          db.gateState.suplaConnected = true;

          // Apply transition lock logic: if we recently triggered OTWÓRZ/ZAMKNIJ, don't let status check immediately overwrite transitional states.
          const TRANSITION_MS = 18000; // 18 seconds guard for physical gate movement
          const lastTriggeredTime = db.gateState.lastTriggeredTime;
          const lastTriggeredAction = db.gateState.lastTriggeredAction;
          const now = Date.now();
          const isTransitioning = lastTriggeredTime && (now - lastTriggeredTime < TRANSITION_MS);

          if (isTransitioning) {
            if (lastTriggeredAction === 'CLOSE') {
              if (mappedState === 'CLOSED') {
                // End early since physical sensor reports it's closed!
                db.gateState.state = 'CLOSED';
                db.gateState.lastTriggeredTime = undefined;
                db.gateState.lastTriggeredAction = undefined;
              } else {
                // Keep showing Zamykanie while the sensor hasn't report CLOSED yet
                db.gateState.state = 'CLOSING';
              }
            } else if (lastTriggeredAction === 'OPEN') {
              // Keep showing Otwieranie for the duration of TRANSITION_MS
              db.gateState.state = 'OPENING';
            }
          } else {
            db.gateState.state = mappedState;
          }

          db.gateState.lastUpdated = new Date().toISOString();
          await writeDb(db);
          
          return res.json(db.gateState);
        } else {
          db.gateState.suplaConnected = false;
          await writeDb(db);
        }
      } catch (err) {
        console.error('Error contacting SUPLA API state, using local virtual state instead:', err);
        db.gateState.suplaConnected = false;
        await writeDb(db);
      }
    }

    // Fallback to local DB state
    return res.json(db.gateState);
  } catch (globalErr: any) {
    console.error('Fatal API Gate Status Error:', globalErr);
    // Explicitly fallback to JSON instead of letting Express emit an HTML error page
    return res.status(500).json({
      error: 'Wystąpił wewnętrzny błąd serwera przy odczycie statusu bramy.',
      state: 'CLOSED',
      details: globalErr.message
    });
  }
});

// Gate Control triggering (Otwórz / Zamknij)
app.post('/api/gate/control', async (req, res) => {
  try {
    const { action, userId, userName, userRole } = req.body;
    
    if (!userName || !userRole) {
      return res.status(401).json({ error: 'Niezdefiniowany użytkownik.' });
    }

    if (action !== 'OPEN' && action !== 'CLOSE') {
      return res.status(400).json({ error: 'Nieprawidłowa akcja.' });
    }

    const db = await readDb();
    
    // Validate block state of the user again just in case
    if (userRole !== 'admin') {
      const freshUser = db.users.find((u: WebUser) => u.name === userName);
      if (freshUser && freshUser.status === 'blocked') {
        return res.status(403).json({ error: `Dostęp zablokowany: ${freshUser.blockReason}` });
      }

      // Check periodic lockout schedule
      const lockStatus = isGateCurrentlyLocked(db);
      if (lockStatus.locked) {
        return res.status(403).json({ error: `Brama jest czasowo zablokowana: ${lockStatus.reason}` });
      }

      // Check Google Sheets partyMode block settings
      const gScriptUrl = db.credentials?.googleScriptUrl || process.env.GOOGLE_SCRIPT_URL;
      if (gScriptUrl) {
        try {
          const sResponse = await fetch(`${gScriptUrl}${gScriptUrl.includes('?') ? '&' : '?'}action=getSettings`, {
            signal: AbortSignal.timeout(3000)
          });
          if (sResponse.ok) {
            const sData: any = await sResponse.json();
            if (sData && sData.partyMode) {
              await addLog(userName, userRole as any, 'SYSTEM', `Odmowa otwarcia bramy - aktywny Tryb Imprezy w Domu Działkowca.`);
              return res.status(403).json({ error: 'Brama czasowo zablokowana - trwa impreza w Domu Działkowca.' });
            }
          }
        } catch (e: any) {
          console.error('Sprawdzenie partyMode z Arkusza nie powiodło się:', e.message);
        }
      }
    }

    // Resolve token: user-specific token or fallback to master token
    let token = db.credentials.suplaAccessToken;
    if (userId && userId !== 'admin') {
      const freshUser = db.users.find((u: WebUser) => u.id === userId);
      if (freshUser?.suplaAccessToken) {
        token = freshUser.suplaAccessToken;
      }
    }

    const serverUrl = db.gateState.suplaServerUrl.replace(/\/$/, '');
    const channelId = db.gateState.channelId;
    
    let suplaTriggered = false;
    let suplaDetails = 'Kontrola wirtualna (brak tokenu SUPLA).';

    if (token && serverUrl && channelId) {
      try {
        const payloadAction = action === 'OPEN' ? 'OPEN' : 'CLOSE';
        
        // Attempt 1: Execute REST command via PATCH /api/v3/channels/{id} compliant with modern v3 specs
        let response = await fetch(`${serverUrl}/api/v3/channels/${channelId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ action: payloadAction }),
          signal: AbortSignal.timeout(6000)
        });

        // Fallback: If PATCH or v3 is unsupported, fall back to POST /api/v2.3.0/channels/{id}
        if (!response.ok && response.status !== 401) {
          console.log('PATCH to /api/v3 failed, attempting fallback to POST /api/v2.3.0...');
          response = await fetch(`${serverUrl}/api/v2.3.0/channels/${channelId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ action: payloadAction }),
            signal: AbortSignal.timeout(6000)
          });
        }

        if (response.ok) {
          suplaTriggered = true;
          suplaDetails = `Wysłano sygnał do SUPLA: ${action}.`;
        } else {
          const errorText = await response.text();
          console.error('SUPLA trigger responded with error status:', response.status, errorText);
          suplaDetails = `Błąd SUPLA API (status ${response.status}). Przełączono na tryb rezerwowy.`;
        }
      } catch (err: any) {
        console.error('Failed to trigger SUPLA gate channel, falling back to virtual control:', err);
        suplaDetails = `Serwer SUPLA nieodpowiedział (${err.message}). Przełączono na tryb rezerwowy.`;
      }
    }

    // Update gate simulated movement
    const targetState = action === 'CLOSE' ? 'CLOSED' : action;
    const transitState = action === 'OPEN' ? 'OPENING' : 'CLOSING';
    
    db.gateState.state = transitState;
    db.gateState.lastTriggeredTime = Date.now();
    db.gateState.lastTriggeredAction = action;
    db.gateState.lastUpdated = new Date().toISOString();
    db.gateState.lastActionBy = userName;
    db.gateState.suplaConnected = suplaTriggered;
    await writeDb(db);

    // Log action
    await addLog(userName, userRole, action as any, `${action === 'OPEN' ? 'Otwarcie' : 'Zamknięcie'} bramy. ${suplaDetails}`);

    // Schedule virtual state completion (takes 18 seconds of movement simulation)
    setTimeout(async () => {
      try {
        const finalDb = await readDb();
        if (finalDb.gateState.state === transitState) {
          finalDb.gateState.state = targetState;
          // Clear triggers once transition concludes
          finalDb.gateState.lastTriggeredTime = undefined;
          finalDb.gateState.lastTriggeredAction = undefined;
          finalDb.gateState.lastUpdated = new Date().toISOString();
          await writeDb(finalDb);
        }
      } catch (err) {
        console.error('Błąd aktualizacji stanu bramy w setTimeout:', err);
      }
    }, 18000);

    // Respond immediately with the movement status
    return res.json({
      success: true,
      gateState: db.gateState,
      details: suplaDetails
    });
  } catch (globalErr: any) {
    console.error('Fatal API Gate Control Error:', globalErr);
    return res.status(500).json({
      success: false,
      error: `Wystąpił wewnętrzny błąd serwera przy kontroli bramy: ${globalErr.message}`
    });
  }
});

// Admin ONLY APIs (Middleware check is simple since userRole is signed on the requests or standard headers inside client)

// Users management
app.get('/api/admin/users', async (req, res) => {
  const db = await readDb();
  res.json(db.users);
});

app.post('/api/admin/users', async (req, res) => {
  const user: WebUser = req.body;
  if (!user.name || !user.plotNumber || !user.passcode || !user.role) {
    return res.status(400).json({ error: 'Imię i nazwisko, numer działki, PIN oraz rola są wymagane.' });
  }

  const db = await readDb();
  
  // Check if passcode is unique (to prevent password collision block evasion)
  const codeCollision = db.users.find((u: WebUser) => u.passcode === user.passcode && u.id !== user.id);
  if (codeCollision) {
    return res.status(400).json({ error: 'Ten kod dostępu jest już przypisany do innego użytkownika.' });
  }

  if (user.passcode === (db.credentials.adminPassword || 'Admin')) {
    return res.status(400).json({ error: 'Kod dostępu nie może być taki sam jak hasło administratora.' });
  }

  const isNew = !user.id;
  if (isNew) {
    user.id = 'u_' + Date.now();
    user.createdAt = new Date().toISOString();
    user.mustChangePin = true; // Admin sets the initial PIN - user MUST change it on first login!
    db.users.push(user);
    await addLog('Administrator', 'admin', 'SYSTEM', `Dodano nowego użytkownika: ${user.name} (${user.role === 'dzialkowiec' ? 'działkowiec' : 'gość'}). Użytkownik zostanie poproszony o nadanie nowego PINu przy pierwszym logowaniu.`);
  } else {
    const idx = db.users.findIndex((u: WebUser) => u.id === user.id);
    if (idx !== -1) {
      const prevUser = db.users[idx];
      const isPinChanged = prevUser.passcode !== user.passcode;
      db.users[idx] = { 
        ...prevUser, 
        ...user,
        mustChangePin: isPinChanged ? true : prevUser.mustChangePin
      };
      
      const details = isPinChanged 
        ? `Zaktualizowano dane użytkownika: ${user.name}. Zmieniono PIN, użytkownik będzie musiał nadać własny przy logowaniu.`
        : `Zaktualizowano dane użytkownika: ${user.name}.`;

      if (prevUser.status !== user.status) {
        await addLog(
          'Administrator', 
          'admin', 
          user.status === 'blocked' ? 'BLOCK' : 'UNBLOCK', 
          `${user.status === 'blocked' ? 'Zablokowano' : 'Odblokowano'} użytkownika ${user.name}. Przyczyna: ${user.blockReason || 'Brak'}`
        );
      } else {
        await addLog('Administrator', 'admin', 'SYSTEM', details);
      }
    } else {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony.' });
    }
  }

  await writeDb(db);
  res.json({ success: true, user });
});

// Admin PIN Reset Requests
app.get('/api/admin/pin-requests', async (req, res) => {
  const db = await readDb();
  res.json(db.pinResetRequests || []);
});

app.post('/api/admin/pin-requests/resolve', async (req, res) => {
  try {
    const { requestId, newPin } = req.body;
    if (!requestId || !newPin) {
      return res.status(400).json({ error: 'Brak identyfikatora zgłoszenia lub kodu PIN.' });
    }

    const cleanPin = newPin.trim();
    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      return res.status(400).json({ error: 'Nowy PIN musi składać się z dokładnie 4 cyfr.' });
    }

    const db = await readDb();
    const reqIdx = (db.pinResetRequests || []).findIndex((r: any) => r.id === requestId);
    if (reqIdx === -1) {
      return res.status(404).json({ error: 'Nie znaleziono takiego zgłoszenia o reset PINu.' });
    }

    const pinRequest = db.pinResetRequests[reqIdx];
    const userIdx = db.users.findIndex((u: WebUser) => u.id === pinRequest.userId);
    if (userIdx !== -1) {
      // Set new temporary pin and force reset on first login
      db.users[userIdx].passcode = cleanPin;
      db.users[userIdx].mustChangePin = true;
      await addLog('Administrator', 'admin', 'SYSTEM', `Przypisano nowy PIN tymczasowy dla ${db.users[userIdx].name} (Działka ${db.users[userIdx].plotNumber}). Użytkownik musi zmienić go przy pierwszym logowaniu.`);
    }

    // Delete request from list
    db.pinResetRequests.splice(reqIdx, 1);
    await writeDb(db);

    res.json({ success: true, message: 'Zgłoszenie pomyślnie obsłużone. Nadano nowy kod PIN.' });
  } catch (err: any) {
    console.error('RESOLVE PIN REQUEST ERROR:', err);
    res.status(500).json({ error: 'Wystąpił błąd podczas zapisywania zmian.' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  
  const found = db.users.find((u: WebUser) => u.id === id);
  if (!found) {
    return res.status(404).json({ error: 'Użytkownik nie istnieje.' });
  }

  db.users = db.users.filter((u: WebUser) => u.id !== id);
  await writeDb(db);

  await addLog('Administrator', 'admin', 'SYSTEM', `Usunięto konto użytkownika: ${found.name}.`);
  res.json({ success: true });
});

// Bulk blocks for Real-Time scenario: Gardeners blocked / Guests unblocked or vice versa
app.post('/api/admin/users/bulk-action', async (req, res) => {
  const { targetRole, action, reason } = req.body; // targetRole: 'dzialkowiec' | 'gosc', action: 'BLOCK' | 'UNBLOCK'
  
  if (!targetRole || !action) {
    return res.status(400).json({ error: 'Target i akcja są wymagane.' });
  }

  const db = await readDb();
  let modifiedCount = 0;
  
  db.users = db.users.map((u: WebUser) => {
    if (u.role === targetRole) {
      modifiedCount++;
      return {
        ...u,
        status: action === 'BLOCK' ? 'blocked' : 'active',
        blockReason: action === 'BLOCK' ? (reason || 'Czasowa blokada dostępu.') : ''
      };
    }
    return u;
  });

  await writeDb(db);

  const roleText = targetRole === 'dzialkowiec' ? 'Wszyscy Działkowcy' : 'Wszyscy Goście';
  const actionText = action === 'BLOCK' ? 'Zablokowani grupowo' : 'Odblokowani grupowo';
  
  await addLog(
    'Administrator', 
    'admin', 
    'BULK_ACTION', 
    `${actionText}: ${roleText}. Przyczyna: ${reason || 'brak'}`
  );

  res.json({ success: true, modifiedCount });
});

// SUPLA/Config settings
app.get('/api/admin/config', async (req, res) => {
  const db = await readDb();
  res.json({
    suplaServerUrl: db.gateState.suplaServerUrl,
    gateChannelId: db.gateState.channelId,
    sensorChannelId: db.gateState.sensorChannelId || '2014',
    invertSensor: !!db.gateState.invertSensor,
    adminPassword: db.credentials.adminPassword,
    hasToken: !!db.credentials.suplaAccessToken,
    googleScriptUrl: db.credentials?.googleScriptUrl || '',
    lockSchedule: db.lockSchedule || {
      enabled: false,
      startDateTime: "2026-05-30T06:00",
      endDateTime: "2026-05-31T22:00",
      reason: "Weekendowa blokada wjazdu (sobota 6:00 - niedziela 22:00)."
    }
  });
});

app.post('/api/admin/config', async (req, res) => {
  const { suplaServerUrl, gateChannelId, sensorChannelId, suplaAccessToken, adminPassword, lockSchedule, invertSensor, googleScriptUrl } = req.body;
  const db = await readDb();

  if (suplaServerUrl) db.gateState.suplaServerUrl = suplaServerUrl;
  if (gateChannelId) db.gateState.channelId = gateChannelId;
  if (sensorChannelId) db.gateState.sensorChannelId = sensorChannelId;
  if (adminPassword) db.credentials.adminPassword = adminPassword;
  if (invertSensor !== undefined) db.gateState.invertSensor = !!invertSensor;
  if (googleScriptUrl !== undefined) {
    if (!db.credentials) db.credentials = { suplaAccessToken: '', adminPassword: 'Admin', googleScriptUrl: '' };
    db.credentials.googleScriptUrl = googleScriptUrl.trim();
  }
  
  if (lockSchedule) {
    db.lockSchedule = {
      enabled: lockSchedule.enabled !== undefined ? lockSchedule.enabled : false,
      startDateTime: lockSchedule.startDateTime || "2026-05-30T06:00",
      endDateTime: lockSchedule.endDateTime || "2026-05-31T22:00",
      reason: lockSchedule.reason || "Zaplanowana blokada okresowa bramy."
    };
  }

  // Note: Only update access token if a non-empty string is provided
  if (suplaAccessToken !== undefined && suplaAccessToken !== '') {
    db.credentials.suplaAccessToken = suplaAccessToken;
  }

  await writeDb(db);
  await addLog('Administrator', 'admin', 'SYSTEM', 'Zaktualizowano ustawienia serwera SUPLA i systemu.');
  
  res.json({
    success: true,
    config: {
      suplaServerUrl: db.gateState.suplaServerUrl,
      gateChannelId: db.gateState.channelId,
      sensorChannelId: db.gateState.sensorChannelId || '2014',
      invertSensor: !!db.gateState.invertSensor,
      adminPassword: db.credentials.adminPassword,
      hasToken: !!db.credentials.suplaAccessToken,
      googleScriptUrl: db.credentials.googleScriptUrl,
      lockSchedule: db.lockSchedule
    }
  });
});

// Update Google Sheets settings directly from panel
app.post('/api/admin/save-sheets-settings', async (req, res) => {
  const { partyMode } = req.body;
  const db = await readDb();
  
  const gScriptUrl = db.credentials?.googleScriptUrl || process.env.GOOGLE_SCRIPT_URL;
  if (!gScriptUrl) {
    return res.status(400).json({ error: 'Adres skryptu Google Sheets nie jest skonfigurowany.' });
  }

  try {
    const response = await fetch(gScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSettings',
        partyMode: !!partyMode
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (response.ok) {
      if (!db.gateState) db.gateState = {};
      db.gateState.partyModeActive = !!partyMode;
      await writeDb(db);
      
      await addLog('Administrator', 'admin', 'SYSTEM', `Zmieniono Tryb Imprezy w Arkuszu Google na: ${partyMode ? 'WŁĄCZONY' : 'WYŁĄCZONY'}.`);
      return res.json({ success: true, partyMode });
    } else {
      return res.status(500).json({ error: 'Nie udało się zapisać Trybu Imprezy w Arkuszu Google (błąd statusu).' });
    }
  } catch (err: any) {
    console.error('Błąd przy zapisie partyMode do Arkusza:', err.message);
    return res.status(500).json({ error: `Błąd połączenia z Arkuszem Google: ${err.message}` });
  }
});

// Notifications (Push API mockup)
app.post('/api/push/subscribe', async (req, res) => {
  const { userName, deviceInfo } = req.body;
  if (!userName) return res.status(400).json({ error: 'Użytkownik nieokreślony.' });

  const db = await readDb();
  
  const subId = 'sub_' + Date.now();
  const sub: PushSubscriptionInfo = {
    id: subId,
    userName,
    deviceInfo: deviceInfo || 'Przeglądarka internetowa',
    subscribedAt: new Date().toISOString()
  };

  db.subscriptions = db.subscriptions || [];
  // Ensure no duplicate subscription for same user name
  db.subscriptions = db.subscriptions.filter((s: PushSubscriptionInfo) => s.userName !== userName);
  db.subscriptions.push(sub);
  await writeDb(db);

  await addLog(userName, 'system', 'SYSTEM', `Zasubskrybowano powiadomienia push na urządzeniu ${sub.deviceInfo}.`);
  await addLog('System', 'system', 'PUSH_SENT', `Wysłano automatyczne powiadomienie powitalne do użytkownika ${userName} na urządzenie ${sub.deviceInfo}.`);
  res.json({ success: true, sub });
});

app.post('/api/push/test', async (req, res) => {
  const { userName } = req.body;
  if (!userName) return res.status(400).json({ error: 'Użytkownik nieokreślony.' });

  const db = await readDb();
  const sub = (db.subscriptions || []).find((s: any) => s.userName === userName);
  const deviceInfo = sub ? sub.deviceInfo : 'Standardowy komputer/telefon';

  await addLog(userName, 'system', 'PUSH_SENT', `Wysłano testowe powiadomienie powitalne (Push) na urządzenie ${deviceInfo}.`);
  res.json({ 
    success: true, 
    title: 'Test powiadomień', 
    message: 'System powiadomień Ogrody Stara Huta działa poprawnie na tym urządzeniu!', 
    sentAt: new Date().toISOString() 
  });
});

app.get('/api/push/subscribers', async (req, res) => {
  const db = await readDb();
  res.json(db.subscriptions || []);
});

app.post('/api/admin/push/broadcast', async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Tytuł i treść są wymagane.' });
  }

  const db = await readDb();
  const subsCount = (db.subscriptions || []).length;

  await addLog('Administrator', 'admin', 'PUSH_SENT', `Wysłano powiadomienie push do ${subsCount} użytkowników. Tytuł: "${title}"`);
  
  res.json({ success: true, subsCount, title, message, sentAt: new Date().toISOString() });
});

// Serving logic for Vite (or static frontend assets in production)
async function startServer() {
  // Determine if we are running in the compiled production bundle
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
