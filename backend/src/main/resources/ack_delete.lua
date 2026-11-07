-- 原子完成 XACK + XDEL。
-- 先对不可能由 XADD 生成的 ID 0-0 执行一次空操作 XDEL，提前校验 XDEL 的命令/键/类型权限：
-- 否则 XACK 已生效而 XDEL 报错时，已确认条目不会被再次读取或 claim，只能人工清理。
-- KEYS[1] = Stream；ARGV[1] = 消费组；ARGV[2..] = 已获得 Kafka 成功结果的条目 ID。
local group = ARGV[1]
local ids = {}
for i = 2, #ARGV do ids[#ids + 1] = ARGV[i] end
if #ids == 0 then return 0 end
redis.call('XDEL', KEYS[1], '0-0')
local acknowledged = redis.call('XACK', KEYS[1], group, unpack(ids))
redis.call('XDEL', KEYS[1], unpack(ids))
return acknowledged
