import test from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import * as jose from "jose";
import { NextResponse } from "next/server.js";
import { compileTestModule as compile } from "./lib/compile-test-module.mjs";

const bodyReader=await compile(new URL("../src/server/request-body.ts",import.meta.url));
const authCrypto=await compile(new URL("../src/server/auth-crypto.ts",import.meta.url),{"node:crypto":crypto,jose});
const origin=await compile(new URL("../src/shared/lib/server-origin.ts",import.meta.url));
const boundary=await compile(new URL("../src/server/auth-request.ts",import.meta.url),{"./auth-crypto":authCrypto,"./request-body":bodyReader,"@/shared/lib/server-origin":origin});
const previousOrigin=process.env.APP_ORIGIN;
process.env.APP_ORIGIN="https://fixture.invalid";
test.after(()=>{if(previousOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previousOrigin;});
const request=(body,headers={})=>new Request("https://fixture.invalid/api/auth/telegram/verify",{method:"POST",headers:{"content-type":"application/json",...headers},body});

for(const endpoint of ["request","verify"]){
  test(`Supabase Telegram ${endpoint} rejects malformed/oversized/cross-site requests before touching Auth`,async()=>{
    let adminCalls=0;
    const route=await compile(new URL(`../app/api/auth/telegram/${endpoint}/route.ts`,import.meta.url),{
      "node:crypto":crypto,"next/server":{NextResponse},"@/shared/lib/otp":{hashOtp:()=>"fixture-hash"},
      "@/shared/lib/supabase/admin":{getSupabaseAdmin:()=>{adminCalls++;throw new Error("Unexpected Auth request");}},
      "@/shared/lib/supabase/server":{},"@/server/auth":{ownAuthEnabled:()=>false},"@/server/telegram-auth":{},
      "@/server/auth-request":boundary,"@/server/request-body":bodyReader,
      "@/shared/lib/telegram":{normalizeTelegramUsername:value=>value.replace(/^@/,"")},
    });
    for(const body of ['null','[]','"username"','{broken'])assert.equal((await route.POST(request(body))).status,400);
    assert.equal((await route.POST(request(JSON.stringify({padding:"x".repeat(4096)})))).status,413);
    assert.equal((await route.POST(request('{}',{origin:"https://evil.invalid"}))).status,403);
    assert.equal((await route.POST(request('{}',{"content-type":"text/plain"}))).status,403);
    assert.equal((await route.POST(request('{}',{cookie:"sb-fixture-auth-token=fixture"}))).status,403);
    assert.equal(adminCalls,0);
  });
}
test("native JSON without Origin and same-origin browser JSON retain the existing OTP contract",async()=>{
  const input={username:"fixture_athlete",code:"123456"};
  assert.deepEqual(await boundary.readAuthRequest(request(JSON.stringify(input))),input);
  assert.deepEqual(await boundary.readAuthRequest(request(JSON.stringify(input),{origin:"https://fixture.invalid",cookie:"sb-fixture-auth-token=fixture"})),input);
});
