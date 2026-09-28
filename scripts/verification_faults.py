"""Recoverable fault acceptance via ADMIN lab controls. Leaves all controls off.
Does not stop external processes or mutate an existing user's orders.
"""
import argparse,asyncio,datetime,json,time,uuid
import aiohttp
from verification_api import Api,ROOT
async def run(args):
 report={"startedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"checks":[]}
 async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60)) as session:
  api=Api(session,args.base);admin=await api.login("admin","admin12345")
  async def faults(**values):return await api.call("POST","/api/admin/faults",values,admin)
  async def check(name,ok,details=None):
   report["checks"].append({"name":name,"passed":bool(ok),"details":details})
   assert ok,f"{name}: {details}"
  async def inventory(aid):
   _,m=await api.call("GET","/api/admin/metrics/summary",token=admin)
   return next(row for row in m["inventory"] if row["activityId"]==aid)
  async def user():return await api.user("fault_"+uuid.uuid4().hex[:12])
  fixture_ids=[]
  async def fixture():
   a,i=await api.activity(admin,"V4",stock=2);fixture_ids.append(a["id"]);return a["id"],i["id"],await user()
  async def wait_for(fn,predicate,timeout=35):
   deadline=time.monotonic()+timeout
   while True:
    value=await fn()
    if predicate(value):return value
    if time.monotonic()>deadline:raise AssertionError(f"Timed out: {value}")
    await asyncio.sleep(.25)
  async def deadletters():
   return (await api.call("GET","/api/admin/dead-letters",token=admin))[1]["items"]
  try:
   await faults(consumerPaused=False,failConsumer=False,pauseBridge=False,pauseOutbox=False,consumerDelayMs=0,afterDbCommitPauseMs=0,afterRedisApplyPauseMs=0)
   _,products=await api.call("GET","/api/admin/products",token=admin);api.product=products["items"][0]["id"]
   aid,iid,t=await fixture()
   await faults(pauseBridge=True)
   raw=await api.buy(t,aid,iid)
   await check("V4 returns durable pending while bridge stopped",raw.get("status")=="PENDING",raw)
   await asyncio.sleep(1)
   _,state=await api.call("GET","/api/seckill/result/"+raw["requestId"],token=t)
   await check("Paused bridge does not lose accepted request",state["status"]=="PENDING",state)
   before=await inventory(aid)
   await check("Reservation reduces Redis before DB order",before.get("availableStock")==2 and before.get("redisAvailableStock")==1,before)
   await faults(pauseBridge=False)
   done=await api.settle(t,raw)
   await check("Journal resumes and creates one order",done["status"]=="SUCCESS",done)
   await faults(pauseOutbox=True)
   _,cancelled=await api.call("POST",f"/api/orders/{done['orderId']}/cancel",{},t)
   before=await inventory(aid)
   await check("Close commits DB stock while Redis release paused",before.get("availableStock")==2 and before.get("redisAvailableStock")==1,before)
   await faults(pauseOutbox=False)
   after=await wait_for(lambda:inventory(aid),lambda row:row.get("redisAvailableStock")==2)
   await check("Outbox eventually converges stock",after.get("availableStock")==after.get("redisAvailableStock"),after)
   # Force exhausted consumer retries into durable DLQ, then replay same request.
   aid,iid,t=await fixture()
   await faults(failConsumer=True)
   raw=await api.buy(t,aid,iid)
   records=await wait_for(deadletters,lambda rows:any(r.get("requestId")==raw.get("requestId") for r in rows))
   dlq=next(r for r in records if r.get("requestId")==raw["requestId"])
   await check("Failed consumer is visible in DLQ",dlq.get("status")=="OPEN",dlq)
   await faults(failConsumer=False)
   await api.call("POST",f"/api/admin/dead-letters/{dlq['id']}/retry",{},admin)
   done=await api.settle(t,raw)
   await check("DLQ replay reuses request and creates order",done["status"]=="SUCCESS" and done["requestId"]==raw["requestId"],done)
   # Abort creates a tombstone and idempotent release. Repeated actions cannot resurrect it.
   aid,iid,t=await fixture()
   await faults(failConsumer=True)
   raw=await api.buy(t,aid,iid)
   records=await wait_for(deadletters,lambda rows:any(r.get("requestId")==raw.get("requestId") for r in rows))
   dlq=next(r for r in records if r.get("requestId")==raw["requestId"])
   await api.call("POST",f"/api/admin/dead-letters/{dlq['id']}/abort",{},admin)
   await faults(failConsumer=False)
   ended=await api.settle(t,raw)
   await check("Abort fences request as FAILED",ended.get("status")=="FAILED",ended)
   after=await wait_for(lambda:inventory(aid),lambda row:row.get("redisAvailableStock")==2)
   await api.call("POST",f"/api/admin/dead-letters/{dlq['id']}/abort",{},admin,allowed=(200,400,409))
   await api.call("POST",f"/api/admin/dead-letters/{dlq['id']}/retry",{},admin,allowed=(200,400,409))
   await asyncio.sleep(2)
   _,ended=await api.call("GET","/api/seckill/result/"+raw["requestId"],token=t)
   await check("Late retry cannot resurrect aborted request",ended.get("status")=="FAILED",ended)
   after=await inventory(aid)
   await check("Repeated compensation never inflates inventory",after.get("availableStock")==2 and after.get("redisAvailableStock")==2,after)
   # Payment, cancellation and expiry share a DB lock. Concurrent pay/cancel must have one terminal state.
   aid,iid,t=await fixture();done=await api.settle(t,await api.buy(t,aid,iid));oid=done["orderId"]
   await asyncio.gather(api.call("POST",f"/api/orders/{oid}/pay/mock",{},t,allowed=(200,409)),
                        api.call("POST",f"/api/orders/{oid}/cancel",{},t,allowed=(200,409)))
   _,order=await api.call("GET",f"/api/orders/{oid}",token=t)
   await check("Pay/cancel race ends in a valid terminal state",order["status"] in ("PAID","CANCELLED"),order)
   report["passed"]=True
  except Exception as exc:
   report["passed"]=False;report["error"]=str(exc);raise
  finally:
   try:await faults(consumerPaused=False,failConsumer=False,pauseBridge=False,pauseOutbox=False,consumerDelayMs=0,afterDbCommitPauseMs=0,afterRedisApplyPauseMs=0)
   finally:
    for aid in fixture_ids:
     await api.call("POST",f"/api/admin/activities/{aid}/offline",{},admin)
    target=ROOT/"artifacts"/"verification-faults.json";target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8");print(target)
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--base",default="http://127.0.0.1:8080");asyncio.run(run(p.parse_args()))

