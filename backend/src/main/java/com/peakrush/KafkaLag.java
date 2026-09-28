package com.peakrush;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.apache.kafka.clients.admin.*;
import org.apache.kafka.common.TopicPartition;
import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.TimeUnit;
@Component
public class KafkaLag {
 private final AdminClient client;private volatile Long cached;private volatile long checkedAt;
 public KafkaLag(@Value("${spring.kafka.bootstrap-servers}")String bootstrap){
  client=AdminClient.create(Map.of("bootstrap.servers",bootstrap,"default.api.timeout.ms",2000,"request.timeout.ms",2000,"client.id","peakrush-metrics"));
 }
 public synchronized Long read(){
  if(System.currentTimeMillis()-checkedAt<5000)return cached;checkedAt=System.currentTimeMillis();
  try{
   var topic=client.describeTopics(List.of("seckill-order-create")).allTopicNames().get(2,TimeUnit.SECONDS).get("seckill-order-create");
   Map<TopicPartition,OffsetSpec> latest=new HashMap<>(),earliest=new HashMap<>();
   topic.partitions().forEach(p->{var tp=new TopicPartition("seckill-order-create",p.partition());latest.put(tp,OffsetSpec.latest());earliest.put(tp,OffsetSpec.earliest());});
   var ends=client.listOffsets(latest).all().get(2,TimeUnit.SECONDS);var beginnings=client.listOffsets(earliest).all().get(2,TimeUnit.SECONDS);
   var commits=client.listConsumerGroupOffsets("peakrush-orders").partitionsToOffsetAndMetadata().get(2,TimeUnit.SECONDS);
   long lag=0;for(var tp:latest.keySet()){long begin=beginnings.get(tp).offset();long committed=commits.containsKey(tp)?commits.get(tp).offset():begin;lag+=Math.max(0,ends.get(tp).offset()-Math.max(begin,committed));}
   cached=lag;
  }catch(Exception e){cached=null;}
  return cached;
 }
 @PreDestroy public void close(){client.close(java.time.Duration.ofSeconds(1));}
}
