package com.peakrush;
import org.springframework.context.annotation.*;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.*;
import org.springframework.kafka.support.serializer.*;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.springframework.util.backoff.FixedBackOff;
import org.springframework.stereotype.Component;
import org.slf4j.*;
@Configuration
class KafkaConfiguration {
 @Bean NewTopic createTopic(){return new NewTopic("seckill-order-create",3,(short)1);}
 @Bean NewTopic deadLetterTopic(){return new NewTopic("seckill-dlq",3,(short)1);}
 @Bean(name="deadLetterFactory") ConcurrentKafkaListenerContainerFactory<String,String> deadLetterFactory(ConsumerFactory<String,String> consumerFactory){
  var factory=new ConcurrentKafkaListenerContainerFactory<String,String>();factory.setConsumerFactory(consumerFactory);
  factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
  var retryForever=new DefaultErrorHandler(new FixedBackOff(1000,FixedBackOff.UNLIMITED_ATTEMPTS));
  retryForever.setClassifications(java.util.Collections.emptyMap(),true);
  factory.setCommonErrorHandler(retryForever);return factory;
 }
 @Bean DefaultErrorHandler errorHandler(KafkaTemplate<String,String> template){
  var recoverer=new DeadLetterPublishingRecoverer(template,(r,e)->new TopicPartition("seckill-dlq",r.partition()));
  recoverer.setFailIfSendResultIsError(true);
  recoverer.setWaitForSendResultTimeout(java.time.Duration.ofSeconds(12));
  return new DefaultErrorHandler(recoverer,new FixedBackOff(500,2));
 }
}
@Component
public class Messaging {
 final Json json;final Orders orders;final Store db;final Faults faults;
 private static final Logger log=LoggerFactory.getLogger(Messaging.class);
 public Messaging(Json json,Orders orders,Store db,Faults faults){this.json=json;this.orders=orders;this.db=db;this.faults=faults;}
 @KafkaListener(id="orders",topics="seckill-order-create",groupId="peakrush-orders")
 public void consume(String payload){
  if(faults.failConsumer.get())throw new IllegalStateException("LAB injected consumer failure");
  Faults.delay(faults.consumerDelayMs.get());
  PurchaseEvent event=PurchaseEvent.from(json.read(payload));
  orders.process(event);
  long delay=faults.afterDbCommitPauseMs.getAndSet(0);
  if(delay>0){log.warn("FAULT_AFTER_DB_COMMIT requestId={} pauseMs={}",event.requestId(),delay);Faults.delay(delay);}
 }
 @KafkaListener(id="deadletters",topics="seckill-dlq",groupId="peakrush-deadletters",containerFactory="deadLetterFactory")
 public void deadLetter(ConsumerRecord<String,String> record){
  String payload=record.value(),rid;
  try{rid=Json.string(json.read(payload),"requestId");if(rid.isBlank())throw new IllegalArgumentException();}
  catch(Exception e){rid="invalid:"+record.topic()+":"+record.partition()+":"+record.offset();}
  String reason="Consumer retries exhausted; source partition "+record.partition();
  var header=record.headers().lastHeader("kafka_dlt-exception-message");
  if(header!=null)reason=new String(header.value(),java.nio.charset.StandardCharsets.UTF_8);
  if(reason.length()>490)reason=reason.substring(0,490);
  db.jdbc.update("INSERT INTO dead_letter_record(request_id,payload,reason) VALUES(?,?,?) ON DUPLICATE KEY UPDATE attempts=attempts+1,reason=VALUES(reason),status=IF(status IN ('RESOLVED','ABORTED'),status,'OPEN')",rid,payload,reason);
 }
}
