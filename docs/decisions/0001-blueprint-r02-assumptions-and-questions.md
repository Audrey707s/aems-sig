# ADR-0001: Dokumentasi Asumsi Teknis (A-01 s.d. A-09) & Item Konfirmasi Bisnis (Q-01 s.d. Q-10) Blueprint AEMS R.02

- **Tanggal**: 11 November 2026
- **Status**: Diterapkan sebagai Parameter Terkonfigurasi (Menunggu Tanda Tangan Kebijakan Final Pemilik Bisnis)
- **Referensi**: Blueprint AEMS Versi R.02 (09-Nov-2026) Bab 3.3, Bab 24, dan `AGENTS.md` Seksi 0 & 15

## Konteks

Sesuai kontrak kerja `AGENTS.md` Seksi 0 dan 15, item yang ditandai sebagai **Asumsi (`A-01..A-09`)** dan **Pertanyaan Konfirmasi Bisnis (`Q-01..Q-10`)** di dalam Blueprint AEMS R.02 **tidak boleh** diklaim secara diam-diam sebagai kebijakan perusahaan yang telah disetujui permanen. Oleh karena itu, seluruh parameter tersebut disimpan di tabel konfigurasi `app_settings` dan dapat ditinjau serta diubah secara transparan oleh Administrator melalui layar `/admin/settings`.

## Daftar Asumsi Teknis (`A-01` s.d. `A-09`)

| Kode | Topik | Nilai Default MVP | Lokasi Konfigurasi |
|---|---|---|---|
| **A-01** | Normalisasi kunci bisnis (`trim`, `uppercase`, kompresi spasi, opsional *leading-zero* SAP) | Aktif (`pad_numeric_sap_asset = false`, `default_company_code = '1000'`, `default_sub_no = '0000'`) | `app_settings.normalization` (`/admin/settings`) |
| **A-02** | Pemisahan `equipment` bernomor resmi dan `equipment_spec_items` tanpa nomor resmi | Diterapkan penuh di skema DB dan UI detail equipment | `supabase/migrations/0001_aems_schema_rls_rpc.sql` |
| **A-03** | Perubahan mapping efektif (`LINK`/`MOVE`/`UNLINK`) memerlukan persetujuan Administrator | Aktif; Admin dapat menerapkan langsung atau menyetujui antrean | `app_settings.hierarchy` |
| **A-04** | **Maker-Checker**: Pemohon tidak dapat menyetujui pengajuannya sendiri | `maker_checker = true` | `app_settings.hierarchy.maker_checker` |
| **A-05** | Satu equipment hanya memiliki paling banyak **1 parent aktif** pada satu waktu (`equipment_active_parent`) | Ditegakkan melalui PK `equipment_active_parent(equipment_id)` dan partial unique index | `supabase/migrations/0001_aems_schema_rls_rpc.sql` |
| **A-06** | Kedalaman maksimum pohon hierarki equipment | `max_depth = 8` (dapat diubah antara 2–20) | `app_settings.hierarchy.max_depth` |
| **A-07** | Operasi `MOVE` memindahkan seluruh sub-tree turunan dan memperbarui cache `root_asset_id` secara atomik | Ditegakkan di dalam fungsi transaksi mapping | `lib/db/store.ts` & RPC SQL |
| **A-08** | Sel kosong (*blank cell*) pada Excel mode `REPLACE` **tidak** menghapus nilai lama yang sudah terisi | `blank_overwrites = false` | `app_settings.imports.blank_overwrites` |
| **A-09** | Batas ukuran berkas dan jumlah baris import Excel MVP | `max_file_size_mb = 10`, `max_rows = 20000` | `app_settings.imports` |

## Daftar Pertanyaan Konfirmasi Bisnis (`Q-01` s.d. `Q-10`)

| Kode | Pertanyaan Bisnis | Default Saat Ini di Sistem | Status Konfirmasi |
|---|---|---|---|
| **Q-01** | Apakah nomor aset SAP perlu menyertakan `company_code` dan `sap_sub_no`? | Disimpan sebagai kunci komposit `(company_code, asset_key_norm, sap_sub_no)` dengan default `1000` / `0000` | Menunggu Konfirmasi Accounting |
| **Q-02** | Dari sistem mana nomor equipment resmi diterbitkan? | Disimpan pada kolom `source_system` dengan default `'CMMS'` | Menunggu Konfirmasi Maintenance |
| **Q-03** | Apakah `LINK` pertama kali (equipment belum punya parent) memerlukan approval Admin? | `require_approval_first_link = true` (dapat dimatikan di `/admin/settings`) | Menunggu Konfirmasi Manajemen |
| **Q-04** | Apakah `MOVE` dan `UNLINK` selalu memerlukan approval Admin? | Selalu memerlukan approval Admin bagi role Accounting & Maintenance | Menunggu Konfirmasi Manajemen |
| **Q-05** | Siapa pemilik master referensi Kategori dan Lokasi? | Dikelola oleh Administrator pada MVP | Menunggu Konfirmasi Manajemen |
| **Q-06** | Apakah ada equipment yang dipakai bersama oleh dua aset sekaligus (*shared equipment*)? | Ditolak pada MVP sesuai invariant 1 parent aktif (`AE003`) | Menunggu Konfirmasi Operasional |
| **Q-07** | Berapa lama masa simpan wajib untuk `audit_logs` dan `mapping_history`? | `audit_retention_years = 7`, `import_staging_retention_days = 90` | Menunggu Konfirmasi Internal Audit |
| **Q-08** | Apakah import mapping oleh non-Admin otomatis membuat batch `mapping_change_requests`? | Ya, membuat batch request berstatus `SUBMITTED` | Menunggu Konfirmasi Manajemen |
| **Q-09** | Apakah nilai finansial (`acquisition_value`) boleh dilihat oleh role Maintenance? | Dikendalikan oleh `maintenance_can_view_financial_values` (default `false`) | Menunggu Konfirmasi Accounting |
| **Q-10** | Bagaimana perlakuan aset SAP yang sudah *retired/disposed* di SAP? | Status `DISPOSED` didukung; blokir penonaktifan bila masih ada equipment aktif (`BR-DL-02`) | Menunggu Konfirmasi Accounting |
