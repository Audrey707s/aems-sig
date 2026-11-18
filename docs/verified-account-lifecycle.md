# Siklus akun AEMS

1. Pengguna mendaftar dengan email dan kata sandi. Supabase **Confirm email wajib aktif**. Belum ada profil bisnis sampai email dikonfirmasi; profil lama yang belum terverifikasi tetap disembunyikan dari daftar Admin.
2. Email konfirmasi menggunakan tautan `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. GET hanya membuka halaman konfirmasi; POST dari tombol pengguna memverifikasi token agar pemindai email tidak menghabiskan tautan. Tidak bergantung pada PKCE perangkat asal.
3. Tautan kedaluwarsa: pengguna dapat mengirim ulang konfirmasi atau mendaftar kembali memakai email yang sama. Provider menerapkan batas frekuensi; gunakan tautan terbaru. Tidak menghapus akun atau mengganti kata sandi saat pengiriman ulang.
4. Setelah terverifikasi, profil muncul di Pengguna dengan role belum ditetapkan. Belum dapat mengakses data bisnis.
5. Super Admin memilih Manajer/Staff dan bagian. Staff wajib memiliki Manajer aktif di bagian yang sama. Simpan role dan atasan dalam satu transaksi. Penetapan baru langsung berlaku tanpa mengubah JWT/metadata atau persetujuan kedua.
6. Transaksi menyimpan outbox pemberitahuan. Setelah commit, server mengirim email informasi role dengan tautan login biasa, tanpa token kedaluwarsa atau kata sandi. SMTP gagal tidak membatalkan role; Admin melihat status dan dapat mengirim ulang. Outbox memakai klaim atomik/lease agar klik bersamaan tidak mengirim ganda. Pengiriman bersifat at-least-once jika server mati setelah SMTP menerima dan sebelum status tersimpan; message ID stabil.
7. Lupa kata sandi tetap memakai bukti email satu kali dan grant terbatas waktu; sesi login biasa tidak dapat dipakai untuk melewati bukti pemulihan.

## Konfigurasi server email pemberitahuan

Vercel AEMS membutuhkan `GMAIL_USER` dan `GMAIL_APP_PASSWORD` (sandi aplikasi Gmail, 16 karakter), hanya server. SMTP untuk Auth di Supabase terpisah dari environment aplikasi. Sandi sensitif yang sudah tersimpan tidak dapat dibaca kembali melalui API; jangan menyalin sandi ke git/log/chat. Domain login di email pemberitahuan dikunci ke production AEMS.

Tidak ada email massal saat migrasi. Profil/role/histori yang sudah ada dipertahankan; penanda verifikasi diisi dari Auth. Perlu menetapkan atasan Staff lama yang belum memiliki atasan sebelum menyimpan/mengaktifkan kembali.

## Kompatibilitas token konfirmasi

TokenHash Supabase pada alur PKCE memiliki awalan `pkce_` diikuti hash heksadesimal. Halaman konfirmasi dan endpoint POST memakai validator bersama yang menerima hash biasa maupun prefiks PKCE dan meneruskannya utuh ke `verifyOtp`. GET tetap tidak mengonsumsi token. Tes mencakup format aktual PKCE sepanjang 61 karakter, rendering tombol konfirmasi, dan POST tanpa menghapus prefiks. Token hilang/rusak tetap ditolak.

## Pengiriman form dan sesi akun lain

Halaman native POST harus memakai `strict-origin`, bukan `no-referrer`: kebijakan no-referrer dapat membuat header Origin pada navigasi POST menjadi `null`, sehingga perlindungan same-origin menolaknya sebelum Supabase dipanggil. `strict-origin` mempertahankan asal situs tanpa mengirim path/query token sebagai Referer. Origin asing maupun null tetap ditolak.

Kegagalan diarahkan ke `/auth/confirmation-error` yang selalu tersedia, dengan pengiriman ulang email. URL lama `/login?confirmation=failed` dan `/dashboard?confirmation=failed` juga dialihkan ke halaman ini sebelum pemeriksaan sesi. Sesi Admin aktif tidak dijadikan bukti bahwa akun pendaftaran sudah terverifikasi. Keberhasilan hanya diterima jika Supabase mengembalikan pengguna terkonfirmasi dan sesi dengan identitas yang sama.

Validasi tambahan: uji middleware dengan sesi Admin aktif maupun logout, penolakan origin null/asing, dan kecocokan identitas sesi hasil konfirmasi. Uji browser wajib mencakup penekanan tombol native form, bukan hanya membuka GET halaman.
