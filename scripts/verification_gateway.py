"""Gateway admission checks against the running local stack."""
import argparse,asyncio,json,time,uuid
import aiohttp
from verification_api import Api,ROOT
async def run(args):
 async with aiohttp.ClientSession() as session:
  api=Api(session,args.base);token=await api.login("demo","demo12345")
  async def hit():
   return await api.call("POST","/api/seckill/invalid-proof/1/1",{"quantity":1},token,uuid.uuid4().hex,allowed=(400,403,404,409,429))
  responses=await asyncio.gather(*(hit() for _ in range(45)))
  limited=sum(status==429 for status,_ in responses)
  assert limited>0,responses
  await asyncio.sleep(1.1)
  recovered,_=await hit()
  assert recovered!=429,recovered
  good,_=await api.call("GET","/api/auth/me",token=token)
  assert good==200
  bad=token[:-3]+("aaa" if token[-3:]!="aaa" else "bbb")
  unauthorized,_=await api.call("GET","/api/auth/me",token=bad,allowed=(401,))
  report={"passed":True,"rateLimited":limited,"total":45,"recoveredStatus":recovered,"tamperedTokenStatus":unauthorized}
  path=ROOT/"artifacts"/"verification-gateway.json";path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(report,indent=2),encoding="utf-8")
  print(json.dumps(report))
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--base",default="http://127.0.0.1:8080");asyncio.run(run(p.parse_args()))

