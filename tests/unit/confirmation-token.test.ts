import React from "react";
import {describe,it,expect,vi,beforeAll,afterAll} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {isSignupConfirmation} from "@/lib/auth/confirmation";
import VerifyEmail, {metadata} from "@/app/auth/verify/page";
beforeAll(()=>vi.stubGlobal("React",React));
afterAll(()=>vi.unstubAllGlobals());
describe("Signup token compatibility",()=>{
 it("keeps the origin for same-origin native form submissions without leaking token URLs",()=>{expect(metadata.referrer).toBe("strict-origin");});
 it("supports regular and PKCE-prefixed provider hashes",()=>{expect(isSignupConfirmation("a".repeat(64),"signup")).toBe(true);expect(isSignupConfirmation("pkce_"+"b".repeat(56),"signup")).toBe(true);expect(isSignupConfirmation("pkce_"+"c".repeat(64),"email")).toBe(true);});
 it("rejects missing, truncated, malformed or unrelated tokens",()=>{for(const value of [undefined,"","pkce_","<script>","abc","a".repeat(1024)]) expect(isSignupConfirmation(value,"signup")).toBe(false);expect(isSignupConfirmation("a".repeat(64),"recovery")).toBe(false);});
 it("renders the confirmation button for the actual PKCE format",async()=>{const html=renderToStaticMarkup(await VerifyEmail({searchParams:Promise.resolve({token_hash:"pkce_"+"b".repeat(56),type:"signup"})}));expect(html).toContain("Konfirmasi email saya");expect(html).not.toContain("Tautan konfirmasi tidak lengkap");});
});
