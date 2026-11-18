import {describe,expect,it} from "vitest";
import {authEmailFailure} from "@/lib/auth/email-delivery";
describe("Auth email provider failures",()=>{
 it("distinguishes a rejected recipient or SMTP failure from invalid registration",()=>{
  for(const error of [{code:"email_address_not_authorized",status:400},{code:"unexpected_failure",status:500}]){
   const failure=authEmailFailure(error);expect(failure.status).toBe(503);expect(failure.message).toContain("belum dapat dikirim");
  }
 });
 it("reports provider throttling even without HTTP status",()=>{
  expect(authEmailFailure({code:"over_email_send_rate_limit"}).status).toBe(429);
  expect(authEmailFailure({status:429}).message).toContain("60 detik");
 });
 it("does not include provider response or account data",()=>{
  const error={code:"unknown-secret-code",status:400,message:"private-email-token"};
  const failure=JSON.stringify(authEmailFailure(error));expect(failure).not.toContain("private-email-token");expect(failure).not.toContain("unknown-secret-code");
 });
});
