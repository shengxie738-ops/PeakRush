package com.peakrush;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.kafka.core.*;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.mock.env.MockEnvironment;
import org.apache.kafka.clients.admin.*;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.TopicPartition;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="PEAKRUSH_V4_TESTS",matches="true")
class StreamBridgeIntegrationTest {
 @Test void freshAndAbandonedStreamEventsReachRealKafkaAndIdempotentMySqlHandler() throws Exception {
  var fixture=new MySqlTransactionsTest();fixture.create();
  var connection=new LettuceConnectionFactory("127.0.0.1",16379);connection.afterPropertiesSet();connection.start();
  var template=new StringRedisTemplate(connection);template.afterPropertiesSet();
  var json=new Json(new ObjectMapper().findAndRegisterModules());var hints=new StockHints();var reservations=new Reservations(template,json,hints);
  String prefix=reservations.prefix(fixture.aid,fixture.iid),stream=prefix+"events",topic="peakrush-bridge-test-"+UUID.randomUUID();
  var properties=new HashMap<String,Object>();properties.put("bootstrap.servers","127.0.0.1:19092");properties.put("key.serializer","org.apache.kafka.common.serialization.StringSerializer");properties.put("value.serializer","org.apache.kafka.common.serialization.StringSerializer");properties.put("acks","all");properties.put("enable.idempotence",true);
  var producerFactory=new DefaultKafkaProducerFactory<String,String>(properties);var kafka=new KafkaTemplate<String,String>(producerFactory);
  try(var admin=AdminClient.create(Map.of("bootstrap.servers","127.0.0.1:19092"))){
   admin.createTopics(List.of(new NewTopic(topic,1,(short)1))).all().get(15,TimeUnit.SECONDS);
   var item=new LinkedHashMap<>(fixture.db.item(fixture.aid,fixture.iid));item.put("activity_status","PREHEATED");item.put("architecture_version",4);
   reservations.warmup(item);reservations.enabled(fixture.aid,fixture.iid,true);
   var db=spy(fixture.db);doReturn(List.of(item)).when(db).allItems();
   var purchases=new Purchases(db,fixture.orders,reservations,kafka,json,hints){
    @Override public CompletableFuture<org.springframework.kafka.support.SendResult<String,String>> enqueue(PurchaseEvent e){return kafka.send(topic,String.valueOf(e.itemId()),json.write(e));}
   };
   var faults=new Faults(new MockEnvironment(),new KafkaListenerEndpointRegistry());var worker=new Workers(db,reservations,purchases,fixture.orders,faults,json,1800);var messaging=new Messaging(json,fixture.orders,db,faults);
   PurchaseEvent first=event(fixture,1),second=event(fixture,2);reservations.reserve(first);reservations.createGroup(stream);
   var abandoned=reservations.streams().read(org.springframework.data.redis.connection.stream.Consumer.from("bridge","crashed-process"),StreamReadOptions.empty().count(1),StreamOffset.create(stream,ReadOffset.lastConsumed()));
   assertNotNull(abandoned);assertEquals(1,abandoned.size());
   Thread.sleep(6100);reservations.reserve(second);
   var consumerProperties=new HashMap<String,Object>();consumerProperties.put("bootstrap.servers","127.0.0.1:19092");consumerProperties.put("key.deserializer","org.apache.kafka.common.serialization.StringDeserializer");consumerProperties.put("value.deserializer","org.apache.kafka.common.serialization.StringDeserializer");consumerProperties.put("enable.auto.commit",false);consumerProperties.put("auto.offset.reset","earliest");
   try(var consumer=new KafkaConsumer<String,String>(consumerProperties)){
    var partition=new TopicPartition(topic,0);consumer.assign(List.of(partition));consumer.seekToBeginning(List.of(partition));
    worker.bridge();
    assertEquals(0,reservations.streams().pending(stream,"bridge",org.springframework.data.domain.Range.unbounded(),20).size(),"Kafka-acknowledged entries must leave the PEL");
    Set<String> seen=new HashSet<>();long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(15);
    while(seen.size()<2&&System.nanoTime()<deadline){for(var record:consumer.poll(Duration.ofMillis(500))){var event=PurchaseEvent.from(json.read(record.value()));seen.add(event.requestId());messaging.consume(record.value());messaging.consume(record.value());}}
    assertEquals(Set.of(first.requestId(),second.requestId()),seen);
    assertEquals(2L,db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_order WHERE item_id=?",Long.class,fixture.iid));
    assertEquals(8L,db.jdbc.queryForObject("SELECT available_stock FROM seckill_item WHERE id=?",Long.class,fixture.iid));
    assertEquals("8",template.opsForValue().get(prefix+"stock"));
    for(var task:db.jdbc.queryForList("SELECT payload FROM recovery_outbox WHERE request_id IN (?,?)",first.requestId(),second.requestId()))reservations.apply(json.read(task.get("payload").toString()));
    assertEquals("SUCCESS",reservations.request(first.requestId()).get("state"));assertEquals("SUCCESS",reservations.request(second.requestId()).get("state"));
   }
   // Retain the uniquely named test topic for manual cleanup; native Windows Kafka may fail when renaming an open log directory during deletion.
  } finally {
   producerFactory.destroy();var keys=template.keys(prefix+"*");if(keys!=null&&!keys.isEmpty())template.delete(keys);connection.destroy();fixture.remove();
  }
 }
 private PurchaseEvent event(MySqlTransactionsTest fixture,int index){var e=fixture.event(index,index);return new PurchaseEvent(e.requestId(),e.userId(),e.activityId(),e.itemId(),e.quantity(),e.payloadHash(),e.generation(),4,System.currentTimeMillis(),true);}
}