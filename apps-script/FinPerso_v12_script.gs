// ============================================================
//  PORTFOLIO TRACKER — Apps Script
//  Versión v12 — todo CCL (histórico + actual) para cálculo USD
// ============================================================

var CONFIG = {
  hojas: {
    operaciones: "Operaciones",
    portfolio:   "Portfolio",
    historial:   "Historial",
    tickers:     "Tickers",
    valores:     "Valores",
    efectivo:    "Efectivo",
  },
  eft: {
    fecha:  1,
    tipo:   2,
    moneda: 3,
    monto:  4,
    nota:   5,
  },
  ops: {
    fecha:     1,
    orden:     2,
    ticker:    3,
    nombre:    4,
    tipo:      5,
    moneda:    6,
    nominales: 7,
    precio:    8,
    precioUSD: 9,
    tc:        10,
    totalARS:  11,
    totalUSD:  12,
  },
  port: {
    ticker:       1,
    nombre:       2,
    moneda:       3,
    tipo:         4,
    nominales:    5,
    precio:       6,
    dpt:          7,
    ppc:          8,
    ppcUSD:       9,
    rendARS:      10,
    rendUSD:      11,
    pctPortfolio: 12,
    totalARS:     13,
    totalUSD:     14,
    precioAyer:   15,
    precioSemAnt: 16,
  },
  colTicker:  1,
  colPrecio:  6,
  filaInicio: 2,
};

// ============================================================
//  AUTH — shared-secret token leído desde Script Properties
//  En el editor: Proyecto → Propiedades del script → API_TOKEN
//  El frontend debe enviar ?token=<valor> (GET) o payload.token (POST)
// ============================================================

var ALLOWED_SHEETS = ["Portfolio", "Operaciones", "Efectivo", "Historial", "Benchmark"];

// ============================================================
//  HELPERS
// ============================================================

function _toNum(v) {
  if (v === null || v === "" || v === undefined) return 0;
  if (typeof v === "number") return v;
  var s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (s.includes(".") && s.includes(",")) {
    // European format: "1.234,56" → strip dots, replace comma
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // European integer-thousands: "1.234" or "1.234.567" → no decimal comma
    s = s.replace(/\./g, "");
  }
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function _fechaArg(date) {
  return Utilities.formatDate(date, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
}

function _getHoja(nombre) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
}

function _getValor(clave) {
  var h = _getHoja(CONFIG.hojas.valores);
  if (!h || h.getLastRow() < 2) return 0;
  var datos = h.getRange(2, 1, h.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).toLowerCase() === clave.toLowerCase()) return _toNum(datos[i][1]);
  }
  return 0;
}

function _getValorStr(clave) {
  var h = _getHoja(CONFIG.hojas.valores);
  if (!h || h.getLastRow() < 2) return "";
  var datos = h.getRange(2, 1, h.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).toLowerCase() === clave.toLowerCase()) return String(datos[i][1]);
  }
  return "";
}

function _setValor(clave, valor) {
  var h = _getHoja(CONFIG.hojas.valores);
  if (!h || h.getLastRow() < 2) return;
  var datos = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).toLowerCase() === clave.toLowerCase()) {
      h.getRange(i + 2, 2).setValue(valor);
      return;
    }
  }
}

function _getMEP() { return _getValor("Dolar MEP"); }
function _getCCL() { return _getValor("Dolar CCL"); }

// TC para operaciones: CCL del día, fallback MEP, fallback 1400
function _getTCOperacion() {
  var ccl = _getCCL();
  if (ccl > 0) return ccl;
  var mep = _getMEP();
  if (mep > 0) return mep;
  return 1400;
}

function _headerStyle(range) {
  range.setBackground("#1e3a5f").setFontColor("#ffffff").setFontWeight("bold");
  range.getSheet().setFrozenRows(1);
}

// ============================================================
//  SETUP INICIAL — ejecutar UNA sola vez al instalar
// ============================================================

function setupInicial() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  _crearHojaPortfolio(ss);
  _crearHojaOperaciones(ss);
  _crearHojaHistorial(ss);
  _crearHojaTickers(ss);
  _crearHojaValores(ss);
  _crearHojaEfectivo(ss);

  ["Hoja1", "Sheet1", "Hoja 1"].forEach(function(nombre) {
    var h = ss.getSheetByName(nombre);
    if (h && ss.getSheets().length > 1) ss.deleteSheet(h);
  });

  configurarTriggers();

  Logger.log("Setup completo.");
  ss.toast("Hojas creadas. Escribí tu email en Valores → Email reporte.", "Setup completo ✓", 8);
}

function _crearHojaPortfolio(ss) {
  var h = ss.getSheetByName(CONFIG.hojas.portfolio);
  if (h) ss.deleteSheet(h);
  h = ss.insertSheet(CONFIG.hojas.portfolio);
  var headers = ["Ticker","Nombre","Moneda","Tipo","Nominales","Precio","DPT","PPC","PPC USD",
                 "Rend. ARS","Rend. USD","% Portfolio","Total ARS","Total USD",
                 "Precio Ayer","Precio Sem Anterior"];
  _headerStyle(h.getRange(1, 1, 1, headers.length));
  h.getRange(1, 1, 1, headers.length).setValues([headers]);
  [80,160,70,80,90,100,50,100,90,90,90,90,120,110,100,130].forEach(function(w,i){ h.setColumnWidth(i+1,w); });
  h.getRange(2,10,1000,2).setNumberFormat("0.00%");
  h.getRange(2,12,1000,1).setNumberFormat("0.00%");
}

function _crearHojaOperaciones(ss) {
  var h = ss.getSheetByName(CONFIG.hojas.operaciones);
  if (h) ss.deleteSheet(h);
  h = ss.insertSheet(CONFIG.hojas.operaciones);
  var headers = ["Fecha","Orden","Ticker","Nombre","Tipo","Moneda",
                 "Nominales","Precio","Precio USD","TC","Total ARS","Total USD"];
  _headerStyle(h.getRange(1, 1, 1, headers.length));
  h.getRange(1, 1, 1, headers.length).setValues([headers]);
  [110,110,80,160,80,80,90,110,100,110,120,110].forEach(function(w,i){ h.setColumnWidth(i+1,w); });
  h.getRange(2,2,1000,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Compra","Venta"],true).build());
  h.getRange(2,5,1000,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Equity","Bonos","Crypto","Cash","Agro"],true).build());
  h.getRange(2,6,1000,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["ARS","USD"],true).build());
  h.getRange(2,1,1000,1).setNumberFormat("dd/mm/yyyy");
  h.getRange(2,7,1000,1).setNumberFormat("#,##0");
  h.getRange(2,8,1000,3).setNumberFormat("#,##0.00");
  h.getRange(2,10,1000,1).setNumberFormat("#,##0.00");
  h.getRange(2,11,1000,2).setNumberFormat("#,##0.00");
}

function _crearHojaHistorial(ss) {
  var h = ss.getSheetByName(CONFIG.hojas.historial);
  if (h) ss.deleteSheet(h);
  h = ss.insertSheet(CONFIG.hojas.historial);
  // Col 6 = CCL del día (para auditoría y futuro uso)
  var headers = ["Fecha","Total ARS","Total USD","Var. Diaria","Var. Semanal","CCL"];
  _headerStyle(h.getRange(1, 1, 1, headers.length));
  h.getRange(1, 1, 1, headers.length).setValues([headers]);
  [120,130,120,100,110,100].forEach(function(w,i){ h.setColumnWidth(i+1,w); });
  h.getRange(2,4,1000,2).setNumberFormat("0.00%");
  h.getRange(2,6,1000,1).setNumberFormat("#,##0.00");
}

function _crearHojaTickers(ss) {
  var h = ss.getSheetByName(CONFIG.hojas.tickers);
  if (h) ss.deleteSheet(h);
  h = ss.insertSheet(CONFIG.hojas.tickers);
  var headers = ["Ticker","Nombre","Yahoo Symbol","Online","Emoji","Precio Manual"];
  _headerStyle(h.getRange(1, 1, 1, 6));
  h.getRange(1, 1, 1, 6).setValues([headers]);
  h.getRange(2,4,1000,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Sí","No"],true).build());
  [100,160,120,70,60,110].forEach(function(w,i){ h.setColumnWidth(i+1,w); });
}

function _crearHojaValores(ss) {
  var h = ss.getSheetByName(CONFIG.hojas.valores);
  if (h) ss.deleteSheet(h);
  h = ss.insertSheet(CONFIG.hojas.valores);
  _headerStyle(h.getRange(1, 1, 1, 2));
  h.getRange(1, 1, 1, 2).setValues([["Clave","Valor"]]);
  h.getRange(2, 1, 6, 2).setValues([
    ["Fecha Update",  ""],
    ["Email reporte", ""],
    ["Dolar MEP",     0],
    ["Dolar CCL",     0],
    ["Total ARS",     0],
    ["Total USD",     0],
  ]);
  h.getRange(4,2,2,1).setNumberFormat("#,##0.00");
  h.getRange(6,2,2,1).setNumberFormat("#,##0.00");
  [140,140].forEach(function(w,i){ h.setColumnWidth(i+1,w); });
}

function _crearHojaEfectivo(ss) {
  var h = ss.getSheetByName(CONFIG.hojas.efectivo);
  if (h) ss.deleteSheet(h);
  h = ss.insertSheet(CONFIG.hojas.efectivo);
  var headers = ["Fecha","Tipo","Moneda","Monto","Nota"];
  _headerStyle(h.getRange(1, 1, 1, headers.length));
  h.getRange(1, 1, 1, headers.length).setValues([headers]);
  h.getRange(2, 2, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["Depósito","Extracción"],true).build()
  );
  h.getRange(2, 3, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["ARS","USD"],true).build()
  );
  h.getRange(2, 1, 1000, 1).setNumberFormat("dd/mm/yyyy");
  h.getRange(2, 4, 1000, 1).setNumberFormat("#,##0.00");
  [110, 110, 80, 130, 260].forEach(function(w,i){ h.setColumnWidth(i+1,w); });
}

// Calcula el saldo de efectivo derivado de Efectivo + efectos de Compra/Venta en Operaciones
function _computeCashBalance(moneda) {
  var balance = 0;
  var opsHoja = _getHoja(CONFIG.hojas.operaciones);
  var co = CONFIG.ops;
  if (opsHoja && opsHoja.getLastRow() >= 2) {
    opsHoja.getRange(2, 1, opsHoja.getLastRow()-1, 12).getValues().forEach(function(row) {
      var ticker   = row[co.ticker-1];
      var orden    = row[co.orden-1];
      var monedaOp = row[co.moneda-1];
      var totalARS = _toNum(row[co.totalARS-1]);
      var totalUSD = _toNum(row[co.totalUSD-1]);
      if (!ticker || ticker === "ARS" || ticker === "USD") return;
      if (orden !== "Compra" && orden !== "Venta") return;
      if (moneda === "USD" && monedaOp !== "USD") return;
      if (moneda === "ARS" && monedaOp !== "ARS") return;
      var amount = moneda === "USD" ? totalUSD : totalARS;
      if (orden === "Compra") balance -= amount;
      else                    balance += amount;
    });
  }
  var eftHoja = _getHoja(CONFIG.hojas.efectivo);
  var ce = CONFIG.eft;
  if (eftHoja && eftHoja.getLastRow() >= 2) {
    eftHoja.getRange(2, 1, eftHoja.getLastRow()-1, 5).getValues().forEach(function(row) {
      var tipo      = row[ce.tipo-1];
      var monedaEft = row[ce.moneda-1];
      var monto     = _toNum(row[ce.monto-1]);
      if (monedaEft !== moneda || !tipo || monto === 0) return;
      balance += (tipo === "Depósito") ? monto : -monto;
    });
  }
  return balance;
}

// ============================================================
//  1. TIPO DE CAMBIO
// ============================================================

function actualizarDolar() {
  try {
    var res   = UrlFetchApp.fetch("https://dolarapi.com/v1/dolares", { muteHttpExceptions: true });
    var tipos = JSON.parse(res.getContentText());
    var mep   = tipos.find(function(d){ return d.casa === "bolsa"; });
    var ccl   = tipos.find(function(d){ return d.casa === "contadoconliqui"; });
    if (mep) _setValor("Dolar MEP", mep.venta || mep.compra);
    if (ccl) _setValor("Dolar CCL", ccl.venta || ccl.compra);
    Logger.log("MEP: " + (mep ? mep.venta : "?") + " | CCL: " + (ccl ? ccl.venta : "?"));
  } catch(e) {
    Logger.log("Error dolar: " + e.message);
  }
  _setValor("Fecha Update", Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm"));
}

// ============================================================
//  CCL HISTÓRICO — fuente principal para toda valuación USD
// ============================================================

function _getCCLHistorico(fecha) {
  try {
    var url   = "https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui";
    var res   = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var datos = JSON.parse(res.getContentText());
    if (!Array.isArray(datos) || datos.length === 0) return _getTCOperacion();

    var fechaObj   = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    var mejor      = null;
    var diferencia = Infinity;

    datos.forEach(function(d) {
      if (!d.fecha || !d.venta) return;
      var partes = d.fecha.split("-");
      var df     = new Date(parseInt(partes[0]), parseInt(partes[1])-1, parseInt(partes[2]));
      var diff   = fechaObj - df;
      // Busca el CCL del día exacto o el anterior más cercano
      if (diff >= 0 && diff < diferencia) {
        diferencia = diff;
        mejor = _toNum(d.venta);
      }
    });

    return (mejor && mejor > 0) ? mejor : _getTCOperacion();
  } catch(e) {
    Logger.log("Error CCL histórico: " + e.message);
    return _getTCOperacion();
  }
}

// Mantenemos _getMEPHistorico por compatibilidad pero ya no se usa para operaciones
function _getMEPHistorico(fecha) {
  try {
    var url   = "https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa";
    var res   = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var datos = JSON.parse(res.getContentText());
    if (!Array.isArray(datos) || datos.length === 0) return _getMEP();

    var fechaObj   = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    var mejor      = null;
    var diferencia = Infinity;

    datos.forEach(function(d) {
      if (!d.fecha || !d.venta) return;
      var partes = d.fecha.split("-");
      var df     = new Date(parseInt(partes[0]), parseInt(partes[1])-1, parseInt(partes[2]));
      var diff   = fechaObj - df;
      if (diff >= 0 && diff < diferencia) {
        diferencia = diff;
        mejor = _toNum(d.venta);
      }
    });

    return (mejor && mejor > 0) ? mejor : _getMEP();
  } catch(e) {
    Logger.log("Error MEP histórico: " + e.message);
    return _getMEP();
  }
}

// ============================================================
//  2. TICKERS
// ============================================================

function _getPrecioYahoo(symbol) {
  var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol + "?interval=1d&range=5d";
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Google-Apps-Script)" }
  });
  var data = JSON.parse(res.getContentText());
  var result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.meta) return null;
  var meta = result.meta;
  var precio = meta.regularMarketPrice || meta.previousClose || null;

  // previousClose se deriva del historial de cierres comparando con regularMarketPrice.
  // Si precio ≈ último cierre del historial → el historial ya incluye hoy → previousClose = penúltimo.
  // Si precio ≠ último cierre del historial → meta es más fresca que el chart → previousClose = último.
  // Así queda robusto frente a la latencia variable de Yahoo entre meta y chart.
  var previousClose = null;
  var timestamps = result.timestamp || [];
  var closes = (result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
  var validCloses = [];
  for (var i = 0; i < timestamps.length; i++) {
    if (closes[i] !== null && closes[i] !== undefined) validCloses.push(closes[i]);
  }
  if (validCloses.length >= 1 && precio) {
    var lastClose = validCloses[validCloses.length - 1];
    var epsilon = Math.max(0.01, Math.abs(lastClose) * 0.0005); // tolerancia 0.05%
    if (Math.abs(precio - lastClose) <= epsilon) {
      if (validCloses.length >= 2) previousClose = validCloses[validCloses.length - 2];
    } else {
      previousClose = lastClose;
    }
  }
  if (!previousClose) previousClose = meta.previousClose || null;

  return {
    precio: precio,
    previousClose: previousClose
  };
}

function _getTickers() {
  var h = _getHoja(CONFIG.hojas.tickers);
  if (!h || h.getLastRow() < 2) return { map: {}, nombres: {}, emoji: {} };
  var datos = h.getRange(2, 1, h.getLastRow()-1, 5).getValues();
  var map = {}, nombres = {}, emoji = {};
  datos.forEach(function(row) {
    var ticker = row[0], nombre = row[1], symbol = row[2], online = row[3], em = row[4];
    if (!ticker) return;
    if (symbol && online === "Sí") map[ticker] = symbol;
    if (nombre) nombres[ticker] = nombre;
    if (em) emoji[ticker] = em;
  });
  return { map: map, nombres: nombres, emoji: emoji };
}

function _intentarYahoo(hoja, fila, ticker) {
  var symbol = ticker + ".BA";
  var resp = null;
  for (var i = 0; i < 3; i++) {
    try { resp = _getPrecioYahoo(symbol); } catch(e) {}
    if (resp && resp.precio > 0) break;
    if (i < 2) Utilities.sleep(1000);
  }
  if (resp && resp.precio > 0) {
    hoja.getRange(fila, 3).setValue(symbol);
    hoja.getRange(fila, 4).setValue("Sí");
    Logger.log("Ticker " + ticker + " online: " + symbol + " $" + resp.precio);
    return true;
  }
  Logger.log("Ticker " + ticker + " sin cotización en Yahoo.");
  return false;
}

function _registrarTickers(tickers, nombresEnOps) {
  var h = _getHoja(CONFIG.hojas.tickers);
  if (!h) return;
  if (!nombresEnOps) nombresEnOps = {};

  var datos = h.getLastRow() >= 2 ? h.getRange(2, 1, h.getLastRow()-1, 5).getValues() : [];

  var estado = {};
  datos.forEach(function(row, i) {
    var t = row[0], symbol = row[2], online = row[3];
    if (!t) return;
    if (!estado[t]) estado[t] = [];
    estado[t].push({ fila: i + 2, symbol: symbol, online: online });
  });

  tickers.forEach(function(ticker) {
    var filas  = estado[ticker] || [];
    var nombre = nombresEnOps[ticker] || "";

    for (var i = 0; i < filas.length; i++) {
      if (filas[i].online === "Sí" && filas[i].symbol) {
        if (nombre) h.getRange(filas[i].fila, 2).setValue(nombre);
        return;
      }
    }
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].online === "No" && filas[i].symbol) {
        if (nombre) h.getRange(filas[i].fila, 2).setValue(nombre);
        return;
      }
    }
    for (var i = 0; i < filas.length; i++) {
      if (!filas[i].symbol) {
        if (nombre) h.getRange(filas[i].fila, 2).setValue(nombre);
        _intentarYahoo(h, filas[i].fila, ticker);
        return;
      }
    }
    var f = h.getLastRow() + 1;
    h.getRange(f, 1, 1, 5).setValues([[ticker, nombre, "", "Pendiente", "📈"]]);
    if (!estado[ticker]) estado[ticker] = [];
    estado[ticker].push({ fila: f, symbol: "", online: "Pendiente" });
    _intentarYahoo(h, f, ticker);
  });
}

// ============================================================
//  3. ACTUALIZAR PRECIOS
// ============================================================

function actualizarPrecios() {
  var port   = _getHoja(CONFIG.hojas.portfolio);
  var tkData = _getTickers();
  if (!port || port.getLastRow() < CONFIG.filaInicio) return;

  var lastRow   = port.getLastRow();
  var tickerCol = port.getRange(CONFIG.filaInicio, CONFIG.colTicker, lastRow - CONFIG.filaInicio + 1, 1).getValues();
  var unicos    = [];
  tickerCol.flat().forEach(function(t) {
    if (t && tkData.map[t] && unicos.indexOf(t) === -1) unicos.push(t);
  });

  var precios = {};
  unicos.forEach(function(ticker) {
    try {
      var p = _getPrecioYahoo(tkData.map[ticker]);
      if (p && p.precio > 0) {
        precios[ticker] = p;
        Logger.log(ticker + ": $" + p.precio + " (ayer $" + p.previousClose + ")");
      }
    } catch(e) { Logger.log("Error precio " + ticker + ": " + e.message); }
    Utilities.sleep(400);
  });

  var preciosManuales = _getPreciosManuales();

  for (var i = 0; i < tickerCol.length; i++) {
    var t = tickerCol[i][0];
    if (t && precios[t] && precios[t].precio > 0) {
      port.getRange(CONFIG.filaInicio + i, CONFIG.colPrecio).setValue(precios[t].precio);
      if (precios[t].previousClose > 0) {
        port.getRange(CONFIG.filaInicio + i, CONFIG.port.precioAyer).setValue(precios[t].previousClose);
      }
    } else if (t && preciosManuales[t] && preciosManuales[t] > 0) {
      port.getRange(CONFIG.filaInicio + i, CONFIG.colPrecio).setValue(preciosManuales[t]);
    }
  }
  Logger.log("Precios: " + Object.keys(precios).length + "/" + unicos.length + " (online) + manuales aplicados");
}

function _getPreciosManuales() {
  var h = _getHoja(CONFIG.hojas.tickers);
  if (!h || h.getLastRow() < 2) return {};
  var datos = h.getRange(2, 1, h.getLastRow()-1, 6).getValues();
  var manuales = {};
  datos.forEach(function(row) {
    var ticker = row[0], online = row[3], precioManual = _toNum(row[5]);
    if (ticker && online !== "Sí" && precioManual > 0) {
      manuales[ticker] = precioManual;
    }
  });
  return manuales;
}

// ============================================================
//  4. RECALCULAR PORTFOLIO — usa CCL para toda conversión USD
// ============================================================

function recalcularPortfolio() {
  var opsHoja = _getHoja(CONFIG.hojas.operaciones);
  var port    = _getHoja(CONFIG.hojas.portfolio);
  if (!opsHoja || !port) return;

  // CCL como TC de referencia para valuación actual
  var ccl      = _getCCL();
  var mep      = _getMEP();
  var dolarHoy = ccl > 0 ? ccl : mep > 0 ? mep : 1400;

  var lastOps     = opsHoja.getLastRow();
  var co          = CONFIG.ops;
  var operaciones = lastOps >= 2 ? opsHoja.getRange(2, 1, lastOps-1, 12).getValues() : [];
  var resumen     = {};

  var tickersUnicos = [];
  var nombresEnOps  = {};
  operaciones.forEach(function(row) {
    var ticker = row[co.ticker-1];
    var nombre = row[co.nombre-1];
    if (!ticker) return;
    if (tickersUnicos.indexOf(ticker) === -1) tickersUnicos.push(ticker);
    if (nombre && nombre !== ticker && !nombresEnOps[ticker]) nombresEnOps[ticker] = nombre;
  });
  _registrarTickers(tickersUnicos, nombresEnOps);

  function initTicker(ticker, nombre, tipo, moneda) {
    if (!resumen[ticker]) {
      resumen[ticker] = { nombre:nombre, tipo:tipo, moneda:moneda,
                          nominales:0, costoARS:0, costoUSD:0, costoARS_x_dias:0 };
    }
  }

  var cashDelta = { ARS: 0, USD: 0 };

  operaciones.forEach(function(row) {
    var fecha     = row[co.fecha-1];
    var orden     = row[co.orden-1];
    var ticker    = row[co.ticker-1];
    var nombre    = row[co.nombre-1];
    var tipo      = row[co.tipo-1];
    var moneda    = row[co.moneda-1];
    var nominales = _toNum(row[co.nominales-1]);
    var precio    = _toNum(row[co.precio-1]);
    var precioUSD = _toNum(row[co.precioUSD-1]);
    var totalARS  = _toNum(row[co.totalARS-1]);
    var totalUSD  = _toNum(row[co.totalUSD-1]);

    if (!ticker || !orden || !fecha || !(fecha instanceof Date) || nominales === 0) return;
    if (ticker === "ARS" || ticker === "USD") return;
    if (orden !== "Compra" && orden !== "Venta") return;

    initTicker(ticker, nombre, tipo, moneda);

    var dias     = Math.max(0, Math.floor((new Date() - fecha) / 86400000));
    var montoARS = nominales * precio;
    var montoUSD = nominales * precioUSD;

    if (orden === "Compra") {
      resumen[ticker].nominales       += nominales;
      resumen[ticker].costoARS        += montoARS;
      resumen[ticker].costoUSD        += montoUSD;
      resumen[ticker].costoARS_x_dias += montoARS * dias;
      if (moneda === "USD") cashDelta.USD -= (totalUSD || montoUSD);
      else                  cashDelta.ARS -= (totalARS || montoARS);
    } else if (orden === "Venta") {
      var prop = resumen[ticker].nominales > 0 ? nominales / resumen[ticker].nominales : 0;
      resumen[ticker].nominales       -= nominales;
      resumen[ticker].costoARS        -= resumen[ticker].costoARS * prop;
      resumen[ticker].costoUSD        -= resumen[ticker].costoUSD * prop;
      resumen[ticker].costoARS_x_dias -= resumen[ticker].costoARS_x_dias * prop;
      if (moneda === "USD") cashDelta.USD += (totalUSD || montoUSD);
      else                  cashDelta.ARS += (totalARS || montoARS);
    }
  });

  // Sumar movimientos manuales de la hoja Efectivo
  var eftHoja = _getHoja(CONFIG.hojas.efectivo);
  var ce = CONFIG.eft;
  if (eftHoja && eftHoja.getLastRow() >= 2) {
    eftHoja.getRange(2, 1, eftHoja.getLastRow()-1, 5).getValues().forEach(function(row) {
      var tipo      = row[ce.tipo-1];
      var monedaEft = row[ce.moneda-1];
      var monto     = _toNum(row[ce.monto-1]);
      if (!tipo || !monedaEft || monto === 0) return;
      var sign = (tipo === "Depósito") ? 1 : -1;
      if (monedaEft === "USD") cashDelta.USD += sign * monto;
      else                     cashDelta.ARS += sign * monto;
    });
  }

  // Inyectar saldos de efectivo (siempre presentes, pueden ser negativos)
  resumen["ARS"] = { nombre:"Cash ARS", tipo:"Cash", moneda:"ARS",
                     nominales:cashDelta.ARS, costoARS:0, costoUSD:0, costoARS_x_dias:0,
                     ppcARS:0, ppcUSD:0, dpt:0 };
  resumen["USD"] = { nombre:"Cash USD", tipo:"Cash", moneda:"USD",
                     nominales:cashDelta.USD, costoARS:0, costoUSD:0, costoARS_x_dias:0,
                     ppcARS:0, ppcUSD:0, dpt:0 };

  Object.keys(resumen).forEach(function(t) {
    if (t === "ARS" || t === "USD") return;
    var r    = resumen[t];
    r.ppcARS = r.nominales > 0 ? r.costoARS / r.nominales : 0;
    r.ppcUSD = r.nominales > 0 ? r.costoUSD / r.nominales : 0;
    r.dpt    = r.costoARS > 0  ? Math.round(r.costoARS_x_dias / r.costoARS) : 0;
  });

  var preciosActuales = {}, preciosAyer = {}, preciosSemAnt = {};
  var cp = CONFIG.port;
  if (port.getLastRow() >= 2) {
    port.getRange(2, 1, port.getLastRow()-1, 16).getValues().forEach(function(row) {
      var t = row[cp.ticker-1];
      if (!t) return;
      preciosActuales[t] = _toNum(row[cp.precio-1]);
      preciosAyer[t]     = _toNum(row[cp.precioAyer-1]);
      preciosSemAnt[t]   = _toNum(row[cp.precioSemAnt-1]);
    });
  }

  if (port.getLastRow() >= 2) {
    port.getRange(2, 1, port.getLastRow()-1, 16).clearContent();
  }

  var posiciones = Object.keys(resumen).filter(function(t) {
    return resumen[t].nominales > 0 || t === "ARS" || t === "USD";
  });

  if (posiciones.length === 0) {
    _setValor("Total ARS", 0);
    _setValor("Total USD", 0);
    return;
  }

  var totalUSD = 0, totalARS = 0;
  posiciones.forEach(function(ticker) {
    var r = resumen[ticker], precio = preciosActuales[ticker] || 0;
    var tARS, tUSD;
    if (ticker === "ARS")      { tARS = Math.round(r.nominales); tUSD = dolarHoy > 0 ? tARS/dolarHoy : 0; }
    else if (ticker === "USD") { tUSD = parseFloat(r.nominales.toFixed(2)); tARS = tUSD * dolarHoy; }
    else if (r.moneda === "USD") {
      tUSD = r.nominales * precio;
      tARS = tUSD * dolarHoy;
    }
    else                       { tARS = r.nominales * precio; tUSD = dolarHoy > 0 ? tARS/dolarHoy : 0; }
    totalARS += tARS;
    totalUSD += tUSD;
  });

  posiciones.forEach(function(ticker, idx) {
    var r      = resumen[ticker];
    var fila   = idx + 2;
    var precio = preciosActuales[ticker] || (ticker === "ARS" || ticker === "USD" ? 1 : 0);
    var tARS, tUSD, rendARS, rendUSD;

    if (ticker === "ARS") {
      tARS = Math.round(r.nominales); tUSD = dolarHoy > 0 ? tARS/dolarHoy : 0;
      rendARS = 0; rendUSD = 0;
    } else if (ticker === "USD") {
      tUSD = parseFloat(r.nominales.toFixed(2)); tARS = tUSD * dolarHoy;
      rendARS = 0; rendUSD = 0;
    } else if (r.moneda === "USD") {
      tUSD    = r.nominales * precio;
      tARS    = tUSD * dolarHoy;
      rendUSD = r.ppcUSD > 0 ? (precio - r.ppcUSD) / r.ppcUSD : 0;
      rendARS = r.ppcARS > 0 ? (tARS - r.costoARS) / r.costoARS : 0;
    } else {
      // Instrumento ARS: convertir precio actual y PPC a USD con CCL actual
      tARS    = r.nominales * precio;
      tUSD    = dolarHoy > 0 ? tARS / dolarHoy : 0;
      var pU  = dolarHoy > 0 ? precio / dolarHoy : 0;
      rendARS = r.ppcARS > 0 ? (precio - r.ppcARS) / r.ppcARS : 0;
      // rendUSD: comparamos precio actual/CCL_hoy vs PPC_compra/CCL_compra
      // ppcUSD ya fue calculado con CCL histórico en completarOperaciones
      rendUSD = r.ppcUSD > 0 ? (pU - r.ppcUSD) / r.ppcUSD : 0;
    }

    var noms = ticker === "ARS" ? Math.round(r.nominales)
             : ticker === "USD" ? parseFloat(r.nominales.toFixed(2))
             : r.nominales;

    port.getRange(fila, cp.ticker).setValue(ticker);
    port.getRange(fila, cp.nombre).setValue(r.nombre);
    port.getRange(fila, cp.moneda).setValue(r.moneda || "ARS");
    port.getRange(fila, cp.tipo).setValue(r.tipo);
    port.getRange(fila, cp.nominales).setValue(noms);
    port.getRange(fila, cp.precio).setValue(precio);
    port.getRange(fila, cp.dpt).setValue(r.dpt || 0);
    port.getRange(fila, cp.ppc).setValue(r.ppcARS);
    port.getRange(fila, cp.ppcUSD).setValue(r.ppcUSD);
    port.getRange(fila, cp.rendARS).setValue(rendARS);
    port.getRange(fila, cp.rendUSD).setValue(rendUSD);
    port.getRange(fila, cp.pctPortfolio).setValue(totalUSD > 0 ? tUSD/totalUSD : 0);
    port.getRange(fila, cp.totalARS).setValue(Math.round(tARS));
    port.getRange(fila, cp.totalUSD).setValue(parseFloat(tUSD.toFixed(2)));
    port.getRange(fila, cp.precioAyer).setValue(preciosAyer[ticker] || 0);
    port.getRange(fila, cp.precioSemAnt).setValue(preciosSemAnt[ticker] || 0);
  });

  _setValor("Total ARS", Math.round(totalARS));
  _setValor("Total USD", parseFloat(totalUSD.toFixed(2)));

  Logger.log("Portfolio recalculado. " + posiciones.length + " posiciones. USD: " + totalUSD.toFixed(0) + " (CCL: " + dolarHoy + ")");
}

// ============================================================
//  5. COMPLETAR OPERACIONES — usa CCL histórico
// ============================================================

function completarOperaciones() {
  var sheet = _getHoja(CONFIG.hojas.operaciones);
  if (!sheet || sheet.getLastRow() < 2) return;

  actualizarPrecios();

  var co      = CONFIG.ops;
  var lastRow = sheet.getLastRow();
  var datos   = sheet.getRange(2, 1, lastRow-1, 12).getValues();
  var cambios = 0;

  datos.forEach(function(row, i) {
    var fila      = i + 2;
    var fecha     = row[co.fecha-1];
    var ticker    = row[co.ticker-1];
    var nominales = _toNum(row[co.nominales-1]);
    var precio    = _toNum(row[co.precio-1]);
    var nombre    = row[co.nombre-1];

    if (!ticker || !fecha || !(fecha instanceof Date) || precio === 0) return;

    if (!nombre) {
      var tkData = _getTickers();
      if (tkData.nombres[ticker] && tkData.nombres[ticker] !== ticker) {
        sheet.getRange(fila, co.nombre).setValue(tkData.nombres[ticker]);
        cambios++;
      }
    }

    // CCL histórico del día de la operación
    var tc = _getCCLHistorico(fecha);
    if (tc > 0) {
      sheet.getRange(fila, co.tc).setValue(tc);
      cambios++;
    }

    var moneda = row[co.moneda-1];
    if (moneda === "USD") {
      sheet.getRange(fila, co.precioUSD).setValue(precio);
      if (nominales > 0) {
        var tUSD = precio * nominales;
        sheet.getRange(fila, co.totalUSD).setValue(parseFloat(tUSD.toFixed(2)));
        if (tc > 0) sheet.getRange(fila, co.totalARS).setValue(Math.round(tUSD * tc));
        cambios++;
      }
    } else {
      if (precio > 0 && tc > 0) {
        sheet.getRange(fila, co.precioUSD).setValue(parseFloat((precio/tc).toFixed(4)));
      }
      if (precio > 0 && nominales > 0) {
        var tARS = precio * nominales;
        sheet.getRange(fila, co.totalARS).setValue(tARS);
        if (tc > 0) sheet.getRange(fila, co.totalUSD).setValue(parseFloat((tARS/tc).toFixed(2)));
        cambios++;
      }
    }
  });

  if (cambios > 0) {
    recalcularPortfolio();
    Logger.log("Operaciones completadas: " + cambios + " cambios (TC: CCL histórico).");
  }
}

// ============================================================
//  6. ON EDIT — usa CCL histórico
// ============================================================

function onEdit(e) {
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() !== CONFIG.hojas.operaciones) return;
    var fila = e.range.getRow();
    if (fila < 2) return;

    var co      = CONFIG.ops;
    var rowData = sheet.getRange(fila, 1, 1, 12).getValues()[0];
    var fecha   = rowData[co.fecha-1];
    var ticker  = rowData[co.ticker-1];

    if (!ticker || !fecha || !(fecha instanceof Date)) return;

    var nombre    = rowData[co.nombre-1];
    var nominales = _toNum(rowData[co.nominales-1]);
    var precio    = _toNum(rowData[co.precio-1]);

    if (!nombre) {
      var tkData = _getTickers();
      if (tkData.nombres[ticker] && tkData.nombres[ticker] !== ticker) {
        sheet.getRange(fila, co.nombre).setValue(tkData.nombres[ticker]);
      }
    }

    // CCL histórico del día de la operación
    var tc = _getCCLHistorico(fecha);
    if (tc > 0) sheet.getRange(fila, co.tc).setValue(tc);

    var moneda = rowData[co.moneda-1];
    if (moneda === "USD") {
      sheet.getRange(fila, co.precioUSD).setValue(precio);
      if (nominales > 0) {
        var tUSD = precio * nominales;
        sheet.getRange(fila, co.totalUSD).setValue(parseFloat(tUSD.toFixed(2)));
        if (tc > 0) sheet.getRange(fila, co.totalARS).setValue(Math.round(tUSD * tc));
      }
    } else {
      if (precio > 0 && tc > 0) {
        sheet.getRange(fila, co.precioUSD).setValue(parseFloat((precio/tc).toFixed(4)));
      }
      if (precio > 0 && nominales > 0) {
        var tARS = precio * nominales;
        sheet.getRange(fila, co.totalARS).setValue(tARS);
        if (tc > 0) sheet.getRange(fila, co.totalUSD).setValue(parseFloat((tARS/tc).toFixed(2)));
      }
    }

    recalcularPortfolio();

  } catch(err) {
    Logger.log("onEdit error: " + err.message);
  }
}

// ============================================================
//  7. HISTORIAL — guarda CCL en columna 6
// ============================================================

function _guardarPrecioAyer() {
  var port = _getHoja(CONFIG.hojas.portfolio);
  if (!port || port.getLastRow() < 2) return;
  var cp = CONFIG.port, lr = port.getLastRow();
  port.getRange(2, cp.precioAyer, lr-1, 1).setValues(port.getRange(2, cp.precio, lr-1, 1).getValues());
  Logger.log("Precios ayer guardados.");
}

function _guardarPrecioSemanal() {
  var port = _getHoja(CONFIG.hojas.portfolio);
  if (!port || port.getLastRow() < 2) return;
  var cp = CONFIG.port, lr = port.getLastRow();
  port.getRange(2, cp.precioSemAnt, lr-1, 1).setValues(port.getRange(2, cp.precio, lr-1, 1).getValues());
  Logger.log("Precios semanales guardados.");
}

function _guardarSnapshotDiario() {
  var hist = _getHoja(CONFIG.hojas.historial);
  if (!hist) return;
  var totalARS = _getValor("Total ARS");
  var totalUSD = _getValor("Total USD");
  if (!totalUSD) return;

  var ccl    = _getCCL();
  var uf     = hist.getLastRow();
  var varDia = "";
  if (uf >= 2) {
    var ant = _toNum(hist.getRange(uf, 3).getValue());
    if (ant > 0 && ant !== totalUSD) varDia = (totalUSD - ant) / ant;
  }

  var f = uf + 1;
  hist.getRange(f, 1).setValue(new Date()).setNumberFormat("dd/mm/yyyy");
  hist.getRange(f, 2).setValue(Math.round(totalARS));
  hist.getRange(f, 3).setValue(totalUSD);
  if (varDia !== "") {
    hist.getRange(f, 4).setValue(varDia).setNumberFormat("0.00%")
      .setBackground(varDia >= 0 ? "#dcfce7" : "#fee2e2")
      .setFontColor(varDia >= 0 ? "#16a34a" : "#dc2626");
  }
  // Guardar CCL del día para auditoría
  if (ccl > 0) {
    hist.getRange(f, 6).setValue(ccl).setNumberFormat("#,##0.00");
  }
  Logger.log("Snapshot diario guardado. CCL: " + ccl);
}

function snapshotSemanal() {
  var hist = _getHoja(CONFIG.hojas.historial);
  if (!hist || hist.getLastRow() < 2) return;

  var totalUSD = _getValor("Total USD");
  if (!totalUSD) return;

  var hoy = new Date();
  var viernesAnt = new Date(hoy);
  viernesAnt.setDate(hoy.getDate() - 7);
  var fechaBuscada = _fechaArg(viernesAnt);

  var datos = hist.getRange(2, 1, hist.getLastRow() - 1, 3).getValues();
  var valorAnt = null;

  for (var i = datos.length - 1; i >= 0; i--) {
    if (datos[i][0] instanceof Date && _fechaArg(datos[i][0]) === fechaBuscada) {
      valorAnt = _toNum(datos[i][2]);
      break;
    }
  }

  if (!valorAnt) {
    var mejorDiff = Infinity;
    for (var i = datos.length - 1; i >= 0; i--) {
      if (!(datos[i][0] instanceof Date)) continue;
      var diff = hoy - datos[i][0];
      if (diff > 0 && diff < mejorDiff && diff > 86400000) {
        mejorDiff = diff;
        valorAnt = _toNum(datos[i][2]);
        if (mejorDiff <= 8 * 86400000) break;
      }
    }
  }

  if (!valorAnt || valorAnt <= 0) return;

  var vs = (totalUSD - valorAnt) / valorAnt;
  var uf = hist.getLastRow();
  hist.getRange(uf, 5).setValue(vs).setNumberFormat("0.00%")
    .setBackground(vs >= 0 ? "#dcfce7" : "#fee2e2")
    .setFontColor(vs >= 0 ? "#16a34a" : "#dc2626");

  Logger.log("Var semanal: " + (vs * 100).toFixed(2) + "% (vs " + fechaBuscada + ")");
}

// ============================================================
//  8. REPORTE DIARIO POR MAIL
// ============================================================

function enviarReporteDiario() {
  var port   = _getHoja(CONFIG.hojas.portfolio);
  var hist   = _getHoja(CONFIG.hojas.historial);
  var tkData = _getTickers();
  if (!port) return;

  var mep      = _getMEP();
  var ccl      = _getCCL();
  var totalUSD = _getValor("Total USD");
  var email    = _getValorStr("Email reporte");

  if (!email || email === "0") {
    Logger.log("Email reporte no configurado en Valores.");
    return;
  }

  // CCL de ayer desde historial (para variación diaria en USD)
  var cclAyer = ccl;
  if (hist && hist.getLastRow() >= 3) {
    var uf   = hist.getLastRow();
    var cclH = _toNum(hist.getRange(uf-1, 6).getValue());
    if (cclH > 0) cclAyer = cclH;
  }

  var cp = CONFIG.port, lr = port.getLastRow();
  var posiciones = [], cashARS = 0, cashUSD = 0;
  var topG = { nombre:"", ticker:"", rend:-999 };
  var topL = { nombre:"", ticker:"", rend: 999 };
  // Acumuladores para yield diario del portfolio (sin cash, reconstruido con CCL histórico)
  var valHoyARS = 0, valHoyUSD = 0, valAyerARS = 0, valAyerUSD = 0;

  if (lr >= 2) {
    port.getRange(2, 1, lr-1, 16).getValues().forEach(function(row) {
      var ticker = row[cp.ticker-1], nombre = row[cp.nombre-1], tipo = row[cp.tipo-1];
      var precio = _toNum(row[cp.precio-1]), totUSD = _toNum(row[cp.totalUSD-1]);
      var pAyer  = _toNum(row[cp.precioAyer-1]), rUSD = _toNum(row[cp.rendUSD-1]);
      var moneda = row[cp.moneda-1] || "ARS";
      var nom    = _toNum(row[cp.nominales-1]);
      if (ticker === "ARS") { cashARS = nom; return; }
      if (ticker === "USD") { cashUSD = nom; return; }
      if (!nombre || tipo === "Cash") return;
      // Acumular valor hoy/ayer por moneda para el yield global
      var pAyerRef = pAyer > 0 ? pAyer : precio;
      if (moneda === "USD") {
        valHoyUSD  += nom * precio;
        valAyerUSD += nom * pAyerRef;
      } else {
        valHoyARS  += nom * precio;
        valAyerARS += nom * pAyerRef;
      }
      // Variación diaria en USD: convertir precios ARS con CCL de cada día
      var rDia = null;
      if (pAyer > 0) {
        if (moneda === "USD") {
          rDia = (precio - pAyer) / pAyer;
        } else {
          var prUSD = ccl > 0 ? precio / ccl : 0;
          var paUSD = cclAyer > 0 ? pAyer / cclAyer : 0;
          rDia = paUSD > 0 ? (prUSD - paUSD) / paUSD : null;
        }
      }
      posiciones.push({ nombre:nombre, ticker:ticker, precio:precio, moneda:moneda, rendUSD:rUSD, rendDia:rDia, totalUSD:totUSD });
      if (rDia !== null && rDia > topG.rend) topG = { nombre:nombre, ticker:ticker, rend:rDia };
      if (rDia !== null && rDia < topL.rend) topL = { nombre:nombre, ticker:ticker, rend:rDia };
    });
  }

  // Yield diario: variación del portfolio (sin cash), reconstruido con CCL histórico
  var yieldDia = null;
  var todayTotalUSD  = valHoyUSD  + (ccl      > 0 ? valHoyARS  / ccl      : 0);
  var yesterTotalUSD = valAyerUSD + (cclAyer  > 0 ? valAyerARS / cclAyer  : 0);
  if (yesterTotalUSD > 0 && yesterTotalUSD !== todayTotalUSD) {
    yieldDia = (todayTotalUSD - yesterTotalUSD) / yesterTotalUSD;
  }

  var cashTotal = cashUSD + (ccl > 0 ? cashARS/ccl : 0);
  posiciones.sort(function(a,b){ return b.totalUSD - a.totalUSD; });

  function fA(n)   { return "$" + Number(n).toLocaleString("es-AR",{maximumFractionDigits:0}); }
  function fU(n)   { return "$" + Number(n).toLocaleString("en-US",{maximumFractionDigits:0}); }
  function fP(n,m) {
    if (m === "USD") return "U$S " + Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
    return n >= 1000 ? "$" + Number(n).toLocaleString("es-AR",{maximumFractionDigits:0}) : "$" + Number(n).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function fPct(n) { return (n >= 0 ? "+" : "") + (n*100).toFixed(1) + "%"; }
  function clr(n)  { return n >= 0 ? "#16a34a" : "#dc2626"; }
  function bg(n)   { return n >= 0 ? "#dcfce7" : "#fee2e2"; }

  var yC    = yieldDia !== null && yieldDia >= 0 ? "#16a34a" : "#dc2626";
  var yT    = yieldDia !== null ? fPct(yieldDia) : "N/D";
  var fecha = Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy");

  var filas = posiciones.map(function(p) {
    var em = tkData.emoji[p.ticker] || "📈";
    var dH = p.rendDia !== null
      ? "<span style='color:"+clr(p.rendDia)+";font-weight:600'>"+fPct(p.rendDia)+"</span>"
      : "<span style='color:#9ca3af'>--</span>";
    return "<tr style='border-bottom:1px solid #f1f5f9'>" +
      "<td style='padding:10px 12px'>" + em + " " + p.nombre + "</td>" +
      "<td style='padding:10px 12px;color:#6b7280;font-size:12px'>" + p.ticker + "</td>" +
      "<td style='padding:10px 12px;text-align:right'>" + fP(p.precio, p.moneda) + "</td>" +
      "<td style='padding:10px 12px;text-align:right'>" + dH + "</td>" +
      "<td style='padding:10px 12px;text-align:right;background:"+bg(p.rendUSD)+";color:"+clr(p.rendUSD)+";font-weight:600'>" + fPct(p.rendUSD) + "</td></tr>";
  }).join("");

  var cashF =
    "<tr style='border-bottom:1px solid #f1f5f9'><td style='padding:10px 12px'>💵 Cash ARS</td><td style='padding:10px 12px;color:#6b7280;font-size:12px'>ARS</td><td colspan='3' style='padding:10px 12px;text-align:right'>" + fA(cashARS) + "</td></tr>" +
    "<tr><td style='padding:10px 12px'>💵 Cash USD</td><td style='padding:10px 12px;color:#6b7280;font-size:12px'>USD</td><td colspan='3' style='padding:10px 12px;text-align:right'>" + fU(cashUSD) + "</td></tr>";

  var html =
    "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif'>" +
    "<div style='max-width:620px;margin:24px auto;border:2px solid #1e3a5f;border-radius:14px;overflow:hidden'>" +
    "<table width='100%' style='background:#0f172a'><tr>" +
      "<td style='padding:18px 24px'><span style='color:#fff;font-size:20px;font-weight:700'>📊 Reporte Diario</span></td>" +
      "<td style='padding:18px 24px;text-align:right'><span style='color:#94a3b8;font-size:13px'>" + fecha + "</span></td>" +
    "</tr></table>" +
    "<table width='100%' style='background:#f1f5f9;padding:14px 14px 0'><tr>" +
      "<td width='33%' style='padding:5px'><div style='background:#fff;border-radius:10px;padding:14px;text-align:center;border:1px solid #e2e8f0'><div style='font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px'>Yield del día</div><div style='font-size:20px;font-weight:700;color:" + yC + "'>" + yT + "</div></div></td>" +
      "<td width='33%' style='padding:5px'><div style='background:#fff;border-radius:10px;padding:14px;text-align:center;border:1px solid #e2e8f0'><div style='font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px'>Dólar CCL</div><div style='font-size:20px;font-weight:700;color:#0f172a'>" + fA(ccl > 0 ? ccl : mep) + "</div></div></td>" +
      "<td width='33%' style='padding:5px'><div style='background:#fff;border-radius:10px;padding:14px;text-align:center;border:1px solid #e2e8f0'><div style='font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px'>Cash total</div><div style='font-size:20px;font-weight:700;color:#0f172a'>" + fU(cashTotal) + "</div></div></td>" +
    "</tr></table>" +
    "<table width='100%' style='background:#f1f5f9;padding:0 14px'><tr>" +
      "<td width='50%' style='padding:5px'><div style='background:#fff;border-radius:10px;padding:10px 14px;border:1px solid #e2e8f0;text-align:center'><div style='font-size:10px;color:#94a3b8;text-transform:uppercase;margin-bottom:3px'>🏆 Top Gainer</div><div style='font-size:13px;font-weight:700;text-align:center'>" + (tkData.emoji[topG.ticker]||"📈") + " " + topG.nombre + "</div><div style='font-size:13px;font-weight:700;color:#16a34a;text-align:center'>" + (topG.rend !== -999 ? fPct(topG.rend) : "--") + "</div></div></td>" +
      "<td width='50%' style='padding:5px'><div style='background:#fff;border-radius:10px;padding:10px 14px;border:1px solid #e2e8f0;text-align:center'><div style='font-size:10px;color:#94a3b8;text-transform:uppercase;margin-bottom:3px'>📉 Top Loser</div><div style='font-size:13px;font-weight:700;text-align:center'>" + (tkData.emoji[topL.ticker]||"📉") + " " + topL.nombre + "</div><div style='font-size:13px;font-weight:700;color:#dc2626;text-align:center'>" + (topL.rend !== 999 ? fPct(topL.rend) : "--") + "</div></div></td>" +
    "</tr></table>" +
    "<div style='background:#f1f5f9;padding:6px 14px'><table style='width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0'><thead><tr style='background:#f8fafc;border-bottom:1px solid #e2e8f0'><th style='padding:9px 12px;text-align:left;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>Posición</th><th style='padding:9px 12px;text-align:left;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>Ticker</th><th style='padding:9px 12px;text-align:right;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>Precio</th><th style='padding:9px 12px;text-align:right;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>% en USD</th><th style='padding:9px 12px;text-align:right;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>Rend. USD</th></tr></thead><tbody>" + filas + "</tbody></table></div>" +
    "<div style='background:#f1f5f9;padding:6px 14px 14px'><table style='width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0'><thead><tr style='background:#f8fafc;border-bottom:1px solid #e2e8f0'><th style='padding:9px 12px;text-align:left;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>Instrumento</th><th style='padding:9px 12px;text-align:left;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>Tipo</th><th style='padding:9px 12px;text-align:right;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase'>Saldo</th></tr></thead><tbody>" + cashF + "</tbody></table></div>" +
    "<div style='background:#0f172a;padding:12px 24px;text-align:center'><span style='color:#475569;font-size:11px'>Portfolio Tracker · " + fecha + " · TC CCL $" + Math.round(ccl > 0 ? ccl : mep).toLocaleString("es-AR") + "</span></div>" +
    "</div></body></html>";

  MailApp.sendEmail({ to:email, subject:"📊 Portfolio " + fecha + (yieldDia !== null ? " · " + yT : ""), htmlBody:html });
  Logger.log("Reporte enviado a " + email);
}

// ============================================================
//  9. FUNCIÓN MAESTRA
// ============================================================

function actualizarTodo() {
  Logger.log("=== Iniciando actualización ===");
  actualizarDolar();
  actualizarPrecios();
  completarOperaciones();
  recalcularPortfolio();
  enviarReporteDiario();
  _guardarSnapshotDiario();
  // precioAyer lo escribe actualizarPrecios() con el previousClose de Yahoo.
  var dia = new Date().getDay();
  if (dia === 5) {
    _guardarPrecioSemanal();
    snapshotSemanal();
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("Portfolio actualizado ✓", "Listo", 4);
}

// ============================================================
//  10. TRIGGERS
// ============================================================

function configurarTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });

  // Actualización completa de lunes a viernes a las 17hs
  ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"].forEach(function(dia){
    ScriptApp.newTrigger("actualizarTodo").timeBased().onWeekDay(ScriptApp.WeekDay[dia]).atHour(17).create();
  });

  // Dólar a las 11hs y 14hs (lunes a viernes)
  ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"].forEach(function(dia){
    ScriptApp.newTrigger("actualizarDolar").timeBased().onWeekDay(ScriptApp.WeekDay[dia]).atHour(11).create();
    ScriptApp.newTrigger("actualizarDolar").timeBased().onWeekDay(ScriptApp.WeekDay[dia]).atHour(14).create();
  });

  ScriptApp.newTrigger("completarOperaciones").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("actualizarPrecios").timeBased().everyMinutes(30).create();

  Logger.log("Triggers configurados.");
}

// ============================================================
//  11. API PARA DASHBOARD HTML
// ============================================================

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action || "";

    var API_TOKEN = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
    if (API_TOKEN && payload.token !== API_TOKEN) {
      return _jsonOut({ error: "Unauthorized" });
    }

    if (action === 'updateEmail') {
      _setValor("Email reporte", payload.email || "");
      return ContentService.createTextOutput(JSON.stringify({ ok: true, mensaje: "Email actualizado" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'deleteOp') {
      var sheet = _getHoja(CONFIG.hojas.operaciones);
      if (!sheet) return _jsonOut({ error: "Hoja no encontrada" });
      var fila = parseInt(payload.fila);
      if (fila < 2 || fila > sheet.getLastRow()) return _jsonOut({ error: "Fila inválida" });
      sheet.deleteRow(fila);
      recalcularPortfolio();
      return _jsonOut({ ok: true, mensaje: "Operación eliminada" });
    }

    if (action === 'editOp') {
      var sheet = _getHoja(CONFIG.hojas.operaciones);
      if (!sheet) return _jsonOut({ error: "Hoja no encontrada" });
      var fila = parseInt(payload.fila);
      if (fila < 2 || fila > sheet.getLastRow()) return _jsonOut({ error: "Fila inválida" });

      var fecha     = payload.fecha;
      var orden     = payload.orden;
      var ticker    = payload.ticker ? payload.ticker.toUpperCase().trim() : "";
      var tipo      = payload.tipo;
      var moneda    = payload.moneda;
      var nominales = _toNum(payload.nominales);
      var precio    = _toNum(payload.precio);

      if (!fecha || !orden || !ticker || !tipo || !moneda || nominales <= 0 || precio <= 0) {
        return _jsonOut({ error: "Faltan campos obligatorios" });
      }

      var fechaObj = _parseFecha(fecha);
      var tkData = _getTickers();
      var nombre = payload.nombre || tkData.nombres[ticker] || "";
      var tc = _getCCLHistorico(fechaObj);
      var precioUSD, totalARS, totalUSD;

      if (moneda === "USD") {
        precioUSD = precio;
        totalUSD  = parseFloat((precio * nominales).toFixed(2));
        totalARS  = tc > 0 ? Math.round(totalUSD * tc) : 0;
      } else {
        precioUSD = tc > 0 ? parseFloat((precio / tc).toFixed(4)) : 0;
        totalARS  = precio * nominales;
        totalUSD  = tc > 0 ? parseFloat((totalARS / tc).toFixed(2)) : 0;
      }

      sheet.getRange(fila, 1, 1, 12).setValues([[
        fechaObj, orden, ticker, nombre, tipo, moneda,
        nominales, precio, precioUSD, tc, totalARS, totalUSD
      ]]);
      sheet.getRange(fila, 1).setNumberFormat("dd/mm/yyyy");
      sheet.getRange(fila, 7).setNumberFormat("#,##0");
      sheet.getRange(fila, 8, 1, 3).setNumberFormat("#,##0.00");
      sheet.getRange(fila, 10).setNumberFormat("#,##0.00");
      sheet.getRange(fila, 11, 1, 2).setNumberFormat("#,##0.00");

      _registrarTickers([ticker], nombre ? { [ticker]: nombre } : {});
      recalcularPortfolio();
      return _jsonOut({ ok: true, mensaje: "Operación actualizada" });
    }

    if (action === 'updateNominalesCash') {
      var ticker    = payload.ticker ? payload.ticker.toUpperCase().trim() : "";
      var nominales = _toNum(payload.nominales);
      if (!ticker || (ticker !== "ARS" && ticker !== "USD")) {
        return _jsonOut({ error: "Ticker debe ser ARS o USD" });
      }

      var currentBalance = _computeCashBalance(ticker);
      var delta = nominales - currentBalance;
      if (Math.abs(delta) < 0.001) return _jsonOut({ ok: true, mensaje: "Sin cambios" });

      var eftHoja = _getHoja(CONFIG.hojas.efectivo);
      if (!eftHoja) return _jsonOut({ error: "Hoja Efectivo no encontrada" });

      var tipo  = delta > 0 ? "Depósito" : "Extracción";
      var monto = Math.abs(delta);
      var fila  = eftHoja.getLastRow() + 1;
      eftHoja.getRange(fila, 1, 1, 5).setValues([[new Date(), tipo, ticker, monto, "Ajuste desde widget"]]);
      eftHoja.getRange(fila, 1).setNumberFormat("dd/mm/yyyy");
      eftHoja.getRange(fila, 4).setNumberFormat("#,##0.00");

      recalcularPortfolio();
      return _jsonOut({ ok: true, mensaje: tipo + " de " + ticker + ": " + monto.toFixed(2) });
    }

    if (action === 'addEfectivo') {
      var eftHoja = _getHoja(CONFIG.hojas.efectivo);
      if (!eftHoja) return _jsonOut({ error: "Hoja Efectivo no encontrada" });
      var fecha  = payload.fecha;
      var tipo   = payload.tipo;
      var moneda = payload.moneda;
      var monto  = _toNum(payload.monto);
      var nota   = payload.nota || "";
      if (!fecha || !tipo || !moneda || monto <= 0) {
        return _jsonOut({ error: "Faltan campos: fecha, tipo, moneda, monto" });
      }
      if (tipo !== "Depósito" && tipo !== "Extracción") {
        return _jsonOut({ error: "Tipo debe ser Depósito o Extracción" });
      }
      var fechaObj = _parseFecha(fecha);
      var fila     = eftHoja.getLastRow() + 1;
      eftHoja.getRange(fila, 1, 1, 5).setValues([[fechaObj, tipo, moneda, monto, nota]]);
      eftHoja.getRange(fila, 1).setNumberFormat("dd/mm/yyyy");
      eftHoja.getRange(fila, 4).setNumberFormat("#,##0.00");
      recalcularPortfolio();
      return _jsonOut({ ok: true, fila: fila, mensaje: tipo + " de " + moneda + " registrada" });
    }

    if (action === 'deleteEfectivo') {
      var eftHoja = _getHoja(CONFIG.hojas.efectivo);
      if (!eftHoja) return _jsonOut({ error: "Hoja Efectivo no encontrada" });
      var fila = parseInt(payload.fila);
      if (fila < 2 || fila > eftHoja.getLastRow()) {
        return _jsonOut({ error: "Fila inválida" });
      }
      eftHoja.deleteRow(fila);
      recalcularPortfolio();
      return _jsonOut({ ok: true, mensaje: "Movimiento eliminado" });
    }

    if (action === 'updatePrecioManual') {
      var ticker = payload.ticker ? payload.ticker.toUpperCase().trim() : "";
      var precio = _toNum(payload.precio);
      if (!ticker || precio <= 0) return _jsonOut({ error: "Ticker y precio requeridos" });

      var h = _getHoja(CONFIG.hojas.tickers);
      if (!h) return _jsonOut({ error: "Hoja Tickers no encontrada" });
      var datos = h.getLastRow() >= 2 ? h.getRange(2, 1, h.getLastRow()-1, 1).getValues() : [];
      var found = false;
      for (var i = 0; i < datos.length; i++) {
        if (datos[i][0] === ticker) {
          h.getRange(i + 2, 6).setValue(precio);
          found = true;
          break;
        }
      }
      if (!found) return _jsonOut({ error: "Ticker no encontrado en hoja Tickers" });

      var port = _getHoja(CONFIG.hojas.portfolio);
      if (port && port.getLastRow() >= 2) {
        var portData = port.getRange(2, 1, port.getLastRow()-1, 1).getValues();
        for (var i = 0; i < portData.length; i++) {
          if (portData[i][0] === ticker) {
            port.getRange(i + 2, CONFIG.colPrecio).setValue(precio);
            break;
          }
        }
      }
      recalcularPortfolio();
      return _jsonOut({ ok: true, mensaje: "Precio manual de " + ticker + " actualizado a " + precio });
    }

    // ── NUEVA OPERACIÓN (default) ──
    var sheet = _getHoja(CONFIG.hojas.operaciones);
    if (!sheet) return _jsonOut({ error: "Hoja Operaciones no encontrada" });

    var fecha     = payload.fecha;
    var orden     = payload.orden;
    var ticker    = payload.ticker ? payload.ticker.toUpperCase().trim() : "";
    var tipo      = payload.tipo;
    var moneda    = payload.moneda;
    var nominales = _toNum(payload.nominales);
    var precio    = _toNum(payload.precio);

    if (!fecha || !orden || !ticker || !tipo || !moneda || nominales <= 0 || precio <= 0) {
      return _jsonOut({ error: "Faltan campos obligatorios" });
    }

    var fechaObj = _parseFecha(fecha);
    var tkData = _getTickers();
    var nombre = payload.nombre || tkData.nombres[ticker] || "";

    var tc = _getCCLHistorico(fechaObj);
    var precioUSD, totalARS, totalUSD;

    if (moneda === "USD") {
      precioUSD = precio;
      totalUSD  = parseFloat((precio * nominales).toFixed(2));
      totalARS  = tc > 0 ? Math.round(totalUSD * tc) : 0;
    } else {
      precioUSD = tc > 0 ? parseFloat((precio / tc).toFixed(4)) : 0;
      totalARS  = precio * nominales;
      totalUSD  = tc > 0 ? parseFloat((totalARS / tc).toFixed(2)) : 0;
    }

    var fila = sheet.getLastRow() + 1;
    sheet.getRange(fila, 1, 1, 12).setValues([[
      fechaObj, orden, ticker, nombre, tipo, moneda,
      nominales, precio, precioUSD, tc, totalARS, totalUSD
    ]]);

    sheet.getRange(fila, 1).setNumberFormat("dd/mm/yyyy");
    sheet.getRange(fila, 7).setNumberFormat("#,##0");
    sheet.getRange(fila, 8, 1, 3).setNumberFormat("#,##0.00");
    sheet.getRange(fila, 10).setNumberFormat("#,##0.00");
    sheet.getRange(fila, 11, 1, 2).setNumberFormat("#,##0.00");

    _registrarTickers([ticker], nombre ? { [ticker]: nombre } : {});
    if (!nombre) {
      tkData = _getTickers();
      nombre = tkData.nombres[ticker] || "";
      if (nombre) sheet.getRange(fila, 4).setValue(nombre);
    }

    recalcularPortfolio();

    return _jsonOut({
      ok: true,
      fila: fila,
      mensaje: orden + " de " + ticker + " registrada"
    });

  } catch(err) {
    return _jsonOut({ error: err.message });
  }
}

function _jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function _parseFecha(fecha) {
  if (fecha.includes("/")) {
    var p = fecha.split("/");
    return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
  } else {
    var p = fecha.split("-");
    return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  }
}

function _getBenchmarkData(symbol) {
  // Últimos 6 meses de datos diarios desde Yahoo Finance
  var now    = Math.floor(Date.now() / 1000);
  var desde  = now - 180 * 86400;
  var url    = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol)
             + "?period1=" + desde + "&period2=" + now + "&interval=1d";
  var res    = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Google-Apps-Script)" }
  });
  var data   = JSON.parse(res.getContentText());
  var result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.timestamp) return [];

  var timestamps = result.timestamp;
  var closes     = (result.indicators && result.indicators.quote &&
                    result.indicators.quote[0] && result.indicators.quote[0].close) || [];
  if (closes.length === 0) return [];
  var out        = [];
  for (var i = 0; i < timestamps.length; i++) {
    if (closes[i] === null || closes[i] === undefined) continue;
    var d = new Date(timestamps[i] * 1000);
    var fecha = Utilities.formatDate(d, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
    out.push({ fecha: fecha, close: closes[i] });
  }
  return out;
}

function doGet(e) {
  var API_TOKEN = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  if (API_TOKEN && e.parameter.token !== API_TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = e.parameter.sheet;

  if (!sheet || ALLOWED_SHEETS.indexOf(sheet) === -1) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Hoja no permitida: " + sheet }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Benchmark: devolver datos históricos de Yahoo Finance
  if (sheet === "Benchmark") {
    var symbol = e.parameter.symbol || "";
    if (!symbol) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Falta parámetro symbol" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try {
      var benchData = _getBenchmarkData(symbol);
      return ContentService.createTextOutput(JSON.stringify(benchData))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  var ws    = ss.getSheetByName(sheet);
  if (!ws) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Hoja no encontrada: " + sheet }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var data    = ws.getDataRange().getValues();
  var headers = data[0];
  var rows    = data.slice(1).filter(function(r){ return r[0] !== "" && r[0] !== null; });

  var isOps = sheet === CONFIG.hojas.operaciones;
  var isEft = sheet === CONFIG.hojas.efectivo;

  var tkOnline = {};
  if (sheet === CONFIG.hojas.portfolio) {
    var tkH = ss.getSheetByName(CONFIG.hojas.tickers);
    if (tkH && tkH.getLastRow() >= 2) {
      var tkData = tkH.getRange(2, 1, tkH.getLastRow()-1, 4).getValues();
      tkData.forEach(function(r) { if (r[0]) tkOnline[r[0]] = r[3]; });
    }
  }

  var result  = [];
  for (var ri = 1; ri < data.length; ri++) {
    var r = data[ri];
    if (r[0] === "" || r[0] === null) continue;
    var obj = {};
    headers.forEach(function(h,i){
      obj[h] = r[i] instanceof Date
        ? Utilities.formatDate(r[i], "America/Argentina/Buenos_Aires", "dd/MM/yyyy")
        : r[i];
    });
    if (isOps || isEft) obj['_fila'] = ri + 1;
    if (sheet === CONFIG.hojas.portfolio && obj['Ticker']) {
      obj['_online'] = tkOnline[obj['Ticker']] || "No";
    }
    result.push(obj);
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
