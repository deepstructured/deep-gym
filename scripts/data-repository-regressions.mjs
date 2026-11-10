/** Invoked only by test-database.mjs against its freshly created Unix-socket
 * cluster. This module never reads DATABASE_URL or project environment files. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import ts from "typescript";

async function compiled(relative, imports = {}) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", output)(exports, (name) => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  });
  return exports;
}
export async function runDataRepositoryRegressions(connection) {
  if (!connection.host?.includes("deepgym-sql-") || !connection.host.endsWith("/socket")) throw new Error("Only the isolated test cluster is accepted");
  const contracts = await compiled("../src/server/data/contracts.ts");
  const validation = await compiled("../src/server/data/validation.ts", { "./contracts": contracts });
  const errors = await compiled("../src/server/data/errors.ts", { "./validation": validation });
  const { executeDataOperation: execute } = await compiled("../src/server/data/repository.ts", { "./validation": validation });
  const { createBackendDataClient } = await compiled("../packages/core/src/backend-data-client.ts");
  const { runUserTransaction } = await compiled("../src/server/db.ts", { "server-only": {}, pg });
  const client = new pg.Client({ ...connection, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  await client.query(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='app_user') then create role app_user nologin inherit; end if;
    if not exists(select 1 from pg_roles where rolname='deepgym_test_api') then create role deepgym_test_api login noinherit; end if;
  end $$;
  grant authenticated to app_user;
  grant app_user to deepgym_test_api;`);
  const apiPool = new pg.Pool({ ...connection, user: "deepgym_test_api", max: 1, connectionTimeoutMillis: 5000 });
  const a = "d0000000-0000-0000-0000-000000000001";
  const b = "d0000000-0000-0000-0000-000000000002";
  try {
    await client.query("BEGIN");
    await client.query("insert into auth.users(id,email) values($1,'api-a@example.test'),($2,'api-b@example.test')", [a,b]);
    await client.query("SET LOCAL ROLE authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [a]);
    const op = (operation,input = {}) => execute(client,a,operation,input);
    assert.equal((await op("profile.get")).data.id,a);
    assert.equal((await op("profile.update",{patch:{language:"uk",unit:"lb",training_schedule:["A",null,"B",null,null,null,null]}})).data.language,"uk");
    await assert.rejects(op("profile.update",{patch:{id:b}}), /Unsupported/);
    await assert.rejects(op("profile.update",{patch:{telegram_id:123}}), /Unsupported/);
    const groups = (await op("groups.list")).data;
    const maliciousName = "Bench'); drop table public.workouts; --";
    const exercise = (await op("exercises.create",{input:{name:maliciousName,muscle_group_id:groups[0].id,equipment:"free_weight"}})).data;
    assert.equal(exercise.name,maliciousName);
    const payload = {type:"API test",date:"2026-11-10",body_weight_kg:80,notes:null,exercises:[{exercise_id:exercise.id,load_mode:"external",notes:null,sets:[
      {weight_kg:70,reps:5,to_failure:false,set_type:"working"},
      {weight_kg:20,reps:10,to_failure:true,set_type:"warmup"},
    ]}]};
    const create = {input:payload,createKey:"d0000000-0000-0000-0000-000000000003"};
    const workout = (await op("workouts.save",create)).data;
    assert.equal((await op("workouts.save",create)).data,workout);
    assert.equal((await op("workouts.count")).data,1);
    const list = await op("workouts.list",{from:"2026-01-01",to:"2026-11-10",exerciseId:exercise.id,count:true,limit:1});
    assert.equal(list.count,1);
    assert.equal(list.data[0].date,"2026-11-10");
    assert.equal(list.data[0].body_weight_kg,80);
    assert.equal(list.data[0].workout_exercises[0].sets.length,2);
    assert.equal(list.data[0].workout_exercises[0].sets[1].to_failure,false);
    const detail = (await op("workouts.detail",{id:workout})).data;
    assert.equal(detail.id,workout);
    const occurrence = (await op("workouts.exercises",{workoutIds:[workout],count:true})).data[0];
    assert.equal(occurrence.exercise.id,exercise.id);
    const setPage = await op("workouts.sets",{occurrenceIds:[occurrence.id],exerciseId:exercise.id,count:true});
    assert.equal(setPage.count,2);
    assert.equal(setPage.data[0].workout_exercise.workout.date,"2026-11-10");
    assert.equal((await op("workouts.exerciseHistory",{exerciseId:exercise.id})).data.length,2);
    assert.equal((await op("workouts.previousSets",{exerciseIds:[exercise.id],beforeDate:"2026-11-11"})).data.length,2);
    assert.equal((await op("workouts.lastOfType",{type:"API test",beforeDate:"2026-11-11",preferWeekdayOf:"2026-11-17"})).data.id,workout);
    const summary = (await op("workouts.homeSummary",{today:"2026-11-10",recordsSince:"2026-08-10",muscleSince:"2026-10-10"})).data;
    assert.equal(summary.total,1);
    assert.equal(summary.activity[0].sets,1);
    assert.equal(summary.activity[0].volumeKg,350);
    const templateId = (await op("templates.create",{input:{name:"Routine",type:"A",exerciseIds:[exercise.id]}})).data;
    assert.equal((await op("templates.list")).data[0].workout_template_exercises[0].count,1);
    assert.equal((await op("templates.detail",{id:templateId})).data.workout_template_exercises[0].exercise.id,exercise.id);
    await op("templates.update",{id:templateId,input:{name:"Updated",type:"B",exerciseIds:[exercise.id]}});
    assert.equal((await op("templates.exercises",{id:templateId,count:true})).count,1);
    const measurement = (await op("bodyWeight.log",{weightKg:81.5,measuredAt:"2020-01-01T00:00:00Z"})).data;
    assert.equal(measurement.weight_kg,81.5);
    assert.equal((await op("bodyWeight.list",{count:true})).count,1);
    await op("drafts.save",{ownerId:a,draft:{type:"A",exercises:[]},updatedAt:"2026-11-10T12:00:00Z"});
    await op("drafts.save",{ownerId:a,draft:{type:"OLD",exercises:[]},updatedAt:"2026-11-10T11:00:00Z"});
    assert.equal((await op("drafts.get")).data.draft.type,"A");
    // Exercise actual web/native query chains through the JSON wire contract,
    // rather than testing the planner and repository only in isolation.
    const backend = createBackendDataClient(async (operation,input) => {
      const body = validation.request(JSON.parse(JSON.stringify({operation,input})));
      try { return {...await execute(client,a,body.operation,body.input),error:null}; }
      catch (error) { return {data:null,error:errors.dataError(error).error}; }
    }, () => a);
    const nativeWorkout = await backend.from("workouts")
      .select("*, workout_exercises (*, exercise:exercises (*), sets (*))")
      .order("date",{ascending:false}).order("created_at",{ascending:false});
    assert.equal(nativeWorkout.error,null);
    assert.equal(nativeWorkout.data[0].workout_exercises[0].sets.length,2);
    const priorHeader = await backend.from("workouts").select("id,workout_exercises!inner(id)")
      .eq("user_id",a).eq("workout_exercises.exercise_id",exercise.id).lt("date","2026-11-11")
      .order("date",{ascending:false}).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1);
    assert.equal(priorHeader.data[0].id,workout);
    const wireSets = await backend.from("sets").select("*, workout_exercise:workout_exercises!inner(workout:workouts!inner(*))",{count:"exact"})
      .eq("workout_exercise.exercise_id",exercise.id).eq("workout_exercise.workout.user_id",a)
      .eq("workout_exercise.workout_id",workout).order("id").range(0,0);
    assert.equal(wireSets.count,2);
    assert.equal(wireSets.data.length,1);
    assert.equal(wireSets.data[0].workout_exercise.workout.id,workout);
    const groupPage = await backend.from("muscle_groups").select("*",{count:"exact"})
      .or(`user_id.is.null,user_id.eq.${a}`).order("sort_order").order("name").order("id").range(0,0);
    assert.equal(groupPage.data.length,1);
    assert.equal(groupPage.count,groups.length);
    const templatePage = await backend.from("workout_template_exercises").select("*, exercise:exercises(*)",{count:"exact"})
      .eq("template_id",templateId).order("position").order("id").range(0,199);
    assert.equal(templatePage.error,null);
    assert.equal(templatePage.count,1);
    assert.equal(templatePage.data[0].exercise.id,exercise.id);
    const wireProfile = await backend.from("profiles").update({plates_kg:[20,2.5],home_widgets:{version:1,tiles:[]}})
      .eq("id",a).select("*").single();
    assert.equal(wireProfile.error,null);
    assert.deepEqual(wireProfile.data.plates_kg,[20,2.5]);
    assert.deepEqual(wireProfile.data.home_widgets,{version:1,tiles:[]});
    const wireWeight = await backend.rpc("log_body_weight",{p_weight_kg:82,p_source:"settings"});
    assert.equal(wireWeight.error,null);
    assert.equal(wireWeight.data.weight_kg,82);
    const retryWorkout = await backend.rpc("save_workout_atomic",{p_input:payload,p_workout_id:null,p_create_key:create.createKey});
    assert.equal(retryWorkout.error,null);
    assert.equal(retryWorkout.data,workout);
    console.log("PASS client-to-repository contract: web/native reads, nested filters, paging/count, profile arrays/JSON, RPC defaults and retry key");
    await assert.rejects(op("drafts.save",{ownerId:b,draft:{},updatedAt:"2026-11-10T13:00:00Z"}), /owner/);
    await assert.rejects(op("workouts.headers",{from:"2026-02-31"}), /date/);
    await assert.rejects(op("workouts.headers",{sql:"select * from auth.users"}), /Unsupported/);
    const group = (await op("groups.create",{name:"Own group"})).data;
    await op("groups.delete",{id:group.id});
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [b]);
    assert.equal((await execute(client,b,"workouts.count")).data,0);
    assert.deepEqual((await execute(client,b,"exercises.list")).data,[]);
    await assert.rejects(execute(client,b,"workouts.detail",{id:workout}), /not found/);
    await execute(client,b,"workouts.delete",{id:workout});
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [a]);
    assert.equal((await op("workouts.count")).data,1);
    assert.equal(errors.dataError({code:"23503",message:"private email SQL text password"}).error.message,"This record is still in use");
    assert.equal(errors.dataError({code:"28P01",message:"secret connection URL"}).error.code,"SERVICE_UNAVAILABLE");
    assert.throws(() => validation.request({operation:"sql",input:{query:"select 1"}}), /Unsupported/);
    console.log("PASS named data operations: parameter binding, full nested reads, atomic retry, summary, drafts, RLS, safe errors");
    for (const userId of [a,b]) {
      const identity = await runUserTransaction(apiPool,userId,async db => (await db.query("select auth.uid()::text as id,current_user as role")).rows[0],{readOnly:true});
      assert.deepEqual(identity,{id:userId,role:"app_user"});
      const clean = (await apiPool.query("select nullif(current_setting('request.jwt.claim.sub',true),'') as id,current_user as role")).rows[0];
      assert.deepEqual(clean,{id:null,role:"deepgym_test_api"});
    }
    await assert.rejects(runUserTransaction(apiPool,a,async db => {
      await db.query("select auth.uid()"); throw new Error("rollback test");
    }), /rollback test/);
    assert.equal((await apiPool.query("select nullif(current_setting('request.jwt.claim.sub',true),'') as id")).rows[0].id,null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),30);
    try { await assert.rejects(runUserTransaction(apiPool,a,db => db.query("select pg_sleep(2)"),{signal:controller.signal})); }
    finally { clearTimeout(timer); }
    assert.equal((await runUserTransaction(apiPool,b,async db => (await db.query("select auth.uid()::text as id")).rows[0])).id,b);
    const unsafePool = new pg.Pool({...connection,max:1});
    try { await assert.rejects(runUserTransaction(unsafePool,a,async () => null), /UNSAFE_DATABASE_ROLE/); }
    finally { await unsafePool.end(); }
    console.log("PASS data transaction boundary: restricted role, reused-connection identity isolation, rollback, cancellation, unsafe-role rejection");
  } finally {
    await client.query("ROLLBACK");
    await client.end();
    await apiPool.end();
  }
}
