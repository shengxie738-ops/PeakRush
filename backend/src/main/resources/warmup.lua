local wanted={'hash','string','hash','stream','zset'}
for i=1,5 do local t=redis.call('TYPE',KEYS[i]).ok if t~='none' and t~=wanted[i] then return -2 end end
local meta=redis.call('EXISTS',KEYS[1])
local stock=redis.call('EXISTS',KEYS[2])
if meta==1 and stock==1 then
 if redis.call('HGET',KEYS[1],'generation')~=ARGV[2] then return -3 end
 return 0
end
if meta==1 or stock==1 or ARGV[7]~='1' then return -1 end
for i=3,5 do if redis.call('EXISTS',KEYS[i])==1 then return -1 end end
redis.call('SET',KEYS[2],ARGV[1])
redis.call('HSET',KEYS[1],'generation',ARGV[2],'limit',ARGV[3],'start',ARGV[4],'end',ARGV[5],'enabled',ARGV[6])
return 1
