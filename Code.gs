/**
 * ==============================================================================
 * QLCV TTHT - Google Apps Script Backend REST API & Web Application Service
 * Spreadsheet ID: 1-9-4G5wZUzqmGey5Dn5ys-iDW0jfJScLnC6sE9S3Cs4 / 13ggsO-iGlpspavwuBk8g6ZmAqcRsOmE8dZZZl8t_oLE
 * ==============================================================================
 */

var DEFAULT_SPREADSHEET_ID = "1-9-4G5wZUzqmGey5Dn5ys-iDW0jfJScLnC6sE9S3Cs4";

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SPREADSHEET_ID") || DEFAULT_SPREADSHEET_ID;
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  }
}

/**
 * Serves HTML web page or JSON API responses via GET
 */
function extractIdHelper(data, paramObj) {
  if (!data && !paramObj) return "";
  if (typeof data === "string" || typeof data === "number") return String(data);
  if (typeof data === "object") {
    var idVal = data.id || data.ID || data.maNV || data.Mã_NV || data['Mã NV'];
    if (idVal) return String(idVal);
  }
  if (paramObj) {
    var pVal = paramObj.id || paramObj.ID || paramObj.maNV || paramObj.Mã_NV || paramObj['Mã NV'];
    if (pVal) return String(pVal);
  }
  return "";
}

function doGet(e) {
  e = e || { parameter: {} };
  var action = e.parameter.action;

  if (action) {
    var responseData = {};
    try {
      if (action === "getAllData") {
        responseData = apiGetAllData();
      } else if (action === "getTasks") {
        responseData = { success: true, data: apiGetSheetData("QLCV") };
      } else if (action === "getUsers") {
        responseData = { success: true, data: apiGetUsersData() };
      } else if (action === "getTTTasks") {
        responseData = { success: true, data: apiGetSheetData("TT_giaoviec") };
      } else if (action === "getDocuments") {
        responseData = { success: true, data: apiGetDocumentsData() };
      } else if (action === "getSpecialTasks") {
        responseData = { success: true, data: apiGetSheetData("cvluuy") };
      } else if (action === "deleteTask") {
        responseData = apiDeleteTask(extractIdHelper(null, e.parameter));
      } else if (action === "deleteTTTask") {
        responseData = apiDeleteTTTask(extractIdHelper(null, e.parameter));
      } else if (action === "deleteDocument") {
        responseData = apiDeleteDocument(extractIdHelper(null, e.parameter));
      } else if (action === "deleteUser") {
        responseData = apiDeleteUser(extractIdHelper(null, e.parameter));
      } else if (action === "deleteSpecialTask") {
        responseData = apiDeleteSpecialTask(extractIdHelper(null, e.parameter));
      } else {
        responseData = { success: false, error: "Action GET không hợp lệ: " + action };
      }
    } catch (err) {
      responseData = { success: false, error: err.toString() };
    }
    return jsonResponse(responseData);
  }

  // Render HTML Web App
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("QLCV TTHT - Quản lý Công việc & Hồ sơ")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include helper for Apps Script HTML Service (CSS/JS files inside GAS)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Handles JSON API POST requests (For Standalone / Vercel hosting)
 */
function doPost(e) {
  var responseData = {};
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    var action = postData.action;
    var data = postData.data || postData;

    if (action === "getAllData") {
      responseData = apiGetAllData();
    } else if (action === "saveTask") {
      responseData = apiSaveTask(data);
    } else if (action === "updateTaskInline") {
      responseData = apiUpdateTaskInline(data);
    } else if (action === "deleteTask") {
      responseData = apiDeleteTask(extractIdHelper(data, e ? e.parameter : null));
    } else if (action === "saveTTTask") {
      responseData = apiSaveTTTask(data);
    } else if (action === "updateTTTaskInline") {
      responseData = apiUpdateTTTaskInline(data);
    } else if (action === "deleteTTTask") {
      responseData = apiDeleteTTTask(extractIdHelper(data, e ? e.parameter : null));
    } else if (action === "saveDocument") {
      responseData = apiSaveDocument(data);
    } else if (action === "deleteDocument") {
      responseData = apiDeleteDocument(extractIdHelper(data, e ? e.parameter : null));
    } else if (action === "saveUser") {
      responseData = apiSaveUser(data);
    } else if (action === "deleteUser") {
      responseData = apiDeleteUser(extractIdHelper(data, e ? e.parameter : null));
    } else if (action === "saveSpecialTask") {
      responseData = apiSaveSpecialTask(data);
    } else if (action === "deleteSpecialTask") {
      responseData = apiDeleteSpecialTask(extractIdHelper(data, e ? e.parameter : null));
    } else {
      responseData = { success: false, error: "Action POST không hợp lệ: " + action };
    }
  } catch (err) {
    responseData = { success: false, error: err.toString() };
  }
  return jsonResponse(responseData);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// DIRECT APPS SCRIPT API METHODS (Called by google.script.run or API)
// ==============================================================================

function apiGetAllData() {
  return {
    success: true,
    tasks: apiGetSheetData("QLCV"),
    users: apiGetUsersData(),
    ttTasks: apiGetSheetData("TT_giaoviec"),
    nhanvien: apiGetSheetData("nhanvien"),
    cvluuy: apiGetSheetData("cvluuy"),
    documents: apiGetDocumentsData()
  };
}

/**
 * Flexible header parser for reading sheets into standardized JS Objects
 */
function apiGetSheetData(sheetName) {
  var ss = getSpreadsheet();
  var sheet = getSheetByNameFlexible(ss, sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var rawHeaders = data[0];
  var headers = rawHeaders.map(function(h) {
    return normalizeHeaderKey(String(h));
  });

  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var isEmpty = row.every(function(cell) { return cell === "" || cell === null; });
    if (isEmpty) continue;

    var item = { _rowIndex: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      if (key) {
        var val = row[j];
        if (val instanceof Date) {
          val = formatDate(val);
        }
        item[key] = val !== undefined ? val : "";
      }
    }
    results.push(item);
  }
  return results;
}

function apiGetUsersData() {
  var ss = getSpreadsheet();
  var sheet = getSheetByNameFlexible(ss, "user") || 
              getSheetByNameFlexible(ss, "User") || 
              getSheetByNameFlexible(ss, "Users") || 
              getSheetByNameFlexible(ss, "Nguoidung") || 
              getSheetByNameFlexible(ss, "nhanvien");
  
  if (!sheet) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sName = sheets[i].getName().toLowerCase();
      if (sName.indexOf("user") !== -1 || sName.indexOf("nguoi") !== -1 || sName.indexOf("nhan") !== -1) {
        return apiGetSheetData(sheets[i].getName());
      }
    }
    for (var j = 0; j < sheets.length; j++) {
      var headers = sheets[j].getRange(1, 1, 1, Math.min(sheets[j].getLastColumn(), 10)).getValues()[0];
      var hStr = headers.join(" ").toLowerCase();
      if (hStr.indexOf("tên") !== -1 || hStr.indexOf("mã nv") !== -1) {
        return apiGetSheetData(sheets[j].getName());
      }
    }
    return [];
  }
  return apiGetSheetData(sheet.getName());
}

function apiGetDocumentsData() {
  var ss = getSpreadsheet();
  var sheet = getSheetByNameFlexible(ss, "hoso") || getSheetByNameFlexible(ss, "Documents");
  if (!sheet) return [];
  return apiGetSheetData(sheet.getName());
}

// ==============================================================================
// SAVE & UPDATE DATA HELPERS
// ==============================================================================

function apiSaveTask(taskData) {
  return saveOrUpdateRow("QLCV", taskData, "ID");
}

function apiUpdateTaskInline(updateData) {
  var ss = getSpreadsheet();
  var sheet = getSheetByNameFlexible(ss, "QLCV");
  if (!sheet) return { success: false, error: "Không tìm thấy Sheet QLCV" };

  var taskId = updateData.id || updateData.ID;
  if (!taskId) return { success: false, error: "Thiếu ID công việc" };

  var rowIdx = findRowIndexById(sheet, taskId, "ID");
  if (rowIdx === -1) return { success: false, error: "Không tìm thấy dòng có ID: " + taskId };

  var headers = sheet.getRowData ? sheet.getRowData()[0] : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var normalizedHeaders = headers.map(function(h) { return normalizeHeaderKey(String(h)); });

  for (var key in updateData) {
    if (key === "id" || key === "ID" || key === "_rowIndex") continue;
    var normKey = normalizeHeaderKey(key);
    var colIdx = normalizedHeaders.indexOf(normKey);
    if (colIdx !== -1) {
      sheet.getRange(rowIdx, colIdx + 1).setValue(updateData[key]);
    }
  }

  // Recalculate Tỷ lệ if Kế hoạch & Thực hiện are passed
  recalculateTaskRow(sheet, rowIdx, normalizedHeaders);

  return { success: true, message: "Cập nhật thành công" };
}

function apiDeleteTask(taskId) {
  return deleteRowById("QLCV", taskId, "ID");
}

function apiSaveTTTask(taskData) {
  return saveOrUpdateRow("TT_giaoviec", taskData, "ID");
}

function apiUpdateTTTaskInline(updateData) {
  var ss = getSpreadsheet();
  var sheet = getSheetByNameFlexible(ss, "TT_giaoviec");
  if (!sheet) return { success: false, error: "Không tìm thấy Sheet TT_giaoviec" };

  var taskId = updateData.id || updateData.ID;
  if (!taskId) return { success: false, error: "Thiếu ID công việc" };

  var rowIdx = findRowIndexById(sheet, taskId, "ID");
  if (rowIdx === -1) return { success: false, error: "Không tìm thấy dòng có ID: " + taskId };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var normalizedHeaders = headers.map(function(h) { return normalizeHeaderKey(String(h)); });

  for (var key in updateData) {
    if (key === "id" || key === "ID" || key === "_rowIndex") continue;
    var normKey = normalizeHeaderKey(key);
    var colIdx = normalizedHeaders.indexOf(normKey);
    if (colIdx !== -1) {
      sheet.getRange(rowIdx, colIdx + 1).setValue(updateData[key]);
    }
  }

  recalculateTaskRow(sheet, rowIdx, normalizedHeaders);
  return { success: true, message: "Cập nhật thành công" };
}

function apiDeleteTTTask(taskId) {
  return deleteRowById("TT_giaoviec", taskId, "ID");
}

function apiSaveDocument(docData) {
  var sheetName = getSheetByNameFlexible(getSpreadsheet(), "hoso") ? "hoso" : "Documents";
  return saveOrUpdateRow(sheetName, docData, "ID");
}

function apiDeleteDocument(docId) {
  var sheetName = getSheetByNameFlexible(getSpreadsheet(), "hoso") ? "hoso" : "Documents";
  return deleteRowById(sheetName, docId, "ID");
}

function apiSaveUser(userData) {
  var sheetName = getSheetByNameFlexible(getSpreadsheet(), "user") ? "user" : "Nguoidung";
  return saveOrUpdateRow(sheetName, userData, "Mã NV");
}

function apiDeleteUser(maNV) {
  var sheetName = getSheetByNameFlexible(getSpreadsheet(), "user") ? "user" : "Nguoidung";
  return deleteRowById(sheetName, maNV, "Mã NV");
}

function apiSaveSpecialTask(taskData) {
  return saveOrUpdateRow("cvluuy", taskData, "ID");
}

function apiDeleteSpecialTask(taskId) {
  return deleteRowById("cvluuy", taskId, "ID");
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

function getSheetByNameFlexible(ss, name) {
  var sheets = ss.getSheets();
  var search = name.toLowerCase().trim();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().trim() === search) {
      return sheets[i];
    }
  }
  return null;
}

function normalizeHeaderKey(header) {
  if (!header) return "";
  var str = String(header).trim();
  var mapKeys = {
    "id": "ID",
    "mã công việc": "ID",
    "tiêu đề": "Tiêu đề",
    "tiêu đề công việc": "Tiêu đề",
    "mô tả": "Mô tả",
    "nội dung": "Mô tả",
    "mã lđ": "Mã LĐ",
    "mã lãnh đạo": "Mã LĐ",
    "lãnh đạo": "Lãnh đạo",
    "tổ chủ trì (ar)": "Tổ chủ trì (AR)",
    "tổ chủ trì": "Tổ chủ trì (AR)",
    "tổ (r)": "Tổ (R)",
    "tổ phối hợp": "Tổ (R)",
    "mã nv (a)": "Mã NV (A)",
    "tên nv (a)": "Tên NV (A)",
    "mã nv (r)": "Mã NV (R)",
    "tên nv (r)": "Tên NV (R)",
    "mã nv (c)": "Mã NV (C)",
    "tên nv (c)": "Tên NV (C)",
    "trạng thái": "Trạng thái",
    "mức độ ưu tiên": "Mức độ ưu tiên",
    "ưu tiên": "Mức độ ưu tiên",
    "ngày bắt đầu": "Ngày bắt đầu",
    "ngày kết thúc": "Ngày kết thúc",
    "hạn hoàn thành": "Ngày kết thúc",
    "tiến độ": "Tiến độ",
    "kế hoạch": "Kế hoạch",
    "thực hiện": "Thực hiện",
    "tỷ lệ": "Tỷ lệ",
    "ghi chú": "Ghi chú",
    "ngày làm xong": "Ngày làm xong",
    "tệp đính kèm": "Tệp đính kèm",
    "danh sách công việc con": "Danh sách công việc con",
    "tổ": "Tổ",
    "tổ hạ tầng": "Tổ",
    "mã nv": "Mã NV",
    "mã nhân viên": "Mã NV",
    "tên": "Tên",
    "tên nv": "Tên",
    "tên nhân viên": "Tên",
    "họ và tên": "Tên",
    "chức vụ": "Chức vụ"
  };

  var lower = str.toLowerCase();
  if (mapKeys[lower]) return mapKeys[lower];
  return str;
}

function findRowIndexById(sheet, idValue, idColName) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;
  var headers = data[0].map(function(h) { return normalizeHeaderKey(String(h)); });
  var colIdx = headers.indexOf(normalizeHeaderKey(idColName));
  if (colIdx === -1) colIdx = 0; // Default to column 1

  var searchId = String(idValue).trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]).trim() === searchId) {
      return i + 1; // 1-indexed row number
    }
  }
  return -1;
}

function saveOrUpdateRow(sheetName, itemData, idColName) {
  var ss = getSpreadsheet();
  var sheet = getSheetByNameFlexible(ss, sheetName);
  if (!sheet) {
    // If sheet doesn't exist, create it with header keys
    sheet = ss.insertSheet(sheetName);
    var keys = Object.keys(itemData).filter(function(k) { return k !== "_rowIndex"; });
    sheet.appendRow(keys);
  }

  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var normHeaders = headers.map(function(h) { return normalizeHeaderKey(String(h)); });

  // Generate ID if missing
  var idVal = itemData[idColName] || itemData[normalizeHeaderKey(idColName)] || itemData.id || itemData.ID;
  if (!idVal && idColName === "ID") {
    idVal = "TASK_" + new Date().getTime();
    itemData["ID"] = idVal;
  }

  var existingRowIdx = idVal ? findRowIndexById(sheet, idVal, idColName) : -1;

  if (existingRowIdx > 0) {
    // Update existing row
    for (var k in itemData) {
      if (k === "_rowIndex") continue;
      var nKey = normalizeHeaderKey(k);
      var cIdx = normHeaders.indexOf(nKey);
      if (cIdx !== -1) {
        sheet.getRange(existingRowIdx, cIdx + 1).setValue(itemData[k]);
      }
    }
    recalculateTaskRow(sheet, existingRowIdx, normHeaders);
    return { success: true, message: "Đã cập nhật dữ liệu thành công", id: idVal };
  } else {
    // Append new row
    var newRow = [];
    for (var j = 0; j < normHeaders.length; j++) {
      var keyName = normHeaders[j];
      var val = itemData[keyName] || itemData[getOriginalKey(itemData, keyName)] || "";
      newRow.push(val);
    }
    sheet.appendRow(newRow);
    var lastRow = sheet.getLastRow();
    recalculateTaskRow(sheet, lastRow, normHeaders);
    return { success: true, message: "Đã thêm mới dữ liệu thành công", id: idVal };
  }
}

function deleteRowById(sheetName, idVal, idColName) {
  var ss = getSpreadsheet();
  var sheet = getSheetByNameFlexible(ss, sheetName);
  if (!sheet) return { success: false, error: "Không tìm thấy sheet: " + sheetName };

  var rowIdx = findRowIndexById(sheet, idVal, idColName);
  if (rowIdx === -1) return { success: false, error: "Không tìm thấy bản ghi để xóa" };

  sheet.deleteRow(rowIdx);
  return { success: true, message: "Đã xóa bản ghi thành công" };
}

function recalculateTaskRow(sheet, rowIdx, normHeaders) {
  var keHoachIdx = normHeaders.indexOf("Kế hoạch");
  var thucHienIdx = normHeaders.indexOf("Thực hiện");
  var tyLeIdx = normHeaders.indexOf("Tỷ lệ");
  var tienDoIdx = normHeaders.indexOf("Tiến độ");

  var ngayLamXongIdx = normHeaders.indexOf("Ngày làm xong");
  var ngayKetThucIdx = normHeaders.indexOf("Ngày kết thúc");
  var trangThaiIdx = normHeaders.indexOf("Trạng thái");

  if (keHoachIdx !== -1 && thucHienIdx !== -1) {
    var kh = parseFloat(sheet.getRange(rowIdx, keHoachIdx + 1).getValue()) || 0;
    var th = parseFloat(sheet.getRange(rowIdx, thucHienIdx + 1).getValue()) || 0;
    var ratio = kh > 0 ? Math.min(Math.round((th / kh) * 100), 100) : (th > 0 ? 100 : 0);

    if (tyLeIdx !== -1) {
      sheet.getRange(rowIdx, tyLeIdx + 1).setValue(ratio + "%");
    }
    if (tienDoIdx !== -1) {
      sheet.getRange(rowIdx, tienDoIdx + 1).setValue(ratio + "%");
    }
  }

  if (trangThaiIdx !== -1) {
    var doneVal = ngayLamXongIdx !== -1 ? sheet.getRange(rowIdx, ngayLamXongIdx + 1).getValue() : "";
    var endVal = ngayKetThucIdx !== -1 ? sheet.getRange(rowIdx, ngayKetThucIdx + 1).getValue() : "";
    var currentSt = sheet.getRange(rowIdx, trangThaiIdx + 1).getValue();

    var computedSt = calculateTaskStatusHelper(doneVal, endVal, currentSt);
    if (computedSt && computedSt !== currentSt) {
      sheet.getRange(rowIdx, trangThaiIdx + 1).setValue(computedSt);
    }
  }
}

function calculateTaskStatusHelper(doneDateVal, endDateVal, currentStatus) {
  if (currentStatus === "Đã hủy") return "Đã hủy";

  var doneDate = parseDateStringHelper(doneDateVal);
  var endDate = parseDateStringHelper(endDateVal);
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  if (doneDate) {
    doneDate.setHours(0, 0, 0, 0);
    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
      if (doneDate <= endDate) {
        return "Hoàn thành";
      } else {
        return "Hoàn thành quá hạn";
      }
    } else {
      return "Hoàn thành";
    }
  } else {
    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) {
        return "Quá hạn";
      }
    }
    return currentStatus || "Đang thực hiện";
  }
}

function parseDateStringHelper(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  var str = String(val).trim();
  if (!str) return null;

  if (str.indexOf("/") !== -1) {
    var parts = str.split("/");
    if (parts.length === 3) {
      var d = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) - 1;
      var y = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
    }
  }
  if (str.indexOf("-") !== -1) {
    var parts2 = str.split("-");
    if (parts2.length === 3) {
      var y2 = parseInt(parts2[0], 10);
      var m2 = parseInt(parts2[1], 10) - 1;
      var d2 = parseInt(parts2[2], 10);
      if (!isNaN(d2) && !isNaN(m2) && !isNaN(y2)) return new Date(y2, m2, d2);
    }
  }
  var p = new Date(str);
  return isNaN(p.getTime()) ? null : p;
}

function getOriginalKey(obj, normKey) {
  for (var k in obj) {
    if (normalizeHeaderKey(k) === normKey) return k;
  }
  return normKey;
}

function formatDate(dateObj) {
  if (!(dateObj instanceof Date)) return dateObj;
  var d = dateObj.getDate();
  var m = dateObj.getMonth() + 1;
  var y = dateObj.getFullYear();
  return (d < 10 ? "0" + d : d) + "/" + (m < 10 ? "0" + m : m) + "/" + y;
}
