/**
 * Ogrody Stara Huta - Google Apps Script Backend
 * 
 * Instrukcja wdrożenia:
 * 1. Otwórz swój Arkusz Google.
 * 2. W menu u góry wybierz: Rozszerzenia -> Apps Script.
 * 3. Usuń domyślny kod i wklej poniższy skrypt.
 * 4. Upewnij się, że w swoim Arkuszu masz trzy karty (zakładki) o nazwach:
 *    - "Użytkownicy" lub "Uzytkownicy" (Kolumny: Imię, Nazwisko, Numer działki, Nazwa z SUPLA, Token, PIN, Rola)
 *    - "Logi" (Kolumny: Data i Godzina, Użytkownik, Akcja, Szczegóły)
 *    - "Ustawienia" (Kolumny: Klucz, Wartość) — wpisz tam w komórce A2: "partyMode", a w B2: "FALSE"
 * 5. Kliknij przycisk "Wdróż" (u góry po prawej) -> "Nowe wdrożenie".
 * 6. Wybierz typ: "Aplikacja internetowa" (Web App).
 * 7. Opis: "Gate Remote Web App"
 * 8. Wykonaj jako: "Ja" (Twój e-mail)
 * 9. Kto ma dostęp: "Każdy" (Anyone) — TO JEST KLUCZOWE, aby serwer mógł wysyłać zapytania weryfikacyjne i logować akcje.
 * 10. Kliknij "Wdróż", zezwól na uprawnienia konta Google, skopiuj wygenerowany "Adres URL aplikacji internetowej"
 *     i wklej go do pliku .env jako zmienną: GOOGLE_SCRIPT_URL
 */

// Funkcja czyszcząca wartości wpisane w arkuszu (usuwa końcówki numeryczne .0 i spacje)
function cleanVal(v) {
  if (v === undefined || v === null) return "";
  let str = String(v).trim();
  if (str.endsWith(".0")) {
    str = str.substring(0, str.length - 2);
  }
  return str;
}

// Bezpieczne sprawdzanie i ładowanie poprawnego arkusza użytkowników (niezależnie od kodowania znaków PL)
// Jeśli istnieje więcej niż jedna karta (np. "Użytkownicy" i "Uzytkownicy"), wybierana jest karta o największej liczbie wierszy.
function getUsersSheet(ss) {
  var names = ["Użytkownicy", "Uzytkownicy", "Uzytkownicy ", "Użytkownicy ", "Działkowcy", "Dzialkowcy", "Użytkownicy i Działkowcy", "Dzialki"];
  var candidateSheets = [];
  for (var i = 0; i < names.length; i++) {
    var sheet = ss.getSheetByName(names[i]);
    if (sheet) {
      candidateSheets.push(sheet);
    }
  }
  
  if (candidateSheets.length === 0) return null;
  if (candidateSheets.length === 1) return candidateSheets[0];
  
  // Wybieramy arkusz, który posiada najwięcej wierszy (czyli zawiera realne dane wpisane przez użytkownika)
  var bestSheet = candidateSheets[0];
  var maxRows = bestSheet.getLastRow();
  
  for (var j = 1; j < candidateSheets.length; j++) {
    var curSheet = candidateSheets[j];
    var curRows = curSheet.getLastRow();
    
    if (curRows > maxRows) {
      bestSheet = curSheet;
      maxRows = curRows;
    }
  }
  return bestSheet;
}

/**
 * Automatyczne dodawanie wygodnego menu zarządzania bezpośrednio w Arkuszu Google
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🔑 Sterowanie Bramą')
      .addItem('Wymuś wygenerowanie losowego PINu (zaznaczony wiersz)', 'generujLosowyPIN')
      .addToUi();
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    // Inicjalizacja arkuszy (automatyczne dodanie zakładek, jeśli brakuje)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    checkAndInitSheets(ss);
    
    // ACTION: login
    if (action === "login") {
      const firstName = cleanVal(e.parameter.firstName).toLowerCase();
      const plotNumber = cleanVal(e.parameter.plotNumber).toLowerCase();
      const pin = cleanVal(e.parameter.pin).toLowerCase();
      
      const sheet = getUsersSheet(ss);
      const rows = sheet.getDataRange().getValues();
      
      if (rows.length <= 1) {
        return jsonResponse({
          status: "error",
          message: "Arkusz użytkowników jest pusty (zawiera tylko wiersz nagłówka lub jest całkowicie pusty). Dodaj wiersze z danymi działkowców."
        });
      }
      
      const headers = rows[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
      
      // Dynamiczne dopasowanie indeksów kolumn po nagłówkach (ochrona przed przesunięciem)
      let colName = headers.findIndex(function(h) { return h.includes("imię") || h.includes("imie") || h === "name"; });
      let colPlot = headers.findIndex(function(h) { return h.includes("działk") || h.includes("dzialk") || h.includes("plot") || h.includes("numer"); });
      let colPin = headers.findIndex(function(h) { return h.includes("pin") || h.includes("kod"); });
      let colToken = headers.findIndex(function(h) { return h.includes("token"); });
      let colRole = headers.findIndex(function(h) { return h.includes("rola") || h.includes("role"); });
      let colSupla = headers.findIndex(function(h) { return h.includes("supla"); });
      let colStatus = headers.findIndex(function(h) { return h.includes("status") || h.includes("stan") || h.includes("blok"); });
      let colBlockReason = headers.findIndex(function(h) { return h.includes("przyczyna") || h.includes("powód") || h.includes("powod") || h.includes("reason"); });
      
      // Domyślne wartości (Fallback) jeśli nie uda się wykryć automatycznie
      if (colName === -1) colName = 0;   // Kolumna A (Imię)
      if (colPlot === -1) colPlot = 2;   // Kolumna C (Działka)
      if (colPin === -1) colPin = 5;     // Kolumna F (PIN)
      if (colToken === -1) colToken = 4; // Kolumna E (Token)
      if (colRole === -1) colRole = 6;   // Kolumna G (Rola)
      if (colSupla === -1) colSupla = 3; // Kolumna D (SUPLA)
      
      let debugMessage = "Nieprawidłowe dane logowania (imię, numer działki lub PIN).";
      
      // Przeszukiwanie wierszy (pomijamy nagłówek)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        const dbFirstName = cleanVal(row[colName]).toLowerCase();
        const dbPlot = cleanVal(row[colPlot]).toLowerCase();
        const dbPin = cleanVal(row[colPin]).toLowerCase();
        
        // Pomiń wiersz, jeśli zarówno imię, jak i numer działki są całkowicie puste
        if (!dbFirstName && !dbPlot) continue;
        
        if (dbPlot === plotNumber && dbFirstName === firstName) {
          const statusVal = colStatus !== -1 ? cleanVal(row[colStatus]).toLowerCase() : "";
          const blockReasonVal = colBlockReason !== -1 ? String(row[colBlockReason]).trim() : "";
          
          if (statusVal === "blocked" || statusVal === "zablokowany") {
            return jsonResponse({
              status: "blocked",
              message: "Twój dostęp został zablokowany przez administratora.",
              reason: blockReasonVal || "Nie podano przyczyny blokady."
            });
          }
          
          if (dbPin === pin) {
            const role = String(row[colRole] || "dzialkowiec").trim();
            const token = String(row[colToken] || "").trim();
            const suplaName = String(row[colSupla] || "").trim() || (row[colName] + " " + (row[1] || ""));
            
            return jsonResponse({
              status: "success",
              name: suplaName,
              role: role,
              token: token
            });
          }
        }
      }
      
      return jsonResponse({
        status: "error",
        message: debugMessage
      });
    }
    
    // ACTION: getSettings
    else if (action === "getSettings") {
      const settings = getAppSettings(ss);
      return jsonResponse(settings);
    }
    
    // ACTION: getUsers (Bezpieczna lista użytkowników dla panelu zarządcy)
    else if (action === "getUsers") {
      const sheet = getUsersSheet(ss);
      const rows = sheet.getDataRange().getValues();
      const users = [];
      
      if (rows.length > 0) {
        const headers = rows[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
        let colName = headers.findIndex(function(h) { return h.includes("imię") || h.includes("imie") || h === "name"; });
        let colLastName = headers.findIndex(function(h) { return h.includes("nazwisko") || h === "lastname"; });
        let colPlot = headers.findIndex(function(h) { return h.includes("działk") || h.includes("dzialk") || h.includes("plot") || h.includes("numer"); });
        let colSupla = headers.findIndex(function(h) { return h.includes("supla"); });
        let colToken = headers.findIndex(function(h) { return h.includes("token"); });
        let colPin = headers.findIndex(function(h) { return h.includes("pin") || h.includes("kod"); });
        let colRole = headers.findIndex(function(h) { return h.includes("rola") || h.includes("role"); });
        let colStatus = headers.findIndex(function(h) { return h.includes("status") || h.includes("stan") || h.includes("blok"); });
        let colBlockReason = headers.findIndex(function(h) { return h.includes("przyczyna") || h.includes("powód") || h.includes("powod") || h.includes("reason"); });
        
        if (colName === -1) colName = 0;
        if (colLastName === -1) colLastName = 1;
        if (colPlot === -1) colPlot = 2;
        if (colSupla === -1) colSupla = 3;
        if (colToken === -1) colToken = 4;
        if (colPin === -1) colPin = 5;
        if (colRole === -1) colRole = 6;
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const firstName = cleanVal(row[colName]);
          const lastName = colLastName !== -1 ? cleanVal(row[colLastName]) : "";
          const plot = cleanVal(row[colPlot]);
          const token = colToken !== -1 ? String(row[colToken]).trim() : "";
          const pin = colPin !== -1 ? cleanVal(row[colPin]) : "";
          const role = String(row[colRole] || "dzialkowiec").trim() || "dzialkowiec";
          
          let status = "active";
          if (colStatus !== -1) {
            const rawStatus = cleanVal(row[colStatus]).toLowerCase();
            if (rawStatus === "blocked" || rawStatus === "zablokowany") {
              status = "blocked";
            }
          }
          
          const blockReason = colBlockReason !== -1 ? String(row[colBlockReason]).trim() : "";
          
          if (firstName || lastName || plot) {
            users.push({
              firstName: firstName,
              lastName: lastName,
              name: (firstName + " " + lastName).trim() || "Nieznany",
              plotNumber: plot,
              suplaName: String(row[colSupla] || ""),
              token: token,
              pin: pin,
              role: role,
              status: status,
              blockReason: blockReason
            });
          }
        }
      }
      return jsonResponse(users);
    }
    
    // ACTION: getLogs
    else if (action === "getLogs") {
      const sheet = ss.getSheetByName("Logi");
      const rows = sheet.getDataRange().getValues();
      const logs = [];
      
      // Zwracamy najnowsze 100 logów (od końca)
      const startIdx = Math.max(1, rows.length - 100);
      for (let i = rows.length - 1; i >= startIdx; i--) {
        const row = rows[i];
        if (row[0]) {
          logs.push({
            timestamp: row[0],
            user: row[1],
            action: row[2],
            details: row[3]
          });
        }
      }
      return jsonResponse(logs);
    }
    
    return jsonResponse({ status: "error", message: "Nieznana akcja GET." });
    
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    checkAndInitSheets(ss);
    
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch(err) {
      // Fallback do standardowych parametrów na wypadek x-www-form-urlencoded
      data = e.parameter;
    }
    
    const action = data.action;
    
    // ACTION: addLog
    if (action === "addLog" || data.user) {
      const sheet = ss.getSheetByName("Logi");
      const user = data.user || "System";
      const actionText = data.actionText || data.action || "INFO";
      const details = data.details || "";
      
      sheet.appendRow([new Date(), user, actionText, details]);
      return jsonResponse({ status: "success", message: "Zalogowano pomyślnie w arkuszu." });
    }
    
    // ACTION: proxySupla (Server-side proxy bypass to handle browser CORS requirements against SUPLA endpoints)
    else if (action === "proxySupla") {
      const targetUrl = data.url;
      const method = data.method || "GET";
      const token = data.token;
      const bodyPayload = data.body;
      
      const headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/json"
      };
      
      const options = {
        "method": method,
        "headers": headers,
        "muteHttpExceptions": true
      };
      
      if (bodyPayload) {
        options.contentType = "application/json";
        options.payload = JSON.stringify(bodyPayload);
      }
      
      const response = UrlFetchApp.fetch(targetUrl, options);
      const resCode = response.getResponseCode();
      const resText = response.getContentText();
      
      return jsonResponse({
        status: resCode,
        body: resText
      });
    }
    
    // ACTION: saveSettings
    else if (action === "saveSettings") {
      const sheet = ss.getSheetByName("Ustawienia");
      const rows = sheet.getDataRange().getValues();
      
      const partyModeVal = data.partyMode === true ? "TRUE" : "FALSE";
      let keyFound = false;
      
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === "partyMode") {
          sheet.getRange(i + 1, 2).setValue(partyModeVal);
          keyFound = true;
          break;
        }
      }
      
      if (!keyFound) {
        sheet.appendRow(["partyMode", partyModeVal]);
      }
      
      // Zapisz pozostałe parametry, jeśli zostały nadesłane
      updateSettingIfPresent(sheet, rows, "suplaServerUrl", data.suplaServerUrl);
      updateSettingIfPresent(sheet, rows, "gateChannelId", data.gateChannelId);
      updateSettingIfPresent(sheet, rows, "sensorChannelId", data.sensorChannelId);
      updateSettingIfPresent(sheet, rows, "invertSensor", data.invertSensor !== undefined ? (data.invertSensor === true ? "TRUE" : "FALSE") : null);
      
      return jsonResponse({ status: "success", partyMode: data.partyMode });
    }
    
    // ACTION: saveUser
    else if (action === "saveUser") {
      const sheet = getUsersSheet(ss);
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
      
      let colName = headers.findIndex(function(h) { return h.includes("imię") || h.includes("imie") || h === "name"; });
      let colLastName = headers.findIndex(function(h) { return h.includes("nazwisko") || h === "lastname"; });
      let colPlot = headers.findIndex(function(h) { return h.includes("działk") || h.includes("dzialk") || h.includes("plot") || h.includes("numer"); });
      let colSupla = headers.findIndex(function(h) { return h.includes("supla"); });
      let colToken = headers.findIndex(function(h) { return h.includes("token"); });
      let colPin = headers.findIndex(function(h) { return h.includes("pin") || h.includes("kod"); });
      let colRole = headers.findIndex(function(h) { return h.includes("rola") || h.includes("role"); });
      let colStatus = headers.findIndex(function(h) { return h.includes("status") || h.includes("stan") || h.includes("blok"); });
      let colBlockReason = headers.findIndex(function(h) { return h.includes("przyczyna") || h.includes("powód") || h.includes("powod") || h.includes("reason"); });
      
      if (colName === -1) colName = 0;
      if (colLastName === -1) colLastName = 1;
      if (colPlot === -1) colPlot = 2;
      if (colSupla === -1) colSupla = 3;
      if (colToken === -1) colToken = 4;
      if (colPin === -1) colPin = 5;
      if (colRole === -1) colRole = 6;
      
      if (colStatus === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Status");
        colStatus = headers.length;
        headers.push("status");
      }
      if (colBlockReason === -1) {
        sheet.getRange(1, headers.length + 1).setValue("Przyczyna blokady");
        colBlockReason = headers.length;
        headers.push("przyczyna blokady");
      }
      
      const firstNameVal = data.firstName || "";
      const lastNameVal = data.lastName || "";
      const plotNumberVal = cleanVal(data.plotNumber);
      const oldPlotNumberVal = cleanVal(data.oldPlotNumber || data.plotNumber);
      const suplaNameVal = data.suplaName || "";
      const tokenVal = data.token || "";
      const pinVal = cleanVal(data.pin);
      const roleVal = data.role || "dzialkowiec";
      const statusVal = data.status || "active";
      const blockReasonVal = data.blockReason || "";
      
      let rowIdx = -1;
      if (oldPlotNumberVal) {
        for (let i = 1; i < rows.length; i++) {
          if (cleanVal(rows[i][colPlot]).toLowerCase() === oldPlotNumberVal.toLowerCase()) {
            rowIdx = i + 1;
            break;
          }
        }
      }
      
      if (rowIdx !== -1) {
        sheet.getRange(rowIdx, colName + 1).setValue(firstNameVal);
        sheet.getRange(rowIdx, colLastName + 1).setValue(lastNameVal);
        sheet.getRange(rowIdx, colPlot + 1).setValue(plotNumberVal);
        sheet.getRange(rowIdx, colSupla + 1).setValue(suplaNameVal);
        if (tokenVal !== undefined) {
          sheet.getRange(rowIdx, colToken + 1).setValue(tokenVal);
        }
        if (pinVal !== undefined) {
          sheet.getRange(rowIdx, colPin + 1).setValue(pinVal);
        }
        sheet.getRange(rowIdx, colRole + 1).setValue(roleVal);
        sheet.getRange(rowIdx, colStatus + 1).setValue(statusVal);
        sheet.getRange(rowIdx, colBlockReason + 1).setValue(blockReasonVal);
        
        return jsonResponse({ status: "success", message: "Zaktualizowano pomyślnie użytkownika." });
      } else {
        var newRow = [];
        var maxCol = Math.max(colName, colLastName, colPlot, colSupla, colToken, colPin, colRole, colStatus, colBlockReason);
        for (var c = 0; c <= maxCol; c++) {
          newRow.push("");
        }
        newRow[colName] = firstNameVal;
        newRow[colLastName] = lastNameVal;
        newRow[colPlot] = plotNumberVal;
        newRow[colSupla] = suplaNameVal;
        newRow[colToken] = tokenVal;
        newRow[colPin] = pinVal;
        newRow[colRole] = roleVal;
        newRow[colStatus] = statusVal;
        newRow[colBlockReason] = blockReasonVal;
        
        sheet.appendRow(newRow);
        return jsonResponse({ status: "success", message: "Dodano pomyślnie nowego użytkownika." });
      }
    }
    
    // ACTION: deleteUser
    else if (action === "deleteUser") {
      const sheet = getUsersSheet(ss);
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
      let colPlot = headers.findIndex(function(h) { return h.includes("działk") || h.includes("dzialk") || h.includes("plot") || h.includes("numer"); });
      if (colPlot === -1) colPlot = 2;
      
      const plotNumberVal = cleanVal(data.plotNumber);
      if (plotNumberVal) {
        for (let i = 1; i < rows.length; i++) {
          if (cleanVal(rows[i][colPlot]).toLowerCase() === plotNumberVal.toLowerCase()) {
            sheet.deleteRow(i + 1);
            return jsonResponse({ status: "success", message: "Użytkownik usunięty pomyślnie z Arkusza." });
          }
        }
      }
      return jsonResponse({ status: "error", message: "Nie odnaleziono użytkownika o podanym numerze działki." });
    }
    
    return jsonResponse({ status: "error", message: "Nieznana akcja POST." });
    
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// Funkcja pomocnicza aktualizacji pojedynczego ustawienia w arkuszu
function updateSettingIfPresent(sheet, rows, key, value) {
  if (value === undefined || value === null) return;
  const valStr = String(value);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(valStr);
      return;
    }
  }
  sheet.appendRow([key, valStr]);
}

// Pomocnicza struktura zwrotna json
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Pobieranie ustawień z domyślnymi wartościami
function getAppSettings(ss) {
  const sheet = ss.getSheetByName("Ustawienia");
  const rows = sheet.getDataRange().getValues();
  const settings = {
    partyMode: false,
    suplaServerUrl: "https://svr150.supla.org",
    gateChannelId: "2012",
    sensorChannelId: "2014",
    invertSensor: true
  };
  
  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0]).trim();
    const val = String(rows[i][1]).trim();
    if (!key) continue;
    
    if (key === "partyMode") {
      settings.partyMode = (val.toUpperCase() === "TRUE" || val === "1");
    } else if (key === "suplaServerUrl") {
      settings.suplaServerUrl = val;
    } else if (key === "gateChannelId") {
      settings.gateChannelId = val;
    } else if (key === "sensorChannelId") {
      settings.sensorChannelId = val;
    } else if (key === "invertSensor") {
      settings.invertSensor = (val.toUpperCase() === "TRUE" || val === "1");
    }
  }
  return settings;
}

// Sprawdzenie i automatyczne tworzenie arkuszy jeśli nie istnieją
function checkAndInitSheets(ss) {
  let hasUsers = getUsersSheet(ss);
  let hasLogs = ss.getSheetByName("Logi");
  let hasSettings = ss.getSheetByName("Ustawienia");
  
  if (!hasUsers) {
    const sheet = ss.insertSheet("Użytkownicy");
    sheet.appendRow(["Imię", "Nazwisko", "Numer działki", "Nazwa z SUPLA", "Token", "PIN", "Rola"]);
    // Dodaj wiersz demonstracyjny
    sheet.appendRow(["Marek", "Majcherczyk", "777", "Admin Marek", "TwójZnakomityTokenSupla", "7777", "Admin"]);
  }
  
  if (!hasLogs) {
    const sheet = ss.insertSheet("Logi");
    sheet.appendRow(["Data i Godzina", "Użytkownik", "Akcja", "Szczegóły"]);
    sheet.appendRow([new Date(), "System", "SYSTEM", "Automatyczna konfiguracja logowania arkusza zakończona pomyślnie."]);
  }
  
  if (!hasSettings) {
    const sheet = ss.insertSheet("Ustawienia");
    sheet.appendRow(["Klucz", "Wartość"]);
    sheet.appendRow(["partyMode", "FALSE"]);
    sheet.appendRow(["suplaServerUrl", "https://svr150.supla.org"]);
    sheet.appendRow(["gateChannelId", "2012"]);
    sheet.appendRow(["sensorChannelId", "2014"]);
    sheet.appendRow(["invertSensor", "TRUE"]);
  }
  
  // Usunięcie karty domyślnej "Arkusz1" lub "Sheet1" jeśli arkusz ma inne karty i jest pusta
  const defaultSheet = ss.getSheetByName("Arkusz1") || ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch(e) {}
  }
}

// --- AUTOMATYCZNE GENEROWANIE PIN ---
function generujLosowyPIN() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetUsers = getUsersSheet(ss);
  
  if (!sheetUsers) {
    SpreadsheetApp.getUi().alert("Błąd: Nie znaleziono arkusza zawierającego dane użytkowników (np. 'Uzytkownicy' / 'Użytkownicy').");
    return;
  }
  
  // 1. Pobieramy aktywną komórkę, w której stoi kursor
  var aktywnaKomorka = sheetUsers.getActiveCell();
  var wiersz = aktywnaKomorka.getRow();
  
  // Zabezpieczenie: skrypt zadziała tylko gdy aktywna jest karta z użytkownikami, i pomijamy wiersz nagłówkowy 1
  var aktywnyArkusz = ss.getActiveSheet();
  if (aktywnyArkusz.getName() !== sheetUsers.getName() || wiersz === 1) {
    SpreadsheetApp.getUi().alert("⚠️ Uwaga: Aby wygenerować PIN:\n1. Przejdź do zakładki z użytkownikami.\n2. Kliknij dowolną komórkę w wierszu wybranego Działkowca.\n3. Uruchom tę opcję ponownie.");
    return;
  }
  
  // 2. Generowanie unikalnego 4-cyfrowego PIN-u (od 1000 do 9999 z zachowaniem wiodących zer przy mniejszych wartościach)
  var dynamicPin = Math.floor(100 + Math.random() * 9899).toString();
  while (dynamicPin.length < 4) {
    dynamicPin = "0" + dynamicPin;
  }
  
  // 3. Zapisanie PIN-u w kolumnie F (szósta kolumna) w zaznaczonym wierszu
  var komorkaPIN = sheetUsers.getRange(wiersz, 6); 
  
  komorkaPIN.setNumberFormat("@"); // Format tekstowy, zapobiega ucinaniu zer wiodących
  komorkaPIN.setValue(dynamicPin);
  
  // Pobieranie imienia i numeru działki do sformatowania ładnej wiadomości potwierdzającej
  var imie = sheetUsers.getRange(wiersz, 1).getValue() || "";
  var nazwisko = sheetUsers.getRange(wiersz, 2).getValue() || "";
  var plot = sheetUsers.getRange(wiersz, 3).getValue() || "";
  var userDesc = (imie + " " + nazwisko).trim() || "użytkownika";
  if (plot) {
    userDesc += " (Działka nr " + plot + ")";
  }
  
  SpreadsheetApp.getUi().alert("✓ Sukces!\nWygenerowano i zapisano losowy PIN: " + dynamicPin + " dla " + userDesc + ".");
}
