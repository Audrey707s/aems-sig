import { z } from "zod";

export const registrationSchema = z.object({
  full_name: z.string().trim().min(2, "Nama lengkap minimal 2 karakter.").max(120),
  email: z.string().trim().email("Alamat email tidak valid.").max(254),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128),
  confirmation: z.string(),
}).strict().refine(data => data.password === data.confirmation, {message: "Konfirmasi kata sandi tidak sama.", path: ["confirmation"]});

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, "Kata sandi lama wajib diisi."),
  new_password: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(128),
  confirmation: z.string(),
}).strict().refine(data => data.new_password === data.confirmation, {message: "Konfirmasi kata sandi tidak sama.", path: ["confirmation"]})
  .refine(data => data.current_password !== data.new_password, {message: "Kata sandi baru harus berbeda dari kata sandi lama.", path: ["new_password"]});
