# Perbaikan penyimpanan persetujuan dan inbox manajer

Penyebab error: `aems_apply_changes` memakai `search_path=''`, tetapi trigger `trg_er_no_cycle` membaca `app_settings` dan `equipment_relationships` tanpa schema. Bahkan menutup relasi lama menjalankan deklarasi pembacaan pengaturan sebelum pemeriksaan `valid_to`, sehingga persetujuan MOVE gagal dengan SQLSTATE 42P01.

Trigger sekarang memakai referensi `public.equipment_relationships`, search_path tetap dikunci, SECURITY INVOKER dipertahankan, dan penutupan relasi historis langsung dikembalikan. Pemeriksaan siklus dan advisory lock tetap berlaku saat membuka relasi baru.

Pengajuan lama sebelum fitur manajer memiliki `approver_id=null`. Migrasi mengarahkannya ke manajer aktif sesuai penempatan pemohon dan mencatat audit tanpa menyetujui pengajuan. Penetapan/pergantian manajer Staff berikutnya juga mengalihkan pengajuan SUBMITTED secara atomik; pengajuan selesai tidak diubah.

Validasi database dijalankan menggunakan service_role dan RPC yang sama dengan aplikasi, seluruh perubahan pengujian rollback:

- Reproduksi sebelum perbaikan: menutup relasi EQ-201 → EQ-002 menghasilkan 42P01 (`app_settings` tidak ditemukan).
- Sesudah perbaikan: MOVE EQ-201 dari EQ-002 ke SAP-001, status permohonan dan item, slot aktif, cache akar, serta histori tersimpan dalam transaksi uji.
- LINK Fan Cooler ke EQ-002 berhasil; link balik yang membentuk siklus tetap ditolak AE001.
- CR-0012 dan CR-0014 tetap SUBMITTED dan keduanya menunjuk Nata. Pengujian tidak menyetujui pengajuan pengguna secara permanen.
