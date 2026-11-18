/** Provider errors are classified without logging addresses, tokens or response text. */
export function authEmailFailure(error: {code?: string; status?: number}) {
  const code = error.code;
  const limited = error.status === 429 || code === "over_email_send_rate_limit" || code === "over_request_rate_limit";
  const unavailable = code === "email_address_not_authorized" || code === "unexpected_failure" || (error.status ?? 0) >= 500;
  return {
    status: limited ? 429 : unavailable ? 503 : 400,
    message: limited
      ? "Pengiriman dibatasi sementara. Tunggu minimal 60 detik sebelum mencoba kembali."
      : unavailable
        ? "Email konfirmasi belum dapat dikirim oleh layanan pengirim. Pendaftaran belum terkonfirmasi. Silakan coba lagi nanti."
        : "Pendaftaran belum dapat diproses. Periksa alamat email atau coba kembali.",
    code: limited ? "RATE_LIMITED" : unavailable ? "EMAIL_PROVIDER_UNAVAILABLE" : "AUTH_REQUEST_REJECTED",
  };
}
