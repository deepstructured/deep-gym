import test from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import * as jose from "jose";
import { NextResponse } from "next/server.js";
import { compileTestModule as compile } from "./lib/compile-test-module.mjs";

const authCrypto = await compile(new URL("../src/server/auth-crypto.ts", import.meta.url), { "node:crypto": crypto, jose });
const bodyReader = await compile(new URL("../src/server/request-body.ts", import.meta.url));
const userId = "11111111-1111-4111-8111-111111111111", sessionId = "22222222-2222-4222-8222-222222222222";
const secret = "synthetic-local-test-secret-32-bytes-minimum", issuer = "https://fixture.invalid/api/auth";

test("access JWT requires signature, issuer, audience, expiry and a session UUID", async () => {
  const valid = await authCrypto.signAccessToken(userId,sessionId,secret,issuer);
  assert.equal((await authCrypto.verifyAccessToken(valid,secret,issuer)).userId,userId);
  await assert.rejects(authCrypto.verifyAccessToken(valid,secret+"wrong",issuer));
  await assert.rejects(authCrypto.verifyAccessToken(valid,secret,issuer+"wrong"));
  const key = new TextEncoder().encode(secret);
  const token = async (options) => new jose.SignJWT({ sid: options.sid ?? sessionId }).setProtectedHeader({alg:options.alg ?? "HS256"}).setSubject(userId).setIssuer(issuer).setAudience(options.aud ?? "deepgym").setIssuedAt().setExpirationTime(options.exp ?? "15m").sign(key);
  await assert.rejects(authCrypto.verifyAccessToken(await token({aud:"other"}),secret,issuer));
  await assert.rejects(authCrypto.verifyAccessToken(await token({exp:1}),secret,issuer));
  await assert.rejects(authCrypto.verifyAccessToken(await token({sid:"untrusted"}),secret,issuer));
  await assert.rejects(authCrypto.verifyAccessToken(await token({alg:"HS384"}),secret,issuer));
  assert.equal(authCrypto.pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("auth HTTP rejects cross-site, cookie without Origin, oversized and non-object JSON", async () => {
  let rotations = 0;
  const route = await compile(new URL("../app/api/auth/session/route.ts",import.meta.url), {
    "next/server":{NextResponse}, "@/server/auth-crypto":authCrypto, "@/server/request-body":bodyReader,
    "@/server/google-auth":{exchangeNativeCode:async()=>null},
    "@/server/auth":{
      ownAuthEnabled:()=>true, assertAuthCsrf:req=>authCrypto.validateAuthCsrf(req,"https://fixture.invalid"),
      rotateSession:async()=>{rotations++;return null;}, readSession:async()=>null,
    },
  });
  const req = (body,headers={})=>new Request("https://fixture.invalid/api/auth/session",{method:"POST",headers:{"content-type":"application/json",...headers},body});
  assert.equal((await route.POST(req('{}',{origin:"https://evil.invalid"}))).status,403);
  assert.equal((await route.POST(req('{}',{cookie:"dg_refresh=fixture"}))).status,403);
  assert.equal((await route.POST(req('{}',{"sec-fetch-site":"cross-site"}))).status,403);
  for(const value of ['null','[]','"string"']) assert.equal((await route.POST(req(value))).status,400);
  assert.equal((await route.POST(req(JSON.stringify({large:"x".repeat(17000)})))).status,413);
  assert.equal((await route.POST(req('{"operation":"refresh"}',{origin:"https://fixture.invalid",cookie:"dg_refresh=fixture","x-deepgym-client":"native"}))).status,400);
  assert.equal(rotations,0,"browser cookie proof cannot export a native refresh credential");
  const get=await route.GET(new Request("https://fixture.invalid/api/auth/session"));
  assert.match(get.headers.get("cache-control"),/no-store/);
});

const data = await compile(new URL("../packages/core/src/backend-data-client.ts",import.meta.url));
const storage = await compile(new URL("../packages/core/src/backend-storage-client.ts",import.meta.url));
const {createBackendClient} = await compile(new URL("../packages/core/src/backend-auth-client.ts",import.meta.url),{"./backend-data-client":data,"./backend-storage-client":storage});
const session = (id=userId,refresh="refresh-a")=>({access_token:`access-${id}`,refresh_token:refresh,expires_at:Math.floor(Date.now()/1000)+900,expires_in:900,token_type:"bearer",user:{id,email:"fixture@example.invalid",aud:"authenticated",created_at:new Date().toISOString(),user_metadata:{},app_metadata:{}}});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const json = value=>new Response(JSON.stringify({session:value}),{headers:{"content-type":"application/json"}});

test("late session GET cannot resurrect a signed-out account",async()=>{
  const read=deferred(),started=deferred(),events=[];
  const client=createBackendClient({origin:"https://fixture.invalid",fetcher:async(_url,init)=>{if(init.method==="GET"){started.resolve();return read.promise;}return json(null);}});
  client.auth.onAuthStateChange((event,value)=>events.push([event,value?.user.id]));
  const pending=client.auth.getSession(); await started.promise;
  assert.equal((await client.auth.signOut()).error,null);
  read.resolve(json(session())); await pending;
  assert.equal((await client.auth.getSession()).data.session,null);
  assert.ok(!events.some(([event,id])=>event!=="INITIAL_SESSION"&&id===userId));
});

test("native update retains refresh proof; delayed rotation cannot overwrite a new account",async()=>{
  const rotation=deferred(),started=deferred(),saved=new Map();
  const nativeStorage={getItem:async key=>saved.get(key)??null,setItem:async(key,value)=>{saved.set(key,value);},removeItem:async key=>{saved.delete(key);}};
  const second="33333333-3333-4333-8333-333333333333";
  const client=createBackendClient({origin:"https://fixture.invalid",native:true,storage:nativeStorage,fetcher:async(_url,init)=>{
    const body=init.body?JSON.parse(init.body):{};
    if(body.operation==="set")return json(session(body.refresh_token==="second"?second:userId,body.refresh_token));
    if(body.operation==="update")return json(session(userId,""));
    if(body.operation==="refresh"){started.resolve();return rotation.promise;}
    return json(null);
  }});
  await client.auth.setSession({access_token:"unused",refresh_token:"first"});
  await client.auth.updateUser({data:{full_name:"Renamed"}});
  assert.equal((await client.auth.getSession()).data.session.refresh_token,"first");
  const pending=client.auth.refreshSession();await started.promise;
  await client.auth.setSession({access_token:"unused",refresh_token:"second"});
  rotation.resolve(json(session(userId,"rotated-first")));await pending;
  assert.equal((await client.auth.getSession()).data.session.user.id,second);
  assert.equal(JSON.parse(saved.get("deepgym-auth:https://fixture.invalid")).user.id,second);
});

test("metadata update waits for native rotation and keeps its new credential",async()=>{
  const rotation=deferred(),started=deferred(),saved=new Map();let updateCalls=0;
  const client=createBackendClient({origin:"https://fixture.invalid",native:true,storage:{getItem:async key=>saved.get(key)??null,setItem:async(key,value)=>{saved.set(key,value);},removeItem:async key=>{saved.delete(key);}},fetcher:async(_url,init)=>{
    const body=JSON.parse(init.body);
    if(body.operation==="set")return json(session());
    if(body.operation==="refresh"){started.resolve();return rotation.promise;}
    if(body.operation==="update"){updateCalls++;return json({...session(userId,""),user:{...session().user,user_metadata:{full_name:"Updated"}}});}
    throw new Error("Unexpected request");
  }});
  await client.auth.setSession({access_token:"unused",refresh_token:"first"});
  const pending=client.auth.refreshSession();await started.promise;
  const update=client.auth.updateUser({data:{full_name:"Updated"}});
  await Promise.resolve();assert.equal(updateCalls,0);
  rotation.resolve(json(session(userId,"new-refresh")));await pending;await update;
  assert.equal((await client.auth.getSession()).data.session.refresh_token,"new-refresh");
  assert.equal((await client.auth.getSession()).data.session.user.user_metadata.full_name,"Updated");
  assert.equal(JSON.parse(saved.get("deepgym-auth:https://fixture.invalid")).refresh_token,"new-refresh");
});

test("revoked HTTP credentials clear a warm client identity without replaying the write",async()=>{
  let reads=0,writes=0;const events=[];
  const client=createBackendClient({origin:"https://fixture.invalid",fetcher:async(url)=>{
    if(url.endsWith("/api/auth/session"))return json(++reads===1?session():null);
    writes++;return new Response(JSON.stringify({error:{code:"AUTH_REQUIRED"}}),{status:401});
  }});
  client.auth.onAuthStateChange((event,value)=>events.push([event,value]));
  await client.auth.getSession();
  await client.authenticatedFetch("/api/data",{method:"POST",body:"{}"});
  assert.equal((await client.auth.getSession()).data.session,null);
  assert.ok(events.some(([event,value])=>event==="SIGNED_OUT"&&value===null));
  assert.equal(writes,1);
});

test("invalid refresh becomes signed-out while a temporary refresh failure stays recoverable",async()=>{
  for(const status of [401,503]){
    const client=createBackendClient({origin:"https://fixture.invalid",native:true,fetcher:async(_url,init)=>JSON.parse(init.body).operation==="set"?json(session()):new Response('{"error":"Unavailable"}',{status})});
    await client.auth.setSession({access_token:"unused",refresh_token:"first"});
    const result=await client.auth.refreshSession();
    if(status===401){assert.equal(result.error,null);assert.equal((await client.auth.getSession()).data.session,null);}
    else{assert.ok(result.error);assert.equal((await client.auth.getSession()).data.session.user.id,userId);}
  }
});
