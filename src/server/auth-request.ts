import { validateAuthCsrf } from "./auth-crypto";
import { readJsonObject, RequestBodyError } from "./request-body";
import { getServerRedirectBase } from "@/shared/lib/server-origin";

/** Works for hosted Supabase too: a native JSON request has no browser Origin,
 * while browser login writes must come from this deployment's trusted origin. */
export async function readAuthRequest(request: Request) {
  try { validateAuthCsrf(request,getServerRedirectBase(request.url).origin); }
  catch { throw new RequestBodyError(403,"Invalid request origin or content type"); }
  return readJsonObject(request,4096);
}
