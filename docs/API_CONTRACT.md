# API contract v1
Direct JSON body, UTF8, errors {code,message}. Bearer token. Money decimal yuan. Numeric IDs except requestId. Times ISO8601 UTC.
POST /api/auth/register or /login {username,password} -> {token,user:{id,username,role}}. GET /api/auth/me -> user.
GET /api/seckill/activities -> {items:[activity],total}; GET /api/seckill/activities/{id} -> activity.
activity={id,name,description,startTime,endTime,status,architectureVersion,items:[item]}.
item={id,productId,name,description,imageUrl,originalPrice,seckillPrice,totalStock,availableStock,limitPerUser}.
POST /api/seckill/{activityId}/{itemId}/path -> {path,expiresIn}.
POST /api/seckill/{path}/{activityId}/{itemId} body {quantity:1}, Idempotency-Key -> {requestId,status,orderId?,message?,orderStatus?}. V3/V4 PENDING. States PENDING,SUCCESS,SOLD_OUT,FAILED,CLOSED,CANCELLED.
GET /api/seckill/result/{requestId} -> same result, owner only.
GET /api/orders -> {items:[order],total}; GET /api/orders/{id} -> order.
order={id,requestId,activityId,itemId,productName,imageUrl,quantity,unitPrice,totalAmount,status,createdAt,expireTime,paidAt?}. States CREATED,PAID,CANCELLED,CLOSED.
POST /api/orders/{id}/pay/mock or /cancel -> order.
GET /api/admin/products -> {items:[product],total}; POST same {name,description,imageUrl,originalPrice}; PUT /{id} same; DELETE /{id}. product uses same fields plusid.
GET /api/admin/activities -> list; POST {name,description,startTime,endTime,architectureVersion,items:[{productId,seckillPrice,totalStock,limitPerUser}]} -> activity; PUT /{id} same draftonly; POST /{id}/warmup, /activate, /offline -> activity.
GET /api/admin/metrics/summary -> {requests,successes,failures,pending,orders,paidOrders,dbAvailableStock,redisAvailableStock,outboxPending,deadLetters,latencyP95Ms,kafkaLag,versions:[...]} null for unavailable.
GET /api/admin/dead-letters -> {items:[{id,requestId,reason,status,attempts,createdAt}],total}; POST /{id}/retry or /abort -> record.
GET /api/admin/experiments -> list; POST same {name,architectureVersion,concurrency,durationSeconds,stock,notes} -> record; GET /{id}/export -> JSON. May add POST /{id}/results for actual harness results.
GET/POST /api/admin/faults labprofile only; backend documents fields. /actuator/health and /actuator/prometheus.
Seed demo accounts documented by backend, local profile only. Ports: frontend5179 gateway8080 backend8081 MySQL13306 Redis16379 Kafka19092.
Frontend uses relative /api via Vite proxy gateway. Preserve Idempotency-Key on network retry; never mock purchases.
