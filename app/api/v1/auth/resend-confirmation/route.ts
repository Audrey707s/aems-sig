import {authEmailFailure} from "@/lib/auth/email-delivery";
import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {AemsError,formatErrorResponse} from "@/lib/utils/errors";
const schema=z.object({email:z.string().trim().email("Alamat email tidak valid.").max(254)}).strict();
export async function POST(request:NextRequest){
 try {
  if(request.headers.get("origin")!==request.nextUrl.origin) throw new AemsError("FORBIDDEN","Permintaan tidak diizinkan.",403);
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)throw new AemsError("VALIDATION","Alamat email tidak valid.");
  const client=await createSupabaseServerClient();
  if(!client || process.env.AEMS_STORAGE_MODE!=="supabase")throw new AemsError("INTERNAL_ERROR","Pengiriman email belum tersedia.",503);
  const {error}=await client.auth.resend({type:"signup",email:parsed.data.email,options:{emailRedirectTo:new URL("/auth/callback",request.url).toString()}});
  if(error){const failure=authEmailFailure(error);console.error("AEMS_CONFIRMATION_EMAIL_FAILED",{code:failure.code,status:failure.status});throw new AemsError("VALIDATION",failure.message,failure.status===400?503:failure.status);}
  return NextResponse.json({retry_after:60,message:"Permintaan diterima. Jika alamat ini memiliki pendaftaran yang belum dikonfirmasi, email konfirmasi akan dikirim. Periksa Inbox dan Spam; pastikan alamat email benar. Jika tetap belum masuk, hubungi Administrator."},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const result=formatErrorResponse(error);return NextResponse.json(result.body,{status:result.status,headers:{"Cache-Control":"no-store",...(result.status===429?{"Retry-After":"60"}:{})}});}
}
