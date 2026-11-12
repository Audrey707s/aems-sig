# AEMS — Asset & Equipment Management System (Blueprint R.02)

Aplikasi web terpadu untuk menghubungkan **Master Data Aset (SAP)** dari tim **Accounting** dengan **Master Data Equipment** beserta hierarki induk–anak (parent–child) dari tim **Maintenance / Operasional**, dilengkapi mekanisme persetujuan **Maker-Checker**, pelacakan riwayat waktu (*temporal relationships*), import Excel (`.xlsx`) dengan deteksi duplikat (**Skip / Replace**), rekonsiliasi data, laporan ekspor (`.xlsx` & `.pdf`), dan jejak audit (*append-only audit trail*).

---

## Arsitektur & Teknologi

- **Frontend & Backend API**: Next.js 15 (App Router), React 19, TypeScript (Strict Mode), Tailwind CSS
- **Database & Keamanan**: Dedicated Supabase PostgreSQL (`supabase/migrations/0001_aems_schema_rls_rpc.sql`) dengan Row-Level Security (RLS), partial unique indexes, recursive CTE hierarchy checks, dan transactional RPC
- **Dokumen & Ekspor**: `exceljs` untuk parsing/pembuatan berkas `.xlsx` asli dan `pdf-lib` untuk pembuatan dokumen laporan `.pdf`
- **Validasi & Pengujian**: `zod` untuk validasi skema server-side dan `vitest` untuk pengujian unit serta integrasi

---

## Modul MVP (Sesuai Blueprint R.02)

1. **Dashboard (`/dashboard`)**: KPI terklik (*clickable metrics*) yang mengarah langsung ke daftar terfilter, distribusi aset per kategori & lokasi, antrean persetujuan, dan ringkasan temuan rekonsiliasi.
2. **Master Data Aset (`/assets` & `/assets/[id]`)**: Pengelolaan aset SAP, pencarian dua arah, tampilan pohon hierarki equipment di bawah aset, **Rekonstruksi Hierarki Historis (`as_of`)**, deteksi konflik versi (`row_version` HTTP 409 DiffView), serta proteksi *soft-delete*.
3. **Master Data Equipment (`/equipment`, `/equipment/unmapped`, `/equipment/[id]`)**: Pengelolaan equipment (`WHOLE_UNIT`, `COMPONENT`, `OTHER`), *breadcrumb* rantai induk hingga aset SAP induk efektif, daftar turunan (*descendants*), serta **Spesifikasi Komponen Tanpa Nomor Resmi (`equipment_spec_items`)** beserta fitur promosi menjadi equipment bernomor resmi.
4. **Mapping & Hierarki (`/mapping`)**: Pengajuan `LINK`, `MOVE`, dan `UNLINK` dengan **Pratinjau Dampak (*Impact Preview*)**, validasi siklus (`AE001`), kedalaman maksimum (`AE002`), satu induk aktif (`AE003`), satu pengajuan terbuka per equipment (`AE004`), serta antrean persetujuan **Maker-Checker**.
5. **Import Data Excel (`/imports`)**: Wizard 3 jenis import (`ASSET_MASTER`, `EQUIPMENT_MASTER`, `MAPPING`), unduh template resmi `.xlsx`, deteksi duplikat (`NEW`, `IDENTICAL`, `DUPLICATE_DIFF`, `DUPLICATE_IN_FILE`), pilihan `SKIP` atau `REPLACE` per baris atau masal, mode komit `ATOMIC` atau `PARTIAL`, dan unduh laporan baris gagal `.xlsx`.
6. **Laporan & Ekspor (`/reports`)**: 8 laporan standar dengan pratinjau langsung dan ekspor `.xlsx` maupun `.pdf` yang tercatat otomatis di Audit Trail.
7. **Administrasi (`/admin/users`, `/admin/audit`, `/admin/reconciliation`, `/admin/settings`)**: Manajemen pengguna 3 role, log audit *append-only*, pemindaian rekonsiliasi data, dan halaman **Kebijakan & Parameter Sistem (`A-01..A-09` & `Q-01..Q-10`)**.

---

## Cara Menjalankan Secara Lokal

```bash
# 1. Masuk ke direktori proyek
cd aems

# 2. Salin konfigurasi environment
cp .env.example .env.local

# 3. Instal dependensi
npm install

# 4. Jalankan pemeriksaan tipe TypeScript
npm run typecheck

# 5. Jalankan unit & integration tests
npm test

# 6. Jalankan server pengembangan lokal
npm run dev
```

Buka `http://localhost:3000`. Konfigurasi `AEMS_STORAGE_MODE=supabase` mengaktifkan autentikasi Supabase dan penyimpanan persisten di seluruh API. Jalankan migrasi tambahan `supabase/migrations/20261111201516_persistent_runtime_repository.sql` setelah skema awal. Semua URL/key harus berasal dari proyek AEMS yang sama; service-role key hanya tersedia di server.

Untuk pengembangan offline, gunakan `AEMS_STORAGE_MODE=local-store` secara eksplisit. Mode ini memakai data contoh sementara dan tidak diizinkan pada deployment production. Pemilih peran/reset contoh memerlukan `NEXT_PUBLIC_AEMS_DEMO_MODE=true` dan tidak tersedia pada database production.

## Penyimpanan persisten

Setiap API memverifikasi akun aktif, membaca satu snapshot konsisten dari tabel Postgres, dan menjalankan domain logic di konteks request yang terisolasi. Perubahan baris, relasi, import, serta audit dikirim bersama melalui RPC `aems_apply_changes`; respons sukses baru dikirim setelah transaksi berhasil. Tidak ada penulisan file lokal atau ketergantungan pada memori proses Vercel untuk menyimpan data.

RPC mengambil lock transaksi dan memeriksa revisi database. Penulisan berdasarkan revisi lama menghasilkan HTTP 409 dan pengguna harus memuat ulang; sistem tidak mengulang request mutasi secara diam-diam. Trigger revisi juga mencakup perubahan melalui dashboard SQL. Riwayat tidak dihapus atau ditimpa, dan penghapusan master tetap berupa penonaktifan. Fungsi repository hanya dapat dipanggil oleh service-role server, sedangkan RLS tetap aktif pada tabel publik.

Repository saat ini membaca snapshot domain lengkap untuk mempertahankan aturan lintas modul pada MVP. Volume import besar memerlukan pengukuran ukuran payload/waktu eksekusi dan pengembangan pemrosesan bertahap; tidak ada klaim kapasitas tanpa pengujian beban.

## Akun personal dan jenis akun

Pengguna mendaftar melalui `/register` memakai nama, email, dan password sendiri. Pendaftaran tidak menerima pilihan role. Trigger database membuat profil dengan `role=null`; pengguna hanya dapat membuka halaman menunggu penetapan dan mengelola password sendiri sampai admin menetapkan jenis akun. Halaman Pengguna menyediakan antrean Menunggu Penetapan dan pilihan Accounting/Equipment. Label Equipment memakai identifier internal MAINTENANCE agar data dan kewenangan yang sudah ada tetap kompatibel.

Ganti Password tersedia di Profil dan halaman menunggu penetapan. Server memverifikasi password lama melalui Supabase Auth, memeriksa perbedaan dan konfirmasi password baru, lalu memperbarui identitas pengguna yang sedang login. Password tidak disimpan di tabel aplikasi, log, atau audit. Sesi lain ditutup setelah perubahan. Admin aktif terakhir dilindungi di server dan trigger database.

Jalankan juga migrasi `20261112021715_personal_account_registration.sql`. Jika konfirmasi email diaktifkan pada Supabase, konfigurasi Site URL dan allowlist redirect untuk domain deployment dan `/auth/callback`; aplikasi mendukung callback PKCE serta konfirmasi token hash. Gunakan pengaturan pengiriman email yang tersedia pada proyek, tanpa menonaktifkan verifikasi secara otomatis.


## Login dan pemulihan password

Login, Daftar Akun, Lupa Password, dan Atur Ulang Password memakai komponen `AuthCard` yang sama. Halaman login tidak menampilkan email contoh atau pilihan jenis akun; jenis akun ditetapkan admin setelah pendaftaran.

Alur `/forgot-password` mengirim email melalui Supabase Auth (mengikuti batas pengiriman Supabase). Tambahkan `https://aems-sig.vercel.app/auth/recovery` ke Redirect URLs. Callback PKCE menukar kode satu kali; template recovery khusus juga dapat menggunakan `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery`. Jangan menambahkan redirect bebas dari input pengguna. Bukti pemulihan ditandatangani server, berlaku 10 menit, memakai cookie HttpOnly, dan terikat ID serta versi identitas pengguna. Login biasa tidak cukup untuk memakai endpoint reset. Setelah password berubah, bukti versi lama ditolak dan sesi ditutup.

Untuk email ke pengguna umum, pasang custom SMTP pada **Supabase AEMS → Authentication → Emails → SMTP Settings**. Siapkan host, port, username, password/API key SMTP dan alamat pengirim yang telah diverifikasi oleh penyedia email. Masukkan rahasia langsung melalui dashboard, bukan source code, chat, PR, atau log. Verifikasi email tetap aktif. Konfigurasi SMTP dan pengiriman email nyata tidak dapat dianggap selesai hanya dari build/test aplikasi.

Halaman autentikasi mengikuti ukuran ATM: kartu maksimal 440 px, logo terlihat 240 px pada desktop (224 px pada layar kecil), judul 22 px, padding kartu 36 px pada desktop, dan jarak logo–judul 16 px. Font Inter Latin disimpan lokal dengan lisensi OFL di `public/fonts/Inter-OFL.txt`; font aplikasi di luar autentikasi tidak berubah.

## Mengubah data aset dan equipment

Tombol **Ubah** tersedia pada daftar Daftar Aset/Daftar Equipment, serta **Ubah Aset / Ubah Equipment** pada detail. Formulir mencakup identitas, nama, kategori, lokasi, pabrikan/model/nomor seri, tanggal, status, spesifikasi/deskripsi, nilai perolehan dan mata uang sesuai jenis master. Atribut tambahan dapat disunting pada bagian lanjutan. Kondisi fisik equipment memakai kolom `condition`; kondisi fisik aset disimpan sebagai `attributes.physical_condition` pada JSONB yang sudah ada, tanpa menambah kolom atau mengasumsikan kondisi data lama. Nilai lama yang belum diisi ditampilkan Tidak Diketahui.

Accounting dapat mengubah aset, Equipment dapat mengubah equipment/spesifikasi, dan Admin dapat mengubah keduanya. Seluruh bagian kunci identitas utama (company code, nomor SAP, sub-nomor; source system dan nomor equipment) hanya dapat diubah Admin dengan alasan. Perubahan tetap dicatat di audit; nomor unik, tanggal kalender, referensi lokasi/kategori, dan versi baris diperiksa server. Kondisi tidak mengubah mapping. Status tidak aktif tetap ditolak bila ada anak aktif. ID internal, asal import, timestamp, root asset, depth, serta riwayat tidak diedit melalui form master; relasi memakai alur Mapping & Hierarki.

Spesifikasi yang belum dipromosikan memiliki tombol **Ubah Spesifikasi** (nama, nilai, kelompok, jumlah, nomor seri). Server memeriksa pemilik dan nilai sebelum perubahan untuk mencegah edit usang. Spesifikasi yang sudah dipromosikan tetap menjadi jejak asal; edit dilakukan pada equipment hasil promosi. Tidak ada penghapusan permanen dalam fitur edit ini.


## Revisi organisasi dan master data

- Navigasi **Daftar Data** berisi Daftar Aset, Daftar Equipment, Mapping & Hierarki. Import Excel ada di sebelah kiri Tambah pada masing-masing daftar (`/assets/import`, `/equipment/import`); Mapping Awal / Massal ada pada `/mapping/import`. Mode penyimpanan, duplikat, pratinjau, template dan riwayat tetap tersedia, dengan jenis import dikunci sesuai halaman.
- **Pengaturan → Master Data** berisi tab Pengguna, Organisasi, Pengaturan, Kategori Aset, Lokasi Aset. Pengguna dan Pengaturan hanya Admin. Kategori aset/equipment dan lokasi bertingkat dapat dibaca semua pengguna; CRUD hanya Admin. Penghapusan menonaktifkan referensi, ditolak jika masih dipakai atau memiliki anak aktif. Pembaruan memerlukan snapshot terkini.
- Role internal tetap ADMIN/ACCOUNTING/MAINTENANCE. Kolom `account_level` membedakan MANAGER/STAFF, `manager_id` menetapkan atasan dalam bagian yang sama. Registrasi tidak memberikan peran manajer; Admin menetapkan jabatan dan atasan. Halaman Organisasi menampilkan manajer dan staff di bawahnya.
- LINK langsung diterapkan tanpa persetujuan. MOVE/UNLINK oleh Staff masuk ke Manajer aktif yang ditetapkan pada `approver_id`; Manajer bagian lain tidak boleh memutuskan. Manajer/Admin dapat menerapkan perubahan langsung. Peninjauan pengajuan sendiri ditolak. Admin dapat menangani pengajuan lama yang belum memiliki manajer peninjau.
- Terapkan migrasi `20261112184729_organization_review_hierarchy.sql` sebelum merilis kode. Migrasi hanya menambahkan kolom/index/validasi, tanpa mengubah jabatan pengguna lama; akun lama menjadi Staff dan membutuhkan penetapan Manajer oleh Admin sebelum mengajukan MOVE/UNLINK. Riwayat pengajuan dipertahankan.
