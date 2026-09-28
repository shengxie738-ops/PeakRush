redis.replicate_commands()
local wanted = {'hash','string','hash','hash','stream','zset'}
for i=1,6 do
 local t=redis.call('TYPE',KEYS[i]).ok
 if t~='none' and t~=wanted[i] then return {'ERROR','INVALID_KEY_TYPE'} end
end
if redis.call('EXISTS',KEYS[1])==1 then
 if redis.call('HGET',KEYS[1],'hash')~=ARGV[3] then return {'CONFLICT','PAYLOAD_CHANGED'} end
 return {'EXISTING',redis.call('HGET',KEYS[1],'state'),redis.call('HGET',KEYS[1],'orderId') or ''}
end
if redis.call('EXISTS',KEYS[4])==0 or redis.call('EXISTS',KEYS[2])==0 then return {'ERROR','NOT_WARMED'} end
if redis.call('HGET',KEYS[4],'generation')~=ARGV[4] then return {'ERROR','STALE_GENERATION'} end
local stock=tonumber(redis.call('GET',KEYS[2]))
local qty=tonumber(ARGV[2])
local limit=tonumber(redis.call('HGET',KEYS[4],'limit'))
local start=tonumber(redis.call('HGET',KEYS[4],'start'))
local ending=tonumber(redis.call('HGET',KEYS[4],'end'))
if not stock or not qty or not limit or not start or not ending then return {'ERROR','INVALID_METADATA'} end
if qty<1 or qty>limit or qty~=math.floor(qty) then return {'REJECT','LIMIT_EXCEEDED'} end
if redis.call('HEXISTS',KEYS[3],ARGV[1])==1 then return {'REJECT','ALREADY_PURCHASED'} end
local tm=redis.call('TIME')
local now=tonumber(tm[1])*1000+math.floor(tonumber(tm[2])/1000)
if redis.call('HGET',KEYS[4],'enabled')~='1' then return {'REJECT','ACTIVITY_UNAVAILABLE'} end
if now<start then return {'REJECT','NOT_STARTED'} end
if now>ending then return {'REJECT','ENDED'} end
if stock<qty then return {'SOLD_OUT','SOLD_OUT',tostring(stock)} end
redis.call('DECRBY',KEYS[2],qty)
redis.call('HSET',KEYS[3],ARGV[1],ARGV[5])
redis.call('HSET',KEYS[1],'hash',ARGV[3],'userId',ARGV[1],'quantity',ARGV[2],'generation',ARGV[4],'requestId',ARGV[5],'payload',ARGV[6],'state','PENDING','released','0','stateVersion','0','acceptedAt',now)
redis.call('ZADD',KEYS[6],now,ARGV[5])
if ARGV[7]=='4' then redis.call('XADD',KEYS[5],'*','payload',ARGV[6],'requestId',ARGV[5]) end
return {'RESERVED','PENDING'}
