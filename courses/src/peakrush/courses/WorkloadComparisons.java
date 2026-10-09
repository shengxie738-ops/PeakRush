package peakrush.courses;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Real TCP request workloads for thread reuse and async composition comparisons. */
public final class WorkloadComparisons {
    private static final int DELAY_MS=20, DEADLINE_SECONDS=10;
    private static final String PREFIX="course-workload-";
    private record Product(int id,String name,int priceMinor,int stock){}
    private record Request(int id,String operation,int productId,int quantity,String expected){}
    private record TimedResponse(String body,long completedNanos){}
    private static final List<Product> PRODUCTS=List.of(new Product(11,"earbuds",39900,37),
            new Product(12,"lamp",15900,53),new Product(13,"keyboard",29900,81),
            new Product(14,"backpack",18900,24),new Product(15,"bottle",7900,62),new Product(16,"camera",999900,18));

    public static Map<String,Object> threadReuse() throws Exception {
        List<Request> requests=new ArrayList<>();
        for(int n=0;n<64;n++)requests.add(request(n,n%3,n/3%6,n%4+1));
        Map<String,Object> fresh=threadMode(requests,false),pool=threadMode(requests,true);
        var result=map("status","OK","tasks",64,"serverDelayMs",DELAY_MS,"operations",List.of("DETAIL","PRICE","INVENTORY"),
                "distinctPayloads",requests.stream().map(r->r.operation+":"+r.productId+":"+r.quantity).distinct().count(),
                "threadCountScope","Only client task workers; identical server acceptor/reply timers are excluded",
                "io","Real blocking loopback TCP, independent server for each variant",
                "latencyScope","Before submitting each task to its executor until validated TCP response; includes queue wait",
                "newThreadPerTask",fresh,"boundedPool",pool,"speedupAsserted",false);
        validateThreadReuse(result);return result;
    }

    private static Map<String,Object> threadMode(List<Request> requests,boolean reuse) throws Exception {
        AtomicInteger created=new AtomicInteger(),active=new AtomicInteger(),peak=new AtomicInteger();
        Set<String> names=new ConcurrentSkipListSet<>();
        ThreadFactory factory=task->{Thread t=new Thread(task,PREFIX+(reuse?"pool-":"fresh-")+created.incrementAndGet());t.setDaemon(true);return t;};
        ExecutorService executor=reuse?new ThreadPoolExecutor(8,8,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(64),factory,new ThreadPoolExecutor.AbortPolicy()):new FreshThreadExecutor(factory);
        CountDownLatch startGate=new CountDownLatch(1);
        List<Future<TimedResponse>> futures=new ArrayList<>();
        List<String> responses=new ArrayList<>();
        long[] latencies=new long[requests.size()];
        long started=System.nanoTime(),finished=started,deadline=started+TimeUnit.SECONDS.toNanos(DEADLINE_SECONDS);
        try(LocalService service=new LocalService()) {
            try {
                for(Request request:requests) {
                    long submitted=System.nanoTime();
                    futures.add(executor.submit(()->{
                        check(startGate.await(DEADLINE_SECONDS,TimeUnit.SECONDS),"Task release timed out");
                        names.add(Thread.currentThread().getName());int current=active.incrementAndGet();peak.accumulateAndGet(current,Math::max);
                        try {String body=service.call(request);long end=System.nanoTime();latencies[request.id]=end-submitted;return new TimedResponse(body,end);}
                        finally {active.decrementAndGet();}
                    }));
                }
                startGate.countDown();
                for(Future<TimedResponse> future:futures) {TimedResponse response=future.get(remaining(deadline),TimeUnit.NANOSECONDS);responses.add(response.body);finished=Math.max(finished,response.completedNanos);}
                service.verify(requests.size());
            } finally {startGate.countDown();shutdown(executor);}
        }
        return map("completed",responses.size(),"createdThreads",created.get(),"peakActive",peak.get(),
                "maximumThreads",reuse?8:64,"queueCapacity",reuse?64:0,"rejectionPolicy",reuse?"AbortPolicy":"One new platform thread per task",
                "workerNames",new ArrayList<>(names),"avgLatencyMs",mean(latencies),"p95LatencyMs",percentile(latencies,.95),
                "totalTimeMs",ms(finished-started),"responses",responses,"workloadHash",fingerprint(requests));
    }

    public static Map<String,Object> asyncComposition() throws Exception {
        List<Request> requests=new ArrayList<>();
        for(int product=0;product<6;product++)for(int op=0;op<3;op++)requests.add(request(product*3+op,op,product,product%4+1));
        var result=map("status","OK","products",6,"requestsPerProduct",3,"totalRequestsPerMode",18,"serverDelayMs",DELAY_MS,
                "operations",List.of("DETAIL","PRICE","INVENTORY"),"distinctPayloads",18,
                "latencyScope","One product aggregate: before its three requests begin until all three validated responses are combined",
                "io","Same loopback TCP fixture data, payloads and delay in all three modes",
                "serial",asyncMode(requests,"serial"),"thenCombine",asyncMode(requests,"thenCombine"),"allOf",asyncMode(requests,"allOf"),"speedupAsserted",false);
        validateAsyncComposition(result);return result;
    }

    private static Map<String,Object> asyncMode(List<Request> requests,String mode) throws Exception {
        AtomicInteger created=new AtomicInteger(),active=new AtomicInteger(),peak=new AtomicInteger();
        ThreadFactory factory=task->{Thread t=new Thread(task,PREFIX+mode+"-"+created.incrementAndGet());t.setDaemon(true);return t;};
        ThreadPoolExecutor executor=new ThreadPoolExecutor(18,18,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(18),factory,new ThreadPoolExecutor.AbortPolicy());
        List<String> results=new ArrayList<>();
        long[] aggregateLatencies=new long[6];
        long start=System.nanoTime(),deadline=start+TimeUnit.SECONDS.toNanos(DEADLINE_SECONDS),finished=start;
        String callerName=Thread.currentThread().getName();
        try(LocalService service=new LocalService()) {
            try {
                if(mode.equals("serial")) {
                    for(int group=0;group<6;group++) {
                        long groupStart=System.nanoTime();List<String> parts=new ArrayList<>();
                        for(int op=0;op<3;op++) {
                            check(System.nanoTime()<deadline,"Serial workload timed out");int current=active.incrementAndGet();peak.accumulateAndGet(current,Math::max);
                            try {parts.add(service.call(requests.get(group*3+op)));}finally {active.decrementAndGet();}
                        }
                        finished=System.nanoTime();aggregateLatencies[group]=finished-groupStart;results.add(String.join(" + ",parts));
                    }
                } else {
                    List<CompletableFuture<String>> aggregates=new ArrayList<>();
                    long[] groupStarts=new long[6];
                    AtomicLong lastCompleted=new AtomicLong(start);
                    for(int group=0;group<6;group++) {
                        final int index=group;groupStarts[group]=System.nanoTime();
                        List<CompletableFuture<String>> parts=new ArrayList<>();
                        for(int op=0;op<3;op++) {
                            Request request=requests.get(group*3+op);
                            parts.add(CompletableFuture.supplyAsync(()->{
                                int current=active.incrementAndGet();peak.accumulateAndGet(current,Math::max);
                                try{return service.call(request);}catch(IOException error){throw new CompletionException(error);}finally{active.decrementAndGet();}
                            },executor));
                        }
                        CompletableFuture<String> combined=mode.equals("thenCombine")
                                ?parts.get(0).thenCombine(parts.get(1),(left,right)->left+" + "+right).thenCombine(parts.get(2),(left,right)->left+" + "+right)
                                :CompletableFuture.allOf(parts.toArray(CompletableFuture[]::new)).thenApply(ignored->String.join(" + ",parts.stream().map(CompletableFuture::join).toList()));
                        aggregates.add(combined.thenApply(value->{long end=System.nanoTime();aggregateLatencies[index]=end-groupStarts[index];lastCompleted.accumulateAndGet(end,Math::max);return value;}));
                    }
                    for(var aggregate:aggregates)results.add(aggregate.get(remaining(deadline),TimeUnit.NANOSECONDS));
                    finished=lastCompleted.get();
                }
                service.verify(requests.size());
            } finally {shutdown(executor);}
        }
        List<String> expected=new ArrayList<>();
        for(int group=0;group<6;group++)expected.add(String.join(" + ",requests.subList(group*3,group*3+3).stream().map(Request::expected).toList()));
        check(results.equals(expected),"Aggregate changed product, operation, quantity or response order");
        return map("completedRequests",18,"aggregates",6,"avgLatencyMs",mean(aggregateLatencies),"p95LatencyMs",percentile(aggregateLatencies,.95),
                "totalTimeMs",ms(finished-start),"createdThreads",created.get(),"peakActive",peak.get(),"callerThread",callerName,
                "results",results,"workloadHash",fingerprint(requests));
    }

    private static Request request(int id,int operation,int productIndex,int quantity) {
        Product product=PRODUCTS.get(productIndex);String op=List.of("DETAIL","PRICE","INVENTORY").get(operation);
        String value=switch(op){case "DETAIL"->product.name;case "PRICE"->Integer.toString(product.priceMinor*quantity);default->Integer.toString(product.stock);};
        return new Request(id,op,product.id,quantity,op+":"+product.id+":"+quantity+":"+value);
    }

    /** Timed network replies require no client sleep and no external application service. */
    private static final class LocalService implements AutoCloseable {
        private final ServerSocket listener=new ServerSocket();
        private final Set<Socket> sockets=ConcurrentHashMap.newKeySet();
        private final AtomicBoolean running=new AtomicBoolean(true);
        private final AtomicReference<Throwable> failure=new AtomicReference<>();
        private final AtomicInteger replies=new AtomicInteger();
        private final ScheduledExecutorService timers=Executors.newScheduledThreadPool(2,daemonFactory(PREFIX+"reply-"));
        private final Thread acceptor;
        LocalService() throws IOException {
            try {listener.bind(new InetSocketAddress("127.0.0.1",0),128);}catch(IOException error){listener.close();timers.shutdownNow();throw error;}
            acceptor=daemonFactory(PREFIX+"accept-").newThread(this::accept);acceptor.start();
        }
        private void accept() {
            while(running.get()) {
                Socket socket=null;
                try {
                    socket=listener.accept();synchronized(sockets){if(!running.get()){socket.close();return;}sockets.add(socket);}socket.setSoTimeout(1500);
                    DataInputStream input=new DataInputStream(socket.getInputStream());
                    int id=input.readInt();String op=input.readUTF();int productId=input.readInt(),quantity=input.readInt();
                    Product product=PRODUCTS.stream().filter(p->p.id==productId).findFirst().orElseThrow();
                    String value=switch(op){case "DETAIL"->product.name;case "PRICE"->Integer.toString(product.priceMinor*quantity);case "INVENTORY"->Integer.toString(product.stock);default->throw new IOException("Unknown operation");};
                    String body=op+":"+productId+":"+quantity+":"+value;Socket connection=socket;
                    timers.schedule(()->reply(connection,id,body),DELAY_MS,TimeUnit.MILLISECONDS);
                } catch(Throwable error) {if(socket!=null){sockets.remove(socket);quietClose(socket);}if(running.get()){failure.compareAndSet(null,error);return;}}
            }
        }
        private void reply(Socket socket,int id,String body) {
            try(socket) {
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream data=new DataOutputStream(bytes);data.writeInt(id);data.writeUTF(body);
                socket.getOutputStream().write(bytes.toByteArray());socket.getOutputStream().flush();replies.incrementAndGet();
            }catch(Throwable error){if(running.get())failure.compareAndSet(null,error);}finally{sockets.remove(socket);}
        }
        String call(Request request) throws IOException {
            try(Socket socket=new Socket()) {
                socket.setSoTimeout(1500);socket.setTcpNoDelay(true);socket.connect(new InetSocketAddress("127.0.0.1",listener.getLocalPort()),1000);
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream output=new DataOutputStream(bytes);
                output.writeInt(request.id);output.writeUTF(request.operation);output.writeInt(request.productId);output.writeInt(request.quantity);
                socket.getOutputStream().write(bytes.toByteArray());socket.getOutputStream().flush();
                DataInputStream input=new DataInputStream(socket.getInputStream());int id=input.readInt();String body=input.readUTF();
                if(id!=request.id||!body.equals(request.expected))throw new IOException("Mismatched task token or semantic response: "+body);
                return body;
            }
        }
        void verify(int expected) throws Exception {
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(1);
            while(replies.get()<expected&&System.nanoTime()<deadline)TimeUnit.MILLISECONDS.sleep(1);
            check(failure.get()==null&&replies.get()==expected,"TCP fixture did not reply to every request: "+failure.get());
        }
        public void close() throws Exception {
            synchronized(sockets){running.set(false);listener.close();for(Socket socket:sockets)quietClose(socket);}timers.shutdownNow();
            check(timers.awaitTermination(2,TimeUnit.SECONDS),"Reply timers leaked");acceptor.join(2000);check(!acceptor.isAlive(),"TCP acceptor leaked");
        }
    }

    /** Baseline executor intentionally creates one platform thread for each finite task. */
    private static final class FreshThreadExecutor extends AbstractExecutorService {
        private final ThreadFactory factory;
        private final Set<Thread> workers=new HashSet<>();
        private boolean stopped;
        FreshThreadExecutor(ThreadFactory factory){this.factory=factory;}
        public synchronized void execute(Runnable work) {
            if(stopped)throw new RejectedExecutionException("Baseline stopped");
            Thread thread=factory.newThread(()->{try{work.run();}finally{synchronized(this){workers.remove(Thread.currentThread());notifyAll();}}});
            workers.add(thread);thread.start();
        }
        public synchronized void shutdown(){stopped=true;notifyAll();}
        public synchronized List<Runnable> shutdownNow(){shutdown();for(Thread worker:workers)worker.interrupt();return List.of();}
        public synchronized boolean isShutdown(){return stopped;}
        public synchronized boolean isTerminated(){return stopped&&workers.isEmpty();}
        public synchronized boolean awaitTermination(long timeout,TimeUnit unit)throws InterruptedException{
            long deadline=System.nanoTime()+unit.toNanos(timeout);while(!isTerminated()){long left=deadline-System.nanoTime();if(left<=0)return false;TimeUnit.NANOSECONDS.timedWait(this,left);}return true;
        }
    }

    private static ThreadFactory daemonFactory(String prefix){AtomicInteger count=new AtomicInteger();return work->{Thread t=new Thread(work,prefix+count.incrementAndGet());t.setDaemon(true);return t;};}
    private static void shutdown(ExecutorService executor)throws InterruptedException{executor.shutdownNow();check(executor.awaitTermination(2,TimeUnit.SECONDS),"Workload executor leaked");}
    private static void quietClose(Socket socket){try{socket.close();}catch(IOException ignored){}}
    private static long remaining(long deadline)throws TimeoutException{long left=deadline-System.nanoTime();if(left<=0)throw new TimeoutException("Workload deadline exceeded");return left;}
    private static double ms(long nanos){return nanos/1_000_000.0;}
    private static double mean(long[] values){return Arrays.stream(values).average().orElseThrow()/1_000_000.0;}
    private static double percentile(long[] values,double q){long[] copy=values.clone();Arrays.sort(copy);return ms(copy[Math.max(0,(int)Math.ceil(copy.length*q)-1)]);}
    private static String fingerprint(List<Request> requests)throws Exception{
        String text=String.join("\n",requests.stream().map(r->r.id+"|"+r.operation+"|"+r.productId+"|"+r.quantity+"|"+r.expected).toList());
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
    }
    private static Map<String,Object> map(Object...entries){Map<String,Object> result=new LinkedHashMap<>();for(int n=0;n<entries.length;n+=2)result.put((String)entries[n],entries[n+1]);return result;}

    @SuppressWarnings("unchecked")
    public static void validateThreadReuse(Map<String,Object> result) {
        check("OK".equals(result.get("status")), "Thread reuse comparison is missing");
        var fresh=(Map<String,Object>) result.get("newThreadPerTask");
        var pool=(Map<String,Object>) result.get("boundedPool");
        check(number(result,"tasks")==64,"Unexpected finite workload");
        check(number(fresh,"completed")==64 && number(pool,"completed")==64,"Thread comparison lost requests");
        check(number(fresh,"createdThreads")==64 && number(pool,"createdThreads")==8,"Thread reuse was not measured");
        check(number(fresh,"peakActive")>0 && number(fresh,"peakActive")<=64,"Invalid new-thread concurrency");
        check(number(pool,"peakActive")>0 && number(pool,"peakActive")<=8,"Bounded pool escaped its concurrency limit");
        check(fresh.get("responses").equals(pool.get("responses")),"Variants did not execute identical request semantics");
        check(fresh.get("workloadHash").equals(pool.get("workloadHash")),"Thread comparison changed workload");
        check(number(fresh,"avgLatencyMs")>0 && number(pool,"avgLatencyMs")>0,"Missing measured mean");
        check(number(fresh,"totalTimeMs")>0 && number(pool,"totalTimeMs")>0,"Missing measured wall time");
        check(number(result,"distinctPayloads")>3,"Thread workload must exercise varied payloads");
        for(var variant:List.of(fresh,pool)) {
            check(number(variant,"p95LatencyMs")>0 && number(variant,"totalTimeMs")>=number(variant,"p95LatencyMs"),"Invalid latency statistics");
            String prefix=variant==pool?PREFIX+"pool-":PREFIX+"fresh-";
            check(((List<String>)variant.get("workerNames")).stream().allMatch(name->name.startsWith(prefix)),"Workers are not explicitly named");
        }
    }

    @SuppressWarnings("unchecked")
    public static void validateAsyncComposition(Map<String,Object> result) {
        check("OK".equals(result.get("status")),"Async workload comparison is missing");
        var serial=(Map<String,Object>)result.get("serial");
        check(number(serial,"createdThreads")==0 && number(serial,"peakActive")==1,"Serial baseline did not use the caller sequentially");
        for(String mode:List.of("serial","thenCombine","allOf")) {
            var variant=(Map<String,Object>)result.get(mode);
            check(number(variant,"completedRequests")==18 && number(variant,"aggregates")==6,"Async comparison lost requests");
            check(serial.get("results").equals(variant.get("results")),"Async responses differ from serial baseline");
            check(serial.get("workloadHash").equals(variant.get("workloadHash")),"Async comparison changed payloads");
            check(number(variant,"avgLatencyMs")>0 && number(variant,"totalTimeMs")>0,"Missing actual timing");
            check(number(variant,"p95LatencyMs")>0 && number(variant,"totalTimeMs")>=number(variant,"p95LatencyMs"),"Invalid aggregate latency statistics");
            if(!mode.equals("serial"))check(number(variant,"createdThreads")==18 && number(variant,"peakActive")>1 && number(variant,"peakActive")<=18,"Async requests were not actually concurrent");
        }
    }
    public static void main(String[] args) throws Exception {
        var threads=threadReuse();validateThreadReuse(threads);
        var composition=asyncComposition();validateAsyncComposition(composition);
        for(Thread thread:Thread.getAllStackTraces().keySet())check(!thread.isAlive()||!thread.getName().startsWith(PREFIX),"Comparison leaked a thread: "+thread.getName());
        System.out.println("WORKLOAD_COMPARISONS_PASSED Java "+System.getProperty("java.version"));
    }
    private static double number(Map<String,Object> value,String key){return ((Number)value.get(key)).doubleValue();}
    private static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
}
