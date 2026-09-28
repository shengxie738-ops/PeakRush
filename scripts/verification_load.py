"""Open-loop workload, actual HTTP timing, business outcomes and conservation.
Example: python scripts/verification_load.py --versions V0,V1,V2,V3 --users 2000 --rps 1000 --seconds 30 --stock 1000
Preparation, path creation and result polling are excluded from timed purchase QPS.
Repeated requests use new keys: business limit/sold-out rejects are counted explicitly.
"""
import argparse,asyncio,collections,datetime,json,pathlib,platform,time,uuid
import aiohttp
from verification_api import Api,ROOT
def percentile(samples,q):
    if not samples:return None
    return round(sorted(samples)[min(len(samples)-1,int((len(samples)-1)*q))],3)
async def run(args):
  async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60),connector=aiohttp.TCPConnector(limit=args.users)) as session:
    api=Api(session,args.base);admin=await api.login("admin","admin12345")
    _,products=await api.call("GET","/api/admin/products",token=admin);api.product=products["items"][0]["id"]
    semaphore=asyncio.Semaphore(12)
    async def prepare_user(n):
      async with semaphore:
        name=f"loaduser_{n:05d}"
        try:return await api.login(name,"Test_User_2026")
        except AssertionError:return await api.user(name)
    users=await asyncio.gather(*(prepare_user(n) for n in range(args.users)))
    for version in args.versions.split(","):
      activity,item=await api.activity(admin,version,args.stock,name=f"Load {version} {datetime.datetime.now().isoformat(timespec='seconds')}")
      aid,iid=activity["id"],item["id"]
      async def getpath(token):
        async with semaphore:return await api.path(token,aid,iid)
      paths=await asyncio.gather(*(getpath(t) for t in users))
      _,experiment=await api.call("POST","/api/admin/experiments",{
       "name":(f"{version} burst {args.users} users" if args.burst else f"{version} open-loop {args.rps}rps"),"architectureVersion":version,
       "concurrency":args.users,"durationSeconds":args.seconds,"stock":args.stock,
       "notes":("Barrier-released burst; durationSeconds is unused; " if args.burst else "Open-loop paced requests; ")+"virtual users configured, peak in-flight observed separately. HTTP QPS includes business rejections, never order TPS."
      },admin)
      latencies=[];end_to_end=[];schedule_delays=[];statuses=collections.Counter();business=collections.Counter();pending={}
      errors=[];inflight=0;peak=0
      start=time.perf_counter()
      gate=asyncio.Semaphore(args.users)
      burst_barrier=asyncio.Event() if args.burst else None
      async def request(n,scheduled):
        nonlocal inflight,peak
        if burst_barrier is not None:
          await burst_barrier.wait()
          scheduled=start
        async with gate:
          actual=time.perf_counter();schedule_delays.append((actual-scheduled)*1000)
          inflight+=1;peak=max(peak,inflight)
          index=n%len(users);t=users[index]
          try:
            status,value=await api.call("POST",f"/api/seckill/{paths[index]}/{aid}/{iid}",
                 {"quantity":1},t,uuid.uuid4().hex,allowed=tuple(range(200,600)))
            statuses[str(status)]+=1;business[value.get("status") or value.get("code") or "UNKNOWN"]+=1
            if value.get("requestId") and value.get("status") in ("SUCCESS","PENDING"):
              pending[value["requestId"]]=(t,value)
          except Exception as exc:
            statuses["network_error"]+=1
            if len(errors)<20:errors.append(str(exc))
          finally:
            now=time.perf_counter();latencies.append((now-actual)*1000);end_to_end.append((now-scheduled)*1000);inflight-=1
      tasks=[]
      total=args.users if args.burst else args.rps*args.seconds
      if args.burst:
        tasks=[asyncio.create_task(request(n,0.0)) for n in range(total)]
        # Let all created tasks reach the same barrier before starting the clock.
        await asyncio.sleep(0)
        start=time.perf_counter()
        burst_barrier.set()
      else:
        for n in range(total):
          scheduled=start+n/args.rps
          await asyncio.sleep(max(0,scheduled-time.perf_counter()))
          tasks.append(asyncio.create_task(request(n,scheduled)))
      await asyncio.gather(*tasks)
      elapsed=time.perf_counter()-start
      poll_sem=asyncio.Semaphore(30)
      async def settle(pair):
        async with poll_sem:
          try:return await api.settle(*pair,timeout=90)
          except Exception as exc:return {"status":"UNSETTLED","error":str(exc)}
      terminal=await asyncio.gather(*(settle(pair) for pair in pending.values()))
      settled_elapsed=time.perf_counter()-start
      accepted=sum(r.get("status")=="SUCCESS" for r in terminal)
      await asyncio.sleep(1)
      _,metrics=await api.call("GET","/api/admin/metrics/summary",token=admin)
      inventory=[row for row in metrics.get("inventory",[]) if row.get("activityId")==aid]
      http5xx=sum(v for k,v in statuses.items() if k.startswith("5"))+statuses.get("network_error",0)
      error_ratio=http5xx/len(latencies) if latencies else 1
      report={
       "version":version,"activityId":aid,"generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
       "environment":{"os":platform.platform(),"python":platform.python_version(),"entrypoint":args.base,
                      "topology":"single host: gateway, backend, MySQL, Redis, Kafka, load generator"},
       "workload":{"configuredVirtualUsers":args.users,"peakObservedInflight":peak,"requestedRps":args.rps,
          "durationSeconds":args.seconds,"stock":args.stock,"requests":total,
          "model":("barrier-released burst" if args.burst else "open-loop")+", one quantity per POST, new key per attempt, prepared bearer/path per user"},
       "http":{"completed":len(latencies),"elapsedSeconds":round(elapsed,3),"qps":round(len(latencies)/elapsed,2),
          "p50Ms":percentile(latencies,.5),"p95Ms":percentile(latencies,.95),"p99Ms":percentile(latencies,.99),
          "scheduledP95Ms":percentile(end_to_end,.95),"scheduleDelayP95Ms":percentile(schedule_delays,.95),
          "statuses":dict(statuses),"businessResponses":dict(business),"serverOrNetworkErrorRatio":error_ratio},
       "orders":{"success":accepted,"uniqueAcceptedRequests":len(pending),"terminalStates":dict(collections.Counter(r.get("status") for r in terminal)),
          "settledSeconds":round(settled_elapsed,3),"orderTps":round(accepted/settled_elapsed,2)},
       "inventory":inventory,"metricsAfter":metrics,"errors":errors,
       "targets":{"qpsAtLeast1000":len(latencies)/elapsed>=1000,"p95Below500ms":(percentile(latencies,.95) or 0)<500,
                  "errorRatioBelow1Percent":error_ratio<.01,"virtualUsers2000":args.users>=2000},
       "limitations":["Single-host resource contention includes load generator.",
         "HTTP throughput includes business rejections; order TPS is separate.",
         "Configured virtual users is not a claim of 2000 simultaneous requests; observed in-flight is reported."]
      }
      target=ROOT/"artifacts"/f"load-{version}-{int(time.time())}.json";target.parent.mkdir(exist_ok=True)
      target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
      await api.call("POST",f"/api/admin/experiments/{experiment['id']}/results",report,admin)
      await api.call("POST",f"/api/admin/activities/{aid}/offline",{},admin)
      print(json.dumps({"report":str(target),"version":version,"http":report["http"],"orders":report["orders"],"targets":report["targets"]},ensure_ascii=False),flush=True)
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--base",default="http://127.0.0.1:8080");p.add_argument("--versions",default="V0,V1,V2,V3")
    p.add_argument("--users",type=int,default=2000);p.add_argument("--rps",type=int,default=1000);p.add_argument("--seconds",type=int,default=30);p.add_argument("--stock",type=int,default=1000)
    p.add_argument("--burst",action="store_true",help="Release one task per virtual user from one barrier; report actual in-flight and 429 responses")
    args=p.parse_args()
    if min(args.users,args.rps,args.seconds,args.stock)<1:p.error("positive sizes required")
    asyncio.run(run(args))

