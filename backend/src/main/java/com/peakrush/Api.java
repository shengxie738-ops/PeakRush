package com.peakrush;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
@RestController @RequestMapping("/api")
public class Api {
 final Auth auth;final Store db;final Purchases purchases;final Orders orders;final Admin admin;final Faults faults;
 public Api(Auth auth,Store db,Purchases purchases,Orders orders,Admin admin,Faults faults){this.auth=auth;this.db=db;this.purchases=purchases;this.orders=orders;this.admin=admin;this.faults=faults;}
 @PostMapping("/auth/login") Object login(@RequestBody Map<String,Object>b){return auth.login(b,false);}
 @PostMapping("/auth/register") Object register(@RequestBody Map<String,Object>b){return auth.login(b,true);}
 @GetMapping("/auth/me") Object me(HttpServletRequest r){return Auth.current(r);}
 @GetMapping("/seckill/activities") Object activities(){return db.activities(false);}
 @GetMapping("/seckill/activities/{id}") Object activity(@PathVariable long id){var a=db.activity(id);if(List.of("DRAFT","OFFLINE").contains(a.get("status")))throw new ApiException(404,"NOT_FOUND","活动不存在");return a;}
 @PostMapping("/seckill/{aid}/{iid}/path") Object path(@PathVariable long aid,@PathVariable long iid,HttpServletRequest r){return purchases.path(aid,iid,Auth.current(r));}
 @PostMapping("/seckill/{path}/{aid}/{iid}") Object buy(@PathVariable String path,@PathVariable long aid,@PathVariable long iid,@RequestHeader("Idempotency-Key")String key,@RequestBody Map<String,Object>b,HttpServletRequest r){return purchases.submit(aid,iid,path,Auth.current(r),key,Store.positive(b.getOrDefault("quantity",1),10000));}
 @GetMapping("/seckill/result/{rid}") Object result(@PathVariable String rid,HttpServletRequest r){return purchases.result(rid,Auth.current(r));}
 @GetMapping("/orders") Object orders(HttpServletRequest r){return db.orders(Auth.current(r));}
 @GetMapping("/orders/{id}") Object order(@PathVariable long id,HttpServletRequest r){return db.order(id,Auth.current(r));}
 @PostMapping("/orders/{id}/pay/mock") Object pay(@PathVariable long id,HttpServletRequest r){return orders.change(id,Auth.current(r),true);}
 @PostMapping("/orders/{id}/cancel") Object cancel(@PathVariable long id,HttpServletRequest r){return orders.change(id,Auth.current(r),false);}
 @GetMapping("/admin/products") Object products(){return db.products();}
 @PostMapping("/admin/products") Object product(@RequestBody Map<String,Object>b){return db.saveProduct(null,b);}
 @PutMapping("/admin/products/{id}") Object product(@PathVariable long id,@RequestBody Map<String,Object>b){return db.saveProduct(id,b);}
 @DeleteMapping("/admin/products/{id}") Object remove(@PathVariable long id){db.deleteProduct(id);return Json.map("deleted",true);}
 @GetMapping("/admin/activities") Object adminActivities(){return db.activities(true);}
 @PostMapping("/admin/activities") Object create(@RequestBody Map<String,Object>b){return db.saveActivity(null,b);}
 @PutMapping("/admin/activities/{id}") Object update(@PathVariable long id,@RequestBody Map<String,Object>b){return db.saveActivity(id,b);}
 @PostMapping("/admin/activities/{id}/{action}") Object lifecycle(@PathVariable long id,@PathVariable String action){return admin.lifecycle(id,action);}
 @GetMapping("/admin/metrics/summary") Object metrics(){return admin.metrics();}
 @GetMapping("/admin/dead-letters") Object deadLetters(){return admin.deadLetters();}
 @PostMapping("/admin/dead-letters/{id}/{action}") Object recover(@PathVariable long id,@PathVariable String action){return admin.deadLetter(id,action);}
 @GetMapping("/admin/experiments") Object experiments(){return admin.experiments();}
 @PostMapping("/admin/experiments") Object experiment(@RequestBody Map<String,Object>b){return admin.createExperiment(b);}
 @GetMapping("/admin/experiments/{id}/export") Object export(@PathVariable long id){return admin.experiment(id);}
 @PostMapping("/admin/experiments/{id}/results") Object results(@PathVariable long id,@RequestBody Map<String,Object>b){return admin.results(id,b);}
 @GetMapping("/admin/faults") Object faults(){return faults.get();}
 @PostMapping("/admin/faults") Object faults(@RequestBody Map<String,Object>b){return faults.set(b);}
}
