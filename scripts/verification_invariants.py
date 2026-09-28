"""Read-only invariants against the isolated local PeakRush database.
Uses the installed mysql client, no dependency on mocked/derived API counters.
"""
import argparse,json,os,pathlib,subprocess,datetime,shutil
from verification_api import ROOT
QUERIES={
"stock_conservation":"""SELECT COUNT(*) FROM (SELECT i.id FROM seckill_item i LEFT JOIN seckill_order o ON o.item_id=i.id GROUP BY i.id,i.total_stock,i.available_stock HAVING i.available_stock<0 OR i.available_stock>i.total_stock OR i.total_stock<>i.available_stock+COALESCE(SUM(CASE WHEN o.status IN ('CREATED','PAID') THEN o.quantity ELSE 0 END),0)) violations""",
"duplicate_user_orders":"SELECT COUNT(*) FROM (SELECT user_id,activity_id,item_id FROM seckill_order GROUP BY user_id,activity_id,item_id HAVING COUNT(*)>1) violations",
"paid_without_payment":"SELECT COUNT(*) FROM seckill_order o LEFT JOIN payment_record p ON p.order_id=o.id WHERE o.status='PAID' AND p.id IS NULL",
"payment_for_unpaid_order":"SELECT COUNT(*) FROM payment_record p JOIN seckill_order o ON o.id=p.order_id WHERE o.status<>'PAID'",
"success_without_order":"SELECT COUNT(*) FROM seckill_request r LEFT JOIN seckill_order o ON o.id=r.order_id WHERE r.status='SUCCESS' AND o.id IS NULL",
"failed_request_has_live_order":"SELECT COUNT(*) FROM seckill_request r JOIN seckill_order o ON o.request_id=r.request_id WHERE r.status='FAILED' AND o.status IN ('CREATED','PAID')",
"closed_without_release_log":"SELECT COUNT(*) FROM seckill_order o LEFT JOIN stock_change_log l ON l.operation_key=CONCAT('release:',o.request_id) WHERE o.status IN ('CLOSED','CANCELLED') AND l.id IS NULL"
}
def run(args):
 client=args.mysql or shutil.which("mysql")
 if not client: raise RuntimeError("Set --mysql or put mysql on PATH")
 env=os.environ.copy();env["MYSQL_PWD"]=os.environ["DB_PASSWORD"]
 command=[client,"--protocol=TCP","--host=127.0.0.1","--port=13306","--user=peakrush","--database=peakrush","--batch","--skip-column-names","--default-character-set=utf8mb4"]
 report={"checkedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"database":"127.0.0.1:13306/peakrush","violations":{}}
 for name,sql in QUERIES.items():
  result=subprocess.run(command+["--execute",sql],capture_output=True,text=True,env=env,check=True,encoding="utf-8")
  report["violations"][name]=int(result.stdout.strip())
 report["passed"]=not any(report["violations"].values())
 target=ROOT/"artifacts"/"verification-invariants.json";target.parent.mkdir(exist_ok=True)
 target.write_text(json.dumps(report,indent=2),encoding="utf-8")
 print(json.dumps(report,indent=2))
 if not report["passed"]:raise SystemExit(1)
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--mysql");run(p.parse_args())

