"""Real-service acceptance: never uses mock API or resets existing data.
Requires running PeakRush gateway/backend and isolated native services.
Usage: python scripts/verification_api.py --base http://127.0.0.1:8080
"""
import argparse, asyncio, json, time, uuid, pathlib, datetime, statistics
import aiohttp
ROOT = pathlib.Path(__file__).resolve().parents[1]
class Api:
    def __init__(self, session, base): self.session,self.base=session,base
    async def call(self, method, path, body=None, token=None, key=None, allowed=(200,201)):
        headers={}
        if token: headers["Authorization"]="Bearer "+token
        if key: headers["Idempotency-Key"]=key
        async with self.session.request(method,self.base+path,json=body,headers=headers) as r:
            raw=await r.text()
            try: value=json.loads(raw)
            except ValueError: value={"raw":raw[:500]}
            if r.status not in allowed: raise AssertionError(f"{method} {path} -> {r.status}: {value}")
            return r.status,value
    async def login(self,name,password): return (await self.call("POST","/api/auth/login",{"username":name,"password":password}))[1]["token"]
    async def user(self,name):
        return (await self.call("POST","/api/auth/register",{"username":name,"password":"Test_User_2026"}))[1]["token"]
    async def activity(self,admin,version,stock=10,limit=1,name=None):
        now=datetime.datetime.now(datetime.timezone.utc)
        body={"name":name or f"Acceptance {version} {uuid.uuid4().hex[:8]}","description":"Isolated acceptance fixture",
            "startTime":(now-datetime.timedelta(minutes=1)).isoformat(),"endTime":(now+datetime.timedelta(hours=1)).isoformat(),
            "architectureVersion":version,"items":[{"productId":self.product,"seckillPrice":19.9,"totalStock":stock,"limitPerUser":limit}]}
        _,a=await self.call("POST","/api/admin/activities",body,admin)
        for action in ("warmup","activate"): _,a=await self.call("POST",f"/api/admin/activities/{a['id']}/{action}",{},admin)
        return a,a["items"][0]
    async def path(self,token,a,i):
        return (await self.call("POST",f"/api/seckill/{a}/{i}/path",{},token))[1]["path"]
    async def buy(self,token,a,i,key=None,quantity=1,path=None):
        path=path or await self.path(token,a,i)
        return (await self.call("POST",f"/api/seckill/{path}/{a}/{i}",{"quantity":quantity},token,key or uuid.uuid4().hex,
             allowed=(200,201,202,400,409,429)))[1]
    async def settle(self,token,result,timeout=45):
        end=time.monotonic()+timeout
        while result.get("status")=="PENDING":
            if time.monotonic()>end: raise AssertionError(f"Unsettled: {result}")
            await asyncio.sleep(.15)
            _,result=await self.call("GET","/api/seckill/result/"+result["requestId"],token=token)
        return result
async def run(args):
    report={"startedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"base":args.base,"checks":[],"stages":[]}
    def check(name,condition,details=None):
        report["checks"].append({"name":name,"passed":bool(condition),"details":details})
        assert condition,f"{name}: {details}"
    try:
      async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60),connector=aiohttp.TCPConnector(limit=150)) as session:
        api=Api(session,args.base)
        admin=await api.login("admin","admin12345")
        _,products=await api.call("GET","/api/admin/products",token=admin)
        api.product=products["items"][0]["id"]
        sem=asyncio.Semaphore(10)
        runid=uuid.uuid4().hex[:8]
        async def user(i):
            async with sem: return await api.user(f"t{runid}_{i}")
        users=await asyncio.gather(*(user(i) for i in range(100)))
        status,_=await api.call("GET","/api/admin/products",token=users[0],allowed=(403,))
        check("Non-admin cannot read administration",status==403)
        for version in args.versions.split(","):
            a,i=await api.activity(admin,version)
            aid,iid=a["id"],i["id"]
            paths=await asyncio.gather(*(api.path(t,aid,iid) for t in users))
            started=time.perf_counter()
            raw=await asyncio.gather(*(api.buy(t,aid,iid,path=p) for t,p in zip(users,paths)))
            results=await asyncio.gather(*(api.settle(t,r) for t,r in zip(users,raw)))
            success=[(t,r) for t,r in zip(users,results) if r.get("status")=="SUCCESS"]
            check(version+" exactly 10 of 100 buyers",len(success)==10,{"successful":len(success),"responses":results})
            _,fresh=await api.call("GET",f"/api/seckill/activities/{aid}")
            check(version+" zero remaining after sellout",fresh["items"][0]["availableStock"]==0)
            t,r=success[0]
            status,_=await api.call("GET","/api/orders/"+str(r["orderId"]),token=next(x for x in users if x!=t),allowed=(403,404))
            check(version+" order owner enforcement",status in (403,404))
            _,cancelled=await api.call("POST",f"/api/orders/{r['orderId']}/cancel",{},t)
            check(version+" cancel state",cancelled["status"]=="CANCELLED",cancelled)
            await asyncio.sleep(1)
            _,fresh=await api.call("GET",f"/api/seckill/activities/{aid}")
            check(version+" compensation returns exactly one",fresh["items"][0]["availableStock"]==1,fresh)
            await api.call("POST",f"/api/orders/{r['orderId']}/cancel",{},t,allowed=(200,400,409))
            await asyncio.sleep(.3)
            _,fresh=await api.call("GET",f"/api/seckill/activities/{aid}")
            check(version+" duplicate cancel never inflates stock",fresh["items"][0]["availableStock"]==1)
            newcomer=await api.user(f"t{runid}_new_{version}")
            bought=await api.settle(newcomer,await api.buy(newcomer,aid,iid))
            check(version+" restock clears soldout gate",bought.get("status")=="SUCCESS",bought)
            _,paid=await api.call("POST",f"/api/orders/{bought['orderId']}/pay/mock",{},newcomer)
            check(version+" mock payment",paid["status"]=="PAID",paid)
            await api.call("POST",f"/api/orders/{bought['orderId']}/pay/mock",{},newcomer,allowed=(200,400,409))
            await api.call("POST",f"/api/orders/{bought['orderId']}/cancel",{},newcomer,allowed=(400,409))
            await api.call("POST",f"/api/admin/activities/{aid}/warmup",{},admin,allowed=(200,400,409))
            _,fresh=await api.call("GET",f"/api/seckill/activities/{aid}")
            check(version+" warmup never resets live inventory",fresh["items"][0]["availableStock"]==0)
            b,j=await api.activity(admin,version,stock=5,limit=2)
            key=uuid.uuid4().hex; p=await api.path(users[0],b["id"],j["id"])
            raw=await api.buy(users[0],b["id"],j["id"],key,2,p)
            duplicate=await api.buy(users[0],b["id"],j["id"],key,2,p)
            check(version+" idempotent request ID",raw.get("requestId") and raw["requestId"]==duplicate.get("requestId"),[raw,duplicate])
            original=await api.settle(users[0],raw)
            check(version+" quantity two accepted",original.get("status")=="SUCCESS",original)
            status,_=await api.call("POST",f"/api/seckill/{p}/{b['id']}/{j['id']}",{"quantity":1},users[0],key,allowed=(409,))
            check(version+" same key different payload conflicts",status==409)
            await api.call("POST",f"/api/seckill/{p}/{b['id']}/{j['id']}",{"quantity":0},users[0],uuid.uuid4().hex,allowed=(400,422))
            another=await api.settle(users[0],await api.buy(users[0],b["id"],j["id"]))
            check(version+" one order per user/item",another.get("status")!="SUCCESS",another)
            _,fresh=await api.call("GET",f"/api/seckill/activities/{b['id']}")
            check(version+" quantity stock guard",fresh["items"][0]["availableStock"]==3,fresh)
            for finished in (aid,b["id"]):
                await api.call("POST",f"/api/admin/activities/{finished}/offline",{},admin)
            report["stages"].append({"version":version,"raceSeconds":round(time.perf_counter()-started,3),"successes":10,"buyers":100,"passed":True})
            print(json.dumps(report["stages"][-1]),flush=True)
        report["passed"]=True
    except Exception as exc:
        report["passed"]=False; report["error"]=str(exc); raise
    finally:
        target=ROOT/"artifacts"/"verification-api.json"; target.parent.mkdir(exist_ok=True)
        target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print(f"Report: {target}",flush=True)
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--base",default="http://127.0.0.1:8080");parser.add_argument("--versions",default="V0,V1,V2,V3")
    asyncio.run(run(parser.parse_args()))

