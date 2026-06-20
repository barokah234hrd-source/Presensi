// ==========================================
// KONFIGURASI UTAMA
// ==========================================
var FOLDER_ID = "1t0RqDrZMEigzZm86ew4umLiNEEr-ewPG"; 
var SPREADSHEET_ID = "1R86-Wfo4z3jVMRB4H8YCViTT9Ok-7b1DVyXwbLWtqa0";
var SHEET_NAME = "Data"; // PENTING: Sesuaikan dengan nama tab di Spreadsheet Anda

// 1. HANDLER UNTUK MENGAMBIL DATA (GET) - UNTUK HRD/ADMIN
function doGet() {
  try {
    // Mengunci nama tab secara spesifik agar tidak salah tulis
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    // Cegah error jika nama sheet salah
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Tab sheet dengan nama '" + SHEET_NAME + "' tidak ditemukan." })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    var rows = [];
    
    // Iterasi dimulai dari baris ke-2 (melewati header)
    for (var i = 1; i < data.length; i++) {
      rows.push({
        waktu: data[i][0],
        nama: data[i][1],
        username: data[i][2],
        tipe: data[i][3],
        lat: data[i][4],
        lng: data[i][5],
        alamat: data[i][6],
        foto: data[i][7]
      });
    }
    
    rows.reverse();

    return ContentService.createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. HANDLER UNTUK MENYIMPAN DATA (POST) - UNTUK ABSENSI KARYAWAN
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var username = data.username;
    var nama = data.nama;
    var tipe = data.tipe; 
    var lat = data.lat;
    var lng = data.lng;
    var alamat = data.alamat; 
    var imageBase64 = data.image; 

    // Simpan Gambar ke Google Drive
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var contentType = imageBase64.substring(5, imageBase64.indexOf(';'));
    var bytes = Utilities.base64Decode(imageBase64.split(',')[1]);
    
    var timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
    var fileName = "Absen_" + tipe + "_" + username + "_" + timestamp + ".jpg";
    var blob = Utilities.newBlob(bytes, contentType, fileName);
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = file.getUrl();

    // Mengunci nama tab secara spesifik
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error("Tab sheet dengan nama '" + SHEET_NAME + "' tidak ditemukan di spreadsheet.");
    }

    var waktuAbsen = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
    
    // Tulis baris baru
    sheet.appendRow([waktuAbsen, nama, username, tipe, lat, lng, alamat, fileUrl]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success", 
      message: "Data absensi " + tipe + " berhasil disimpan!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", 
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}
