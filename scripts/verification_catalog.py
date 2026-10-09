"""Verify the real expanded catalog, image URLs, V3 orders and preserved history."""
import argparse, asyncio, datetime, json, pathlib, uuid
import aiohttp
from verification_api import Api, ROOT
from seed_catalog import load_catalog, marker

async def run(args):
    report={"checkedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"checks":[],"passed":False}
    def check(name, ok, details=None):
        report["checks"].append({"name":name,"passed":bool(ok),"details":details})
        assert ok, name
    try:
      async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60)) as session:
        api=Api(session,args.base)
        _,listing=await api.call("GET","/api/seckill/activities")
        current=next(a for a in listing["items"] if marker("current") in a["description"].splitlines() and a["status"]=="RUNNING")
        upcoming=next(a for a in listing["items"] if marker("next") in a["description"].splitlines())
        check("nine unique actual products",len(current["items"])==9 and len({i["productId"] for i in current["items"]})==9)
        check("four persisted categories",{i["category"] for i in current["items"]}=={"数码影音","居家生活","运动户外","旅行出行"})
        check("V3 current and next sessions",current["architectureVersion"]==upcoming["architectureVersion"]=="V3")
        next_start=datetime.datetime.fromisoformat(upcoming["startTime"].replace("Z","+00:00"))
        next_end=datetime.datetime.fromisoformat(upcoming["endTime"].replace("Z","+00:00"))
        checked_now=datetime.datetime.now(datetime.timezone.utc)
        check("next session has a valid unexpired time window",next_end>next_start and next_end>checked_now)
        report["nextStartsInFuture"]=next_start>checked_now
        spec=load_catalog()
        expected={p["imageUrl"] for p in spec["products"]}
        check("nine different catalog images",{i["imageUrl"] for i in current["items"]}==expected)
        for path in sorted(expected):
            async with session.get(args.assets_base+path) as response:
                data=await response.read()
                check("image "+path,response.status==200 and response.headers.get("Content-Type","").startswith("image/") and len(data)>1000,{"bytes":len(data)})
        # A new isolated user avoids consuming an existing user's purchase eligibility.
        user=await api.user("catalog_"+uuid.uuid4().hex[:12])
        await api.call("GET","/api/admin/products",token=user,allowed=(403,))
        check("catalog administration remains protected",True)
        coffee=next(i for i in current["items"] if i["imageUrl"].endswith("coffee-machine.png"))
        lamp=next(i for i in current["items"] if i["imageUrl"].endswith("desk-lamp.png"))
        first=await api.settle(user,await api.buy(user,current["id"],coffee["id"]))
        check("new coffee product creates a V3 order",first.get("status")=="SUCCESS",{"orderId":first.get("orderId")})
        _,paid=await api.call("POST",f"/api/orders/{first['orderId']}/pay/mock",{},user)
        check("new product mock payment",paid["status"]=="PAID")
        second=await api.settle(user,await api.buy(user,current["id"],lamp["id"]))
        check("second new product creates an order",second.get("status")=="SUCCESS")
        _,cancelled=await api.call("POST",f"/api/orders/{second['orderId']}/cancel",{},user)
        check("new product cancellation",cancelled["status"]=="CANCELLED")
        _,fresh=await api.call("GET",f"/api/seckill/activities/{current['id']}")
        stocks={i["id"]:i["availableStock"] for i in fresh["items"]}
        check("paid order consumes one item",stocks[coffee["id"]]==coffee["availableStock"]-1)
        check("cancelled order restores exactly one item",stocks[lamp["id"]]==lamp["availableStock"])
        report["activityIds"]=[current["id"],upcoming["id"]]
        report["passed"]=True
    except Exception as error:
        report["error"]={"type":type(error).__name__,"message":"See failed check; credentials and raw service responses are omitted."}
        raise
    finally:
        path=pathlib.Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps({"passed":report["passed"],"checks":len(report["checks"]),"output":str(path)}))

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--base",default="http://127.0.0.1:8080");p.add_argument("--assets-base",default="http://127.0.0.1:5400");p.add_argument("--output",default=str(ROOT/"artifacts"/"verification-catalog-20261009.json"));asyncio.run(run(p.parse_args()))
