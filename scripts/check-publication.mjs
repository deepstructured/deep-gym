/** Read-only publication guard. Default: scan exact staged Git blobs.
 * --worktree: preview changed/untracked non-ignored files before staging.
 * --tracked: scan every exact index blob; --history: branches/tags/remotes.
 * Internal workspace snapshot refs are local material, not publication history.
 * Reports only path, line and category; never prints matched values. */
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_BLOB_BYTES = 20 * 1024 * 1024;
const PRIVATE_PATH = /(?:^|\/)(?:\.local-secrets|\.vercel|artifacts)(?:\/|$)|(?:^|\/)\.env(?:\.[^/]+)?$|\.(?:pem|key|dump|backup|aes-256-gcm|tar|tgz|sql\.gz)$/i;
const MARKERS = [
  ["private-key material", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
  ["AWS access-key identifier", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["credential-shaped JWT", /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\b/g],
  ["live deployment identifier", /\b(?:dpl|prj|team)_[A-Za-z0-9]{16,}\b/g],
  ["credential-shaped GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g],
  ["credential-shaped GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g],
  ["credential-shaped Telegram bot token", /\b[0-9]{5,15}:[A-Za-z0-9_-]{30,50}\b/g],
  ["credential-shaped Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
];

// ZIP entries stay in memory; no files are extracted, followed, or executed.
// Bounded expansion also makes a newly staged archive fail closed on a bomb.
const ZIP_INSPECT = String.raw`
import base64, io, json, re, sys, zipfile
request=json.load(sys.stdin)
findings=[]
try:
 archive=zipfile.ZipFile(io.BytesIO(base64.b64decode(request['archive'])))
 entries=archive.infolist()
 if len(entries)>10000 or sum(x.file_size for x in entries)>128*1024*1024: raise ValueError()
 for entry in entries:
  if entry.is_dir(): continue
  if entry.file_size>20*1024*1024: raise ValueError()
  data=archive.read(entry)
  text=data.decode('utf8','replace')
  path=request['path']+'::'+entry.filename
  seen=set()
  def add(offset,category):
   line=data[:offset].count(b'\n')+1
   if (line,category) not in seen:
    seen.add((line,category)); findings.append(dict(path=path,line=line,category=category))
  if re.search(request['privatePath'],entry.filename,re.I) and not entry.filename.endswith('.env.example'): add(0,'private artifact inside ZIP')
  for item in request['known']:
   needle=base64.b64decode(item['value'])
   offset=data.find(needle)
   if len(needle)>=8 and offset>=0: add(offset,item['category'])
  if b'\0' not in data:
   for category,pattern in request['patterns']:
    for match in re.finditer(pattern,text):
     add(len(text[:match.start()].encode('utf8')),category)
 print(json.dumps(findings))
except Exception:
 print(json.dumps([dict(path=request['path'],line=1,category='ZIP content could not be fully inspected')]))
`;

export function archiveIssues(path, bytes, known = []) {
  if (!path.toLowerCase().endsWith(".zip")) return [];
  if (bytes.length > MAX_BLOB_BYTES) return [{path,line:1,category:"ZIP exceeds inspection bound"}];
  try {
    const input=JSON.stringify({path,archive:bytes.toString("base64"),privatePath:PRIVATE_PATH.source,
      known:known.map(item=>({category:item.category,value:Buffer.from(item.value).toString("base64")})),
      patterns:MARKERS.map(([category,pattern])=>[category,pattern.source])});
    return JSON.parse(execFileSync("python3",["-c",ZIP_INSPECT],{input,encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024,stdio:["pipe","pipe","pipe"]}));
  } catch { return [{path,line:1,category:"ZIP content could not be fully inspected"}]; }
}

export function publicationIssues(path, bytes, known = []) {
  const findings = [];
  const seen = new Set();
  const add = (line, category) => {
    const key = `${line}:${category}`;
    if (!seen.has(key)) { findings.push({ path, line, category }); seen.add(key); }
  };
  if (PRIVATE_PATH.test(path) && !path.endsWith(".env.example")) add(1,"private artifact/credential filename");
  if (bytes.length > MAX_BLOB_BYTES) { add(1,"large blob requires separate review"); return findings; }
  const text = bytes.toString("utf8");
  const lineAt = index => text.slice(0,index).split("\n").length;
  for (const { value, category } of known) {
    const needle = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (needle.length < 8) continue;
    const offset = bytes.indexOf(needle);
    if (offset !== -1) add(lineAt(bytes.subarray(0,offset).toString("utf8").length),category);
  }
  if (!bytes.includes(0)) for (const [category, pattern] of MARKERS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) add(lineAt(match.index),category);
  }
  return findings;
}

async function knownLocalSecrets(root) {
  const values = [];
  const add = (value, category) => { if (value && value.length >= 8) values.push({ value, category }); };
  const envFiles = [".env", ".env.local", ".env.production", ".env.production.local", "apps/mobile/.env.local", "deploy/.env", "deploy/postgres/.env"];
  for (const file of envFiles) {
    let text;
    try { text = await readFile(join(root,file),"utf8"); } catch (error) { if (error.code === "ENOENT") continue; throw new Error("Cannot inspect local credential source"); }
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key=match[1];
      let value=match[2].trim();
      if ((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
      if (/(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|DATABASE_URL|SUPABASE_ANON_KEY)/.test(key)) {
        add(value,`known local credential (${key})`);
        if (/^postgres(?:ql)?:\/\//.test(value)) {
          const authority=value.slice(value.indexOf("://")+3,value.lastIndexOf("@"));
          const rawPassword=authority.slice(authority.indexOf(":")+1);
          add(rawPassword,"known database password literal");
          let password=rawPassword;
          try { password=decodeURIComponent(password); } catch { /* Match raw spelling too. */ }
          add(password,"known database password literal");
          add(encodeURIComponent(password),"known encoded database password");
          add(encodeURIComponent(password).replace(/%[0-9A-F]{2}/g,value=>value.toLowerCase()),"known encoded database password");
        }
      }
      if (/SUPABASE_URL$/.test(key)) {
        add(value,"live backend endpoint");
        try { add(new URL(value).hostname.split(".")[0],"live backend project identifier"); } catch { /* No values in errors. */ }
      }
    }
  }
  let keys=[];
  try { keys=await readdir(join(root,".local-secrets")); } catch (error) { if(error.code!=="ENOENT") throw new Error("Cannot inspect local key directory"); }
  for (const name of keys.filter(name=>name.endsWith(".key"))) {
    const bytes=await readFile(join(root,".local-secrets",name));
    if(bytes.length>=16&&bytes.length<=4096) {
      values.push({value:bytes,category:"known local backup key bytes"});
      add(bytes.toString("hex"),"known local backup key encoding");
      add(bytes.toString("base64"),"known local backup key encoding");
    }
  }
  return values;
}

export async function scanPublication(root, mode="staged") {
  const git = (args,input)=>execFileSync("git",args,{cwd:root,input,maxBuffer:32*1024*1024,stdio:["pipe","pipe","pipe"]});
  const worktree=mode==="worktree";
  const known=await knownLocalSecrets(root);
  if(mode==="history") {
    const objects=git(["rev-list","--objects","--branches","--tags","--remotes"]).toString().trim().split("\n").filter(Boolean).map(line=>{
      const separator=line.indexOf(" ");return {id:separator<0?line:line.slice(0,separator),path:separator<0?"":line.slice(separator+1)};
    });
    const details=git(["cat-file","--batch-check=%(objecttype) %(objectsize)"],objects.map(row=>row.id).join("\n")+"\n").toString().trim().split("\n");
    const blobs=objects.filter((_,index)=>details[index]?.startsWith("blob "));
    const findings=[];
    for(const item of blobs) {
      const bytes=git(["cat-file","blob",item.id]);
      const found=[...publicationIssues(item.path,bytes,known),...archiveIssues(item.path,bytes,known)];
      if(found.length) {
        const commit=git(["log","--branches","--tags","--remotes",`--find-object=${item.id}`,"--format=%H","-1"]).toString().trim();
        findings.push(...found.map(finding=>({...finding,commit,blob:item.id})));
      }
    }
    return {mode:"branch-tag-remote-history-blobs",scannedFiles:blobs.length,findings};
  }
  const changed=mode==="tracked" ? git(["ls-files","-z"]).toString().split("\0") : worktree
    ? [...git(["diff","--name-only","--diff-filter=ACMR","HEAD","-z"]).toString().split("\0"),...git(["ls-files","--others","--exclude-standard","-z"]).toString().split("\0")]
    : git(["diff","--cached","--name-only","--diff-filter=ACMR","-z"]).toString().split("\0");
  const paths=[...new Set(changed.filter(Boolean))].sort();
  const findings=[];
  for(const path of paths) {
    const bytes=worktree ? await readFile(join(root,path)) : git(["cat-file","blob",`:${path}`]);
    findings.push(...publicationIssues(path,bytes,known),...archiveIssues(path,bytes,known));
  }
  return {mode:worktree?"working-tree-preview":mode==="tracked"?"all-index-blobs":"staged-blobs",scannedFiles:paths.length,findings};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv.length>3 || process.argv.slice(2).some(arg=>!["--worktree","--tracked","--history"].includes(arg))) {
    console.error("Usage: node scripts/check-publication.mjs [--worktree|--tracked|--history]");process.exitCode=2;
  } else {
    try {
      const result=await scanPublication(process.cwd(),process.argv[2]?.slice(2)??"staged");
      console.log(JSON.stringify(result,null,2));
      if(result.findings.length) process.exitCode=1;
      else if(!result.scannedFiles) console.log("No candidate blobs; no publication assurance is implied.");
    } catch {
      // Git/URL/fs exceptions can contain sensitive input. Never echo them.
      console.error("Publication scan could not complete; no safe result is available.");process.exitCode=2;
    }
  }
}
