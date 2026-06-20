import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ========================================================
// 1. KONEKSI FIREBASE & GOOGLE APPS SCRIPT
// ========================================================
const firebaseConfig = {
    apiKey: "AIzaSyAPMFSBBZTlANND0w1yJ87ksZk1r5j6rQ8",
    authDomain: "barokah-418c0.firebaseapp.com",
    projectId: "barokah-418c0",
    storageBucket: "barokah-418c0.firebasestorage.app",
    messagingSenderId: "938643770053",
    appId: "1:938643770053:web:7fcf5ad396b26731fabeac",
};

// URL Google Apps Script Anda (Sesuai dengan project sebelumnya)
const GAS_URL = "https://script.google.com/macros/s/AKfycbzEubNJiq_HJi6Bkv1DEK9BQIBJm8TjuyQXqg6IgU5CBrdFjR3luuhOb-PWCGsdjuit/exec";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;
let currentCoords = { lat: null, lng: null };
let currentDetailedAddress = "Pencarian alamat otomatis...";

const viewLogin = document.getElementById('view-login');
const viewMain = document.getElementById('view-main');
const viewEmployee = document.getElementById('view-employee');
const viewAdmin = document.getElementById('view-admin');

// ========================================================
// 2. SISTEM NAVIGASI & OTENTIKASI LOGIN
// ========================================================
function routeTo(viewName) {
    viewLogin.classList.add('hidden');
    viewMain.classList.add('hidden');
    viewEmployee.classList.add('hidden');
    viewAdmin.classList.add('hidden');

    if (viewName === 'login') {
        viewLogin.classList.remove('hidden');
    } else if (viewName === 'main') {
        viewMain.classList.remove('hidden');
        if (currentUser.role === 'admin') {
            viewAdmin.classList.remove('hidden');
            loadLogAbsensi(); 
        } else {
            viewEmployee.classList.remove('hidden');
            startEmployeeFeatures();
        }
    }
}

document.getElementById('btnLogin').addEventListener('click', async () => {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();
    const loginMsg = document.getElementById('login-msg');

    if (!u || !p) {
        loginMsg.innerText = "Username dan Password tidak boleh kosong!";
        return;
    }

    loginMsg.innerText = "Memverifikasi identitas...";
    
    try {
        const q = query(collection(db, "karyawan"), where("username", "==", u), where("password", "==", p));
        const snap = await getDocs(q);

        if (!snap.empty) {
            currentUser = snap.docs[0].data();
            document.getElementById('user-name').innerText = currentUser.nama;
            loginMsg.innerText = "";
            routeTo('main');
        } else {
            loginMsg.innerText = "Kredensial salah atau tidak terdaftar!";
        }
    } catch (err) {
        loginMsg.innerText = "Gagal terhubung ke database server.";
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    currentUser = null;
    currentCoords = { lat: null, lng: null };
    currentDetailedAddress = "Tidak ada detail alamat";
    const video = document.getElementById('video');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    location.reload();
});

// ========================================================
// 3. REVERSE GEOCODING (PELACAKAN NAMA JALAN GPS)
// ========================================================
async function fetchReverseGeocode(lat, lng) {
    const addrStatus = document.getElementById('addr-status');
    addrStatus.classList.remove('hidden');
    addrStatus.innerHTML = `<div class="loader" style="width:14px; height:14px;"></div> Menemukan alamat rinci lokasi Anda...`;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'id-ID,id;q=0.9' }
        });
        const data = await response.json();
        if (data && data.display_name) {
            currentDetailedAddress = data.display_name;
            addrStatus.innerHTML = `<i class="fa-solid fa-map-location-dot" style="color:var(--primary)"></i> <b>Alamat Terkunci:</b> ${currentDetailedAddress}`;
        } else {
            currentDetailedAddress = `Lat: ${lat}, Lng: ${lng} (Gagal memetakan nama jalan)`;
            addrStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Koordinat terkunci, namun nama jalan tidak ditemukan.`;
        }
    } catch (error) {
        currentDetailedAddress = `Lat: ${lat}, Lng: ${lng}`;
        addrStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Jaringan sibuk, alamat detail gagal dimuat.`;
    }
}

// ========================================================
// 4. FITUR KARYAWAN: KAMERA, WATERMARK & UPLOAD
// ========================================================
function startEmployeeFeatures() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                currentCoords.lat = position.coords.latitude;
                currentCoords.lng = position.coords.longitude;
                document.getElementById('loc-status').className = "loc-success";
                document.getElementById('loc-status').innerHTML = `<i class="fa-solid fa-circle-check"></i> GPS Terkunci (${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)})`;
                document.getElementById('btnAbsen').disabled = false;
                
                await fetchReverseGeocode(currentCoords.lat, currentCoords.lng);
            },
            (error) => {
                document.getElementById('loc-status').innerText = "Akses GPS ditolak! Aktifkan lokasi HP Anda lalu muat ulang.";
            }, 
            { enableHighAccuracy: true }
        );
    } else {
        document.getElementById('loc-status').innerText = "Browser tidak mendukung pendeteksi lokasi.";
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(stream => {
            document.getElementById('video').srcObject = stream;
        })
        .catch(err => {
            document.getElementById('absen-msg').innerHTML = "<span style='color:red;'>Gagal membuka kamera depan. Izinkan izin kamera!</span>";
        });
}

document.getElementById('btnAbsen').addEventListener('click', async () => {
    const btn = document.getElementById('btnAbsen');
    const msg = document.getElementById('absen-msg');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const tipeAbsen = document.getElementById('absen-tipe') ? document.getElementById('absen-tipe').value : "Masuk"; 

    btn.disabled = true;
    msg.innerHTML = `<div class="loader"></div> Memproses foto dan menyematkan watermark...`;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0); 

    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.fillRect(0, canvas.height - 150, canvas.width, 150);

    const timeNow = new Date();
    const tglIso = timeNow.toISOString().split('T')[0]; 
    const strTime = timeNow.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Inter, sans-serif";
    ctx.fillText(`NAMA     : ${currentUser.nama.toUpperCase()}`, 25, canvas.height - 115);
    ctx.fillText(`STATUS   : ABSEN ${tipeAbsen.toUpperCase()} KERJA`, 25, canvas.height - 95);
    ctx.fillText(`WAKTU    : ${strTime} WIB`, 25, canvas.height - 75);
    ctx.fillText(`GPS      : LAT ${currentCoords.lat}, LNG ${currentCoords.lng}`, 25, canvas.height - 55);
    
    ctx.font = "italic 13px Inter, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    let words = currentDetailedAddress.split(' ');
    let line = 'ALAMAT   : ';
    let y = canvas.height - 35;
    let maxWidth = canvas.width - 50;
    
    for(let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, 25, y);
            line = '           ' + words[n] + ' ';
            y += 18;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, 25, y);

    const base64Data = canvas.toDataURL('image/jpeg', 0.75);

    try {
        msg.innerHTML = `<div class="loader"></div> 1/2 Mengunggah foto ke Google Drive...`;

        const gasPayload = {
            fileName: `Absen_${tipeAbsen}_${currentUser.username}_${Date.now()}.jpg`,
            image: base64Data
        };

        const res = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify(gasPayload)
        });

        const gasResult = await res.json();
        
        if (gasResult.status !== "success") {
            throw new Error(gasResult.message);
        }

        const driveUrl = gasResult.url; 

        msg.innerHTML = `<div class="loader"></div> 2/2 Mencatat riwayat ke Firestore...`;
        await addDoc(collection(db, "absensi"), {
            nama: currentUser.nama,
            username: currentUser.username,
            tipe: tipeAbsen,
            waktu_teks: strTime,
            tanggal_iso: tglIso, 
            timestamp: Date.now(),
            lat: currentCoords.lat,
            lng: currentCoords.lng,
            alamat: currentDetailedAddress,
            fotoUrl: driveUrl 
        });

        msg.innerHTML = `<b style="color:var(--success); font-size:16px;"><i class='fa-solid fa-cloud-arrow-up'></i> Sukses! Absen Berhasil.</b>`;
        
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
    } catch (e) {
        msg.innerHTML = `<span style='color:var(--danger);'>Gagal: ${e.message}</span>`;
        btn.disabled = false;
    }
});


// ========================================================
// 5. FITUR ADMIN / HRD: CONTROL TABS NAVIGASI
// ========================================================
const tabs = {
    'tab-log': 'admin-log-section',
    'tab-rekap': 'admin-rekap-section',
    'tab-karyawan': 'admin-karyawan-section'
};

if(document.getElementById('tab-log')) {
    Object.keys(tabs).forEach(tabId => {
        const el = document.getElementById(tabId);
        if(el) {
            el.addEventListener('click', () => {
                Object.keys(tabs).forEach(t => {
                    const e = document.getElementById(t);
                    if(e) e.classList.remove('active');
                    const sec = document.getElementById(tabs[t]);
                    if(sec) sec.classList.add('hidden');
                });
                document.getElementById(tabId).classList.add('active');
                const tSec = document.getElementById(tabs[tabId]);
                if(tSec) tSec.classList.remove('hidden');

                if(tabId === 'tab-log') loadLogAbsensi();
                if(tabId === 'tab-karyawan') loadDatabaseEmployees();
            });
        }
    });
}

// ========================================================
// 6. FITUR ADMIN: LOG HARIAN & PENCARIAN & HAPUS DATA
// ========================================================
let globalAbsenData = []; 

function renderLogHtml(dataArray) {
    const container = document.getElementById('log-container');
    let htmlRows = "";
    
    // Perbarui jumlah total data
    const countTotalEl = document.getElementById('count-total');
    if (countTotalEl) {
        countTotalEl.innerText = dataArray.length;
    }
    
    dataArray.forEach(data => {
        const thumbUrl = data.fotoUrl ? data.fotoUrl.replace('file/d/', 'uc?export=view&id=').replace('/view?usp=drivesdk', '') : '';
        const badgeClass = data.tipe === 'Masuk' ? 'badge-masuk' : 'badge-pulang';
        const mapsLink = `https://www.google.com/maps?q=${data.lat},${data.lng}`;

        htmlRows += `
            <div class="absen-item">
                <img src="${thumbUrl}" onerror="this.src='https://placehold.co/100x100?text=Foto'" onclick="window.open('${data.fotoUrl}', '_blank')">
                <div class="absen-info">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="absen-title-wrapper" style="flex-direction:column; align-items:flex-start;">
                            <div style="display:flex; align-items:center;">
                                <h4 style="margin:0;">${data.nama}</h4>
                                <span class="badge ${badgeClass}">${data.tipe}</span>
                            </div>
                        </div>
                        <button class="btn-delete-log" onclick="window.routerDeleteLog('${data.docId}', '${data.nama}')" title="Hapus log ini"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                    
                    <p style="margin-top:6px;"><i class="fa-regular fa-clock"></i> ${data.waktu_teks}</p>
                    <div class="absen-detail-alamat">
                        <i class="fa-solid fa-map-location-dot" style="color:var(--primary); font-size:11px;"></i> ${data.alamat || "-"}
                    </div>
                    <span class="tag-location">
                        <i class="fa-solid fa-map-pin"></i> 
                        <a href="${mapsLink}" target="_blank" class="map-link">Lihat di Peta</a>
                    </span>
                </div>
            </div>
        `;
    });
    container.innerHTML = htmlRows || "<p class='center-text'>Data tidak ditemukan.</p>";
}

async function loadLogAbsensi() {
    const container = document.getElementById('log-container');
    if(!container) return;
    container.innerHTML = `<p class="center-text"><div class="loader"></div> Mengambil data terbaru...</p>`;
    
    try {
        const q = query(collection(db, "absensi"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        
        globalAbsenData = [];
        
        snap.forEach(doc => {
            const data = doc.data();
            data.docId = doc.id; 
            globalAbsenData.push(data); 
        });
        
        renderLogHtml(globalAbsenData);
    } catch (e) { 
        container.innerHTML = `<p class="center-text" style="color:red;">Error: ${e.message}</p>`; 
    }
}

function applyLogFilters() {
    const keyword = (document.getElementById('search-log')?.value || "").toLowerCase();
    const selectedDate = document.getElementById('filter-log-date')?.value; 

    let filteredData = globalAbsenData;
    if (keyword) {
        filteredData = filteredData.filter(item => item.nama.toLowerCase().includes(keyword));
    }
    if (selectedDate) {
        filteredData = filteredData.filter(item => item.tanggal_iso === selectedDate);
    }
    renderLogHtml(filteredData);
}

if(document.getElementById('btnRefresh')) {
    document.getElementById('btnRefresh').addEventListener('click', () => {
        if(document.getElementById('search-log')) document.getElementById('search-log').value = ""; 
        if(document.getElementById('filter-log-date')) document.getElementById('filter-log-date').value = ""; 
        loadLogAbsensi();
    });
}

if(document.getElementById('search-log')) {
    document.getElementById('search-log').addEventListener('keyup', applyLogFilters);
}

if(document.getElementById('filter-log-date')) {
    document.getElementById('filter-log-date').addEventListener('change', applyLogFilters);
}

window.routerDeleteLog = async function(docId, nama) {
    if (confirm(`Apakah Anda yakin ingin menghapus catatan absen milik ${nama}? Tindakan ini tidak bisa dibatalkan.`)) {
        try {
            await deleteDoc(doc(db, "absensi", docId));
            globalAbsenData = globalAbsenData.filter(item => item.docId !== docId);
            renderLogHtml(globalAbsenData);
        } catch (err) {
            alert("Gagal menghapus log: " + err.message);
        }
    }
};

// ========================================================
// 7. FITUR ADMIN: FILTER REKAPITULASI (MATRIKS) & EXPORT EXCEL
// ========================================================
let globalRekapState = null;

if(document.getElementById('btnGenerateRekap')) {
    document.getElementById('btnGenerateRekap').addEventListener('click', async () => {
        const start = document.getElementById('filter-start').value; 
        const end = document.getElementById('filter-end').value;
        const container = document.getElementById('rekap-container');
        const btnExport = document.getElementById('btnExportRekapExcel');

        if (!start || !end) return alert("Harap tentukan tanggal awal dan akhir!");
        
        const startDate = new Date(start);
        const endDate = new Date(end);

        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if(diffDays > 31) return alert("Rentang waktu maksimal untuk satu layar adalah 31 hari!");

        container.innerHTML = `<p class="center-text"><div class="loader"></div> Menyusun matriks data absensi...</p>`;
        if(btnExport) btnExport.classList.add('hidden'); 

        try {
            const snapKaryawan = await getDocs(collection(db, "karyawan"));
            let listKaryawan = [];
            snapKaryawan.forEach(doc => listKaryawan.push(doc.data()));

            const q = query(collection(db, "absensi"), 
                where("tanggal_iso", ">=", start), 
                where("tanggal_iso", "<=", end)
            );
            const snapAbsen = await getDocs(q);
            
            let absenMap = {};
            snapAbsen.forEach(doc => {
                const d = doc.data();
                if(!absenMap[d.username]) absenMap[d.username] = {};
                absenMap[d.username][d.tanggal_iso] = true;
            });

            let dateColumns = [];
            let currDate = new Date(startDate);
            while (currDate <= endDate) {
                dateColumns.push(currDate.toISOString().split('T')[0]);
                currDate.setDate(currDate.getDate() + 1);
            }

            globalRekapState = { listKaryawan, dateColumns, absenMap, start, end };

            let html = `
                <div class="rekap-legend">
                    <div class="legend-item"><div class="legend-box" style="background:#22c55e;"></div> Hadir</div>
                    <div class="legend-item"><div class="legend-box" style="background:#ef4444;"></div> Libur / Tidak Hadir</div>
                </div>
                <div class="table-responsive">
                    <table class="rekap-table">
                        <thead>
                            <tr>
                                <th>Nama Karyawan</th>
            `;

            dateColumns.forEach(dateIso => {
                const tglAngka = dateIso.split('-')[2]; 
                html += `<th>${tglAngka}</th>`;
            });
            html += `</tr></thead><tbody>`;

            listKaryawan.forEach(emp => {
                html += `<tr><td class="nama-karyawan">${emp.nama}</td>`;
                
                dateColumns.forEach(dateIso => {
                    const isHadir = absenMap[emp.username] && absenMap[emp.username][dateIso];
                    const cellClass = isHadir ? 'cell-hadir' : 'cell-libur';
                    const tooltipText = isHadir ? 'Hadir' : 'Tidak Hadir';
                    
                    html += `<td class="${cellClass}" title="${emp.nama} - ${dateIso} : ${tooltipText}"></td>`;
                });
                
                html += `</tr>`;
            });

            html += `</tbody></table></div>`;
            container.innerHTML = html;

            if(btnExport) btnExport.classList.remove('hidden');

        } catch (e) {
            container.innerHTML = `<p style="color:red;">Error Filter: ${e.message}</p>`;
        }
    });
}

// Logika Saat Tombol Export Excel Diklik (Disesuaikan untuk Excel Indonesia)
// Logika Saat Tombol Export Excel Diklik (Ditingkatkan ke Format Asli .xlsx Berwarna)
if(document.getElementById('btnExportRekapExcel')) {
    document.getElementById('btnExportRekapExcel').addEventListener('click', async () => {
        if(!globalRekapState) return alert("Silakan tampilkan rangkuman terlebih dahulu!");

        const { listKaryawan, dateColumns, absenMap, start, end } = globalRekapState;
        const btnExport = document.getElementById('btnExportRekapExcel');
        
        // Ubah tombol jadi status loading agar tidak diklik dua kali
        const originalText = btnExport.innerHTML;
        btnExport.innerHTML = `<div class="loader" style="width:14px; height:14px; border-width:2px; margin-right:5px;"></div> Memproses .xlsx...`;
        btnExport.disabled = true;

        try {
            // 1. Buat Buku Kerja Excel Baru (Membutuhkan library ExcelJS)
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Rekap Absensi');

            // 2. Susun Header (Baris Pertama Tanggal)
            let headerRow = ['Nama Karyawan', ...dateColumns];
            const header = worksheet.addRow(headerRow);
            
            // Beri Gaya (Styling) pada Header
            header.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Teks Putih
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; // Latar Abu-abu Gelap
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });

            // Lebarkan kolom pertama (Nama Karyawan) agar tidak terpotong
            worksheet.getColumn(1).width = 25;

            // 3. Isi Data Karyawan dan Warnai Sel Kotaknya
            listKaryawan.forEach(emp => {
                let rowData = [emp.nama];
                
                dateColumns.forEach(dateIso => {
                    const isHadir = absenMap[emp.username] && absenMap[emp.username][dateIso];
                    rowData.push(isHadir ? "Hadir" : "Libur");
                });

                const row = worksheet.addRow(rowData);

                // Beri warna setiap sel di baris ini
                row.eachCell((cell, colNumber) => {
                    // Beri garis pembatas tabel
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    
                    // Warnai sel (Abaikan kolom 1 karena itu kolom Nama)
                    if (colNumber > 1) {
                        cell.alignment = { horizontal: 'center' };
                        if (cell.value === "Hadir") {
                            // Hijau untuk Hadir
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } }; 
                            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                        } else {
                            // Merah untuk Libur/Tidak Hadir
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }; 
                            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                        }
                    }
                });
            });

            // 4. Proses dan Unduh File Asli .xlsx
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Rekap_Matriks_Absensi_${start}_sd_${end}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (err) {
            alert("Gagal membuat file Excel berwarna. Pastikan internet Anda aktif untuk memuat library. Error: " + err.message);
        } finally {
            // Kembalikan kondisi tombol
            btnExport.innerHTML = originalText;
            btnExport.disabled = false;
        }
    });
}



// ========================================================
// 8. FITUR ADMIN: EXPORT LOG BASIC & IMPORT CSV KARYAWAN
// ========================================================
if(document.getElementById('btnExportCSV')) {
    document.getElementById('btnExportCSV').addEventListener('click', () => {
        if (globalAbsenData.length === 0) return alert("Tidak ada data log untuk diunduh.");
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFFWaktu;Nama;Username;Tipe;Latitude;Longitude;Alamat;Link Foto\n";
        
        globalAbsenData.forEach(row => {
            const safeAlamat = `"${row.alamat ? row.alamat.replace(/"/g, '""') : ''}"`; 
            const r = [row.waktu_teks, row.nama, row.username, row.tipe, row.lat, row.lng, safeAlamat, row.fotoUrl];
            csvContent += r.join(";") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Log_Absensi_Harian_${new Date().toLocaleDateString('id-ID')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

if(document.getElementById('importCsvFile')) {
    document.getElementById('importCsvFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(event) {
            const text = event.target.result;
            const lines = text.split('\n');
            
            let successCount = 0;
            for (let i = 0; i < lines.length; i++) {
                const cols = lines[i].split(',');
                // Format CSV: ID, Nama, Bagian, Tanggal Masuk, Username, Password, Role
                if (cols.length >= 7) {
                    const idKaryawan = cols[0].trim();
                    const nama = cols[1].trim();
                    const bagian = cols[2].trim();
                    const tglMasuk = cols[3].trim();
                    const username = cols[4].trim().toLowerCase();
                    const password = cols[5].trim();
                    const role = cols[6].trim().toLowerCase();
                    
                    if (nama.toLowerCase() === 'nama' || username === '') continue; 

                    try {
                        await addDoc(collection(db, "karyawan"), { idKaryawan, nama, bagian, tglMasuk, username, password, role });
                        successCount++;
                    } catch (err) { console.error("Gagal import:", err); }
                }
            }
            alert(`Berhasil mengimpor ${successCount} data karyawan dari CSV.`);
            document.getElementById('importCsvFile').value = ''; 
            loadDatabaseEmployees();
        };
        reader.readAsText(file);
    });
}

// ========================================================
// 9. FITUR ADMIN: MANAJEMEN KARYAWAN (CRUD LENGKAP)
// ========================================================
async function loadDatabaseEmployees() {
    const listContainer = document.getElementById('employee-list-container');
    if(!listContainer) return;
    listContainer.innerHTML = `<p class="center-text"><div class="loader"></div> Membuka Firestore...</p>`;
    try {
        const snap = await getDocs(collection(db, "karyawan"));
        let html = "";
        snap.forEach((docRef) => {
            const item = docRef.data();
            const id = docRef.id;
            const badge = item.role === 'admin' ? '<span style="color:var(--danger); font-size:11px; font-weight:bold; background:#ffe4e6; padding:2px 6px; border-radius:4px;">HRD</span>' : '<span style="color:var(--success); font-size:11px; font-weight:bold; background:#d1fae5; padding:2px 6px; border-radius:4px;">STAF</span>';
            
            const idKar = item.idKaryawan || "-";
            const bag = item.bagian || "-";
            const tgl = item.tglMasuk || "-";

            html += `
                <div class="employee-card">
                    <div class="emp-info">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <h4>${item.nama}</h4> ${badge}
                        </div>
                        <p style="color:var(--primary); font-weight:600; margin-bottom:4px;">${idKar} | ${bag}</p>
                        <p style="margin-bottom:4px;"><i class="fa-solid fa-calendar-days"></i> Masuk: ${tgl}</p>
                        <p>User ID: <b>${item.username}</b> | Pass: <code>${item.password}</code></p>
                    </div>
                    <div class="emp-actions">
                        <button onclick="window.routerEditEmp('${id}', '${idKar}', '${item.nama}', '${bag}', '${tgl}', '${item.username}', '${item.password}', '${item.role}')" style="background:var(--warning); margin-right:4px;" title="Edit Data"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="window.routerDeleteEmp('${id}', '${item.nama}')" style="background:var(--danger);" title="Hapus Permanen"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html || "<p class='center-text'>Data kosong.</p>";
    } catch (err) { listContainer.innerHTML = "<p style='color:red;'>Error baca data.</p>"; }
}

if(document.getElementById('btnTambahKaryawan')) {
    document.getElementById('btnTambahKaryawan').addEventListener('click', () => {
        document.getElementById('form-title').innerText = "Tambah Karyawan Baru";
        document.getElementById('emp-doc-id').value = "";
        document.getElementById('emp-id').value = "";
        document.getElementById('emp-nama').value = "";
        document.getElementById('emp-bagian').value = "";
        document.getElementById('emp-tgl-masuk').value = "";
        document.getElementById('emp-username').value = "";
        document.getElementById('emp-password').value = "";
        document.getElementById('emp-role').value = "karyawan";

        document.getElementById('employee-list-container').classList.add('hidden');
        document.getElementById('employee-form-container').classList.remove('hidden');
    });
}

if(document.getElementById('btnBatalKaryawan')) {
    document.getElementById('btnBatalKaryawan').addEventListener('click', () => {
        document.getElementById('employee-form-container').classList.add('hidden');
        document.getElementById('employee-list-container').classList.remove('hidden');
    });
}

if(document.getElementById('btnSimpanKaryawan')) {
    document.getElementById('btnSimpanKaryawan').addEventListener('click', async () => {
        const docId = document.getElementById('emp-doc-id').value;
        const idKaryawan = document.getElementById('emp-id').value.trim();
        const nama = document.getElementById('emp-nama').value.trim();
        const bagian = document.getElementById('emp-bagian').value.trim();
        const tglMasuk = document.getElementById('emp-tgl-masuk').value;
        const username = document.getElementById('emp-username').value.trim().toLowerCase();
        const password = document.getElementById('emp-password').value.trim();
        const role = document.getElementById('emp-role').value;
        
        if(!nama || !username || !password || !idKaryawan) return alert("Harap isi ID, Nama, Username, dan Password!");
        
        try {
            const payload = { idKaryawan, nama, bagian, tglMasuk, username, password, role };
            
            if (docId) {
                await updateDoc(doc(db, "karyawan", docId), payload);
            } else {
                await addDoc(collection(db, "karyawan"), payload);
            }
            
            document.getElementById('employee-form-container').classList.add('hidden');
            document.getElementById('employee-list-container').classList.remove('hidden');
            loadDatabaseEmployees();
        } catch(e) { alert("Error menyimpan: " + e.message); }
    });
}

window.routerEditEmp = function(docId, idKaryawan, nama, bagian, tglMasuk, username, password, role) {
    document.getElementById('form-title').innerText = "Edit Data Karyawan";
    document.getElementById('emp-doc-id').value = docId;
    document.getElementById('emp-id').value = idKaryawan !== '-' ? idKaryawan : '';
    document.getElementById('emp-nama').value = nama;
    document.getElementById('emp-bagian').value = bagian !== '-' ? bagian : '';
    document.getElementById('emp-tgl-masuk').value = tglMasuk !== '-' ? tglMasuk : '';
    document.getElementById('emp-username').value = username;
    document.getElementById('emp-password').value = password;
    document.getElementById('emp-role').value = role;

    document.getElementById('employee-list-container').classList.add('hidden');
    document.getElementById('employee-form-container').classList.remove('hidden');
};

window.routerDeleteEmp = async function(id, nama) {
    if (confirm(`Yakin ingin menghapus permanen karyawan ${nama}?`)) {
        await deleteDoc(doc(db, "karyawan", id));
        loadDatabaseEmployees();
    }
};

// ========================================================
// 10. FITUR TAMBAHAN KARYAWAN: JAM DIGITAL & RIWAYAT PRIBADI
// ========================================================
setInterval(() => {
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}, 1000);

const empTabs = {
    'tab-emp-absen': 'emp-absen-section',
    'tab-emp-riwayat': 'emp-riwayat-section'
};

if(document.getElementById('tab-emp-absen')) {
    Object.keys(empTabs).forEach(tabId => {
        const el = document.getElementById(tabId);
        if(el) {
            el.addEventListener('click', () => {
                Object.keys(empTabs).forEach(t => {
                    const e = document.getElementById(t);
                    if(e) e.classList.remove('active');
                    const sec = document.getElementById(empTabs[t]);
                    if(sec) sec.classList.add('hidden');
                });
                document.getElementById(tabId).classList.add('active');
                const tSec = document.getElementById(empTabs[tabId]);
                if(tSec) tSec.classList.remove('hidden');

                if(tabId === 'tab-emp-absen') {
                    startEmployeeFeatures(); 
                }
                if(tabId === 'tab-emp-riwayat') {
                    const video = document.getElementById('video');
                    if (video && video.srcObject) {
                        video.srcObject.getTracks().forEach(track => track.stop());
                    }
                    loadMyHistory(); 
                }
            });
        }
    });
}

async function loadMyHistory() {
    const container = document.getElementById('my-history-container');
    if(!container) return;
    container.innerHTML = `<p class="center-text"><div class="loader"></div> Mengambil data riwayat Anda...</p>`;
    
    try {
        const q = query(collection(db, "absensi"), where("username", "==", currentUser.username));
        const snap = await getDocs(q);
        
        let myData = [];
        snap.forEach(doc => myData.push(doc.data()));
        
        myData.sort((a, b) => b.timestamp - a.timestamp);
        
        let htmlRows = "";
        myData.forEach(data => {
            const thumbUrl = data.fotoUrl ? data.fotoUrl.replace('file/d/', 'uc?export=view&id=').replace('/view?usp=drivesdk', '') : '';
            const badgeClass = data.tipe === 'Masuk' ? 'badge-masuk' : 'badge-pulang';
            
            htmlRows += `
                <div class="absen-item" style="padding:12px;">
                    <img src="${thumbUrl}" onerror="this.src='https://placehold.co/100x100?text=Foto'" onclick="window.open('${data.fotoUrl}', '_blank')" style="width:55px; height:55px;">
                    <div class="absen-info">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="badge ${badgeClass}" style="margin:0;">Absen ${data.tipe}</span>
                            <span style="font-size:11px; color:var(--text-light); font-weight:600;"><i class="fa-regular fa-clock"></i> ${data.waktu_teks}</span>
                        </div>
                        <div class="absen-detail-alamat" style="margin-top:8px;">
                            <i class="fa-solid fa-map-location-dot" style="color:var(--primary); font-size:11px;"></i> ${data.alamat || "-"}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = htmlRows || "<p class='center-text'>Anda belum memiliki riwayat absensi.</p>";
    } catch (e) { 
        container.innerHTML = `<p class="center-text" style="color:red;">Gagal memuat riwayat: ${e.message}</p>`; 
    }
}

if(document.getElementById('btnRefreshMyHistory')) {
    document.getElementById('btnRefreshMyHistory').addEventListener('click', loadMyHistory);
}
