"""Create the V3 storefront demo without resetting any live stock.
Existing experiment/legacy demo activities are taken offline through admin APIs.
Orders and accepted requests remain recoverable and queryable.
"""
import asyncio,json,datetime,pathlib
import aiohttp
from verification_api import Api,ROOT
async def run():
 marker=ROOT/".runtime"/"demo-v3.json"
 async with aiohttp.ClientSession() as session:
  api=Api(session,"http://127.0.0.1:8080");admin=await api.login("admin","admin12345")
  if marker.exists():
   info=json.loads(marker.read_text(encoding="utf-8"))
   print(json.dumps({"existingV3Demo":info}));return
  _,products=await api.call("GET","/api/admin/products",token=admin)
  by_image={p["imageUrl"]:p for p in products["items"]}
  ear=by_image["/assets/product-earbuds.png"];camera=by_image["/assets/product-camera.png"];watch=by_image["/assets/product-watch.png"]
  await api.call("PUT",f"/api/admin/products/{ear['id']}",{
    "name":"轻羽无线耳机","description":"轻若无物，澎湃有声。让好音乐，陪你走过每一段日常。",
    "imageUrl":ear["imageUrl"],"originalPrice":399},admin)
  _,old=await api.call("GET","/api/admin/activities",token=admin)
  for activity in old["items"]:
   if activity["id"]<=7 or activity["name"].startswith("Acceptance "):
    if activity["status"]!="OFFLINE":await api.call("POST",f"/api/admin/activities/{activity['id']}/offline",{},admin)
  now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
  next_session=now.replace(hour=20,minute=0,second=0,microsecond=0)
  if next_session<=now:next_session+=datetime.timedelta(days=1)
  specs=[
    {"name":"秋日数码专场","description":"优质好物，限时限量。","startTime":(now-datetime.timedelta(hours=1)).isoformat(),
     "endTime":(now+datetime.timedelta(hours=4)).isoformat(),"items":[{"productId":ear["id"],"seckillPrice":199,"totalStock":100,"limitPerUser":1}]},
    {"name":"晚间好物专场","description":"记录热爱，遇见每一天的新发现。","startTime":next_session.isoformat(),
     "endTime":(next_session+datetime.timedelta(hours=4)).isoformat(),"items":[{"productId":camera["id"],"seckillPrice":9999,"totalStock":50,"limitPerUser":1},
          {"productId":watch["id"],"seckillPrice":1299,"totalStock":100,"limitPerUser":1}]}
  ]
  ids=[]
  for spec in specs:
   _,a=await api.call("POST","/api/admin/activities",{**spec,"architectureVersion":"V3"},admin)
   for action in ("warmup","activate"):await api.call("POST",f"/api/admin/activities/{a['id']}/{action}",{},admin)
   ids.append(a["id"])
  marker.write_text(json.dumps({"activityIds":ids,"createdAt":now.isoformat()},indent=2),encoding="utf-8")
  print(json.dumps({"createdV3Activities":ids}))
if __name__=="__main__":asyncio.run(run())

