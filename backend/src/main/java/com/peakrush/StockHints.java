package com.peakrush;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
@Component
public class StockHints {
 private final ConcurrentHashMap<String,Long> soldOut=new ConcurrentHashMap<>();
 public boolean soldOut(long aid,long iid){String k=aid+":"+iid;Long end=soldOut.get(k);if(end==null)return false;if(end<System.currentTimeMillis()){soldOut.remove(k,end);return false;}return true;}
 public void mark(long aid,long iid){if(soldOut.size()>2048)soldOut.clear();soldOut.put(aid+":"+iid,System.currentTimeMillis()+200);}
 public void clear(String rid){String[] p=rid.split("\\.");soldOut.remove(p[0]+":"+p[1]);}
}
