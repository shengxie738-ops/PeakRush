local wanted={'hash','string','hash','hash','zset'}
for i=1,5 do
 local t=redis.call('TYPE',KEYS[i]).ok
 if t~='none' and t~=wanted[i] then return 'INVALID_KEY_TYPE' end
end
if redis.call('EXISTS',KEYS[1])==0 or redis.call('EXISTS',KEYS[2])==0 or redis.call('EXISTS',KEYS[4])==0 then return 'RECOVERY_REQUIRED' end
if redis.call('HGET',KEYS[1],'generation')~=ARGV[1] or redis.call('HGET',KEYS[4],'generation')~=ARGV[1] then return 'STALE_GENERATION' end
local old=tonumber(redis.call('HGET',KEYS[1],'stateVersion') or '0')
local incoming=tonumber(ARGV[6])
if not incoming then return 'INVALID_VERSION' end
if incoming<old then return 'OK' end
local release=(ARGV[2]=='FAILED' or ARGV[2]=='CLOSED' or ARGV[2]=='CANCELLED')
local qty=tonumber(redis.call('HGET',KEYS[1],'quantity'))
local stock=tonumber(redis.call('GET',KEYS[2]))
if not qty or not stock then return 'INVALID_STOCK' end
if release and redis.call('HGET',KEYS[1],'released')~='1' then
 redis.call('INCRBY',KEYS[2],qty)
 redis.call('HSET',KEYS[1],'released','1')
 if ARGV[2]=='FAILED' and redis.call('HGET',KEYS[3],ARGV[4])==ARGV[5] then redis.call('HDEL',KEYS[3],ARGV[4]) end
end
redis.call('HSET',KEYS[1],'state',ARGV[2],'orderId',ARGV[3],'stateVersion',ARGV[6],'reason',ARGV[7])
redis.call('ZREM',KEYS[5],ARGV[5])
return 'OK'
