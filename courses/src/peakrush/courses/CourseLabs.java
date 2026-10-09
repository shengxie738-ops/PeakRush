package peakrush.courses;

import java.io.*;
import java.lang.management.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.*;

/** Isolated teaching experiments. Intentionally broken code never enters the application. */
public final class CourseLabs {
    private static final int TIMEOUT_SECONDS = 8;
    @FunctionalInterface interface Experiment { Map<String, Object> run() throws Exception; }
    @FunctionalInterface interface Buy { boolean run() throws Exception; }
    interface Channel { void put(int value) throws InterruptedException; int take() throws InterruptedException; }

    public static void main(String[] args) throws Exception {
        Path output = null;
        int tasks = 80, delay = 40;
        for (int n = 0; n < args.length; n++) {
            switch (args[n]) {
                case "--output": output = Path.of(args[++n]).toAbsolutePath(); break;
                case "--tasks": tasks = Integer.parseInt(args[++n]); break;
                case "--delay-ms": delay = Integer.parseInt(args[++n]); break;
                default: throw new IllegalArgumentException("Unknown argument: " + args[n]);
            }
        }
        if (output == null) throw new IllegalArgumentException("--output is required");
        require(tasks >= 16 && tasks <= 256 && delay >= 1 && delay <= 250, "Invalid bounded I/O workload");
        var report = runAll(tasks, delay);
        Files.createDirectories(output.getParent());
        Files.writeString(output, json(report) + System.lineSeparator(), StandardCharsets.UTF_8);
        CourseLabsAcceptance.verify(report);
        System.out.println("COURSE_LABS_PASSED " + output);
    }

    public static Map<String, Object> runAll(int tasks, int delayMs) {
        long started = System.nanoTime();
        List<Map<String, Object>> labs = new ArrayList<>();
        execute(labs, "inventory-race", CourseLabs::inventory);
        execute(labs, "deadlock", CourseLabs::deadlock);
        execute(labs, "monitor-producer-consumer", () -> producerConsumer(new MonitorChannel()));
        execute(labs, "condition-producer-consumer", () -> producerConsumer(new ConditionChannel()));
        execute(labs, "synchronizers", CourseLabs::synchronizers);
        execute(labs, "bounded-thread-pool", CourseLabs::boundedPool);
        execute(labs, "concurrent-containers", CourseLabs::containers);
        execute(labs, "thread-local", CourseLabs::threadLocal);
        execute(labs, "completable-future", CourseLabs::futures);
        execute(labs, "blocking-io", () -> {
            var result = IoComparison.run(tasks, delayMs);
            IoComparison.validate(result);
            return result;
        });
        return map("schemaVersion", 1, "generatedAt", Instant.now().toString(),
                "environment", map("javaVersion", System.getProperty("java.version"), "javaFeature", Runtime.version().feature(),
                        "javaHome", System.getProperty("java.home"), "os", System.getProperty("os.name"),
                        "availableProcessors", Runtime.getRuntime().availableProcessors(),
                        "pid", ProcessHandle.current().pid(), "applicationServicesUsed", false),
                "timeoutSecondsPerWait", TIMEOUT_SECONDS, "elapsedMs", ms(started),
                "labs", labs, "passed", labs.stream().allMatch(l -> "PASSED".equals(l.get("status"))),
                "limitations", List.of("Teaching experiments run in one independent JVM, not the business order pipeline.",
                        "Timing varies with JIT, CPU scheduling and other programs; no fixed speedup is asserted.",
                        "Blocking I/O comparison uses local TCP, including queue time, rather than MySQL workload.",
                        "JDK17 skips virtual threads; virtual results require an actual JDK21+ run."));
    }

    private static void execute(List<Map<String, Object>> labs, String id, Experiment operation) {
        long start = System.nanoTime();
        try {
            var result = operation.run();
            labs.add(map("id", id, "status", "PASSED", "elapsedMs", ms(start), "details", result));
            System.out.println("PASS " + id);
        } catch (Throwable failure) {
            labs.add(map("id", id, "status", "FAILED", "elapsedMs", ms(start),
                    "error", failure.toString()));
            System.err.println("FAIL " + id + ": " + failure);
        }
    }

    private static Map<String, Object> inventory() throws Exception {
        AtomicInteger unsafeStock = new AtomicInteger(1);
        CyclicBarrier checked = new CyclicBarrier(2);
        var unsafe = race(() -> {
            if (unsafeStock.get() <= 0) return false;
            checked.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            unsafeStock.decrementAndGet(); // The check and debit are deliberately separate.
            return true;
        }, unsafeStock);
        require((int) unsafe.get("accepted") == 2 && (int) unsafe.get("remaining") == -1, "Broken baseline did not oversell");
        Object monitor = new Object();
        AtomicInteger monitorStock = new AtomicInteger(1);
        var monitorResult = race(() -> {
            synchronized (monitor) { if (monitorStock.get() <= 0) return false; monitorStock.decrementAndGet(); return true; }
        }, monitorStock);
        ReentrantLock lock = new ReentrantLock();
        AtomicInteger lockStock = new AtomicInteger(1);
        var lockResult = race(() -> {
            lock.lockInterruptibly();
            try { if (lockStock.get() <= 0) return false; lockStock.decrementAndGet(); return true; }
            finally { lock.unlock(); }
        }, lockStock);
        AtomicInteger atomicStock = new AtomicInteger(1);
        var atomicResult = race(() -> atomicStock.compareAndSet(1, 0), atomicStock);
        for (var result : List.of(monitorResult, lockResult, atomicResult)) {
            require((int) result.get("accepted") == 1 && (int) result.get("remaining") == 0, "Safe stock violated conservation");
        }
        return map("initialStock", 1, "contenders", 2, "unsafe", unsafe,
                "synchronized", monitorResult, "reentrantLock", lockResult, "atomicInteger", atomicResult,
                "scope", "Single JVM check-then-act exercise; not a replacement for MySQL/Redis inventory.");
    }

    private static Map<String, Object> race(Buy buy, AtomicInteger stock) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2, factory("course-stock-"));
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        List<Future<Boolean>> calls = new ArrayList<>();
        long begin = System.nanoTime();
        try {
            for (int n = 0; n < 2; n++) calls.add(pool.submit(() -> { ready.countDown(); await(start); return buy.run(); }));
            await(ready); start.countDown();
            int accepted = 0;
            for (var call : calls) if (call.get(TIMEOUT_SECONDS, TimeUnit.SECONDS)) accepted++;
            return map("accepted", accepted, "remaining", stock.get(), "elapsedMs", ms(begin));
        } finally { start.countDown(); close(pool); }
    }

    private static Map<String, Object> deadlock() throws Exception {
        ReentrantLock a = new ReentrantLock(), b = new ReentrantLock();
        CyclicBarrier firstLocksHeld = new CyclicBarrier(2);
        AtomicInteger interrupted = new AtomicInteger();
        List<Throwable> unexpected = new CopyOnWriteArrayList<>();
        Thread one = daemon("course-deadlock-A", () -> deadlockWorker(a, b, firstLocksHeld, interrupted, unexpected));
        Thread two = daemon("course-deadlock-B", () -> deadlockWorker(b, a, firstLocksHeld, interrupted, unexpected));
        ThreadMXBean bean = ManagementFactory.getThreadMXBean();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(TIMEOUT_SECONDS);
        boolean detected = false;
        List<String> stacks = new ArrayList<>();
        Map<String, Object> jstack = map("status", "UNAVAILABLE", "reason", "JDK jstack executable missing");
        try {
            one.start(); two.start();
            while (System.nanoTime() < deadline) {
                long[] ids = bean.findDeadlockedThreads();
                if (ids != null && Arrays.stream(ids).anyMatch(id -> id == one.getId())
                        && Arrays.stream(ids).anyMatch(id -> id == two.getId())) {
                    detected = true;
                    for (ThreadInfo info : bean.getThreadInfo(new long[]{one.getId(), two.getId()}, true, true)) stacks.add(info.toString());
                    jstack = jstack();
                    break;
                }
                LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(10));
            }
        } finally {
            one.interrupt(); two.interrupt();
            one.join(2000); two.join(2000);
        }
        require(detected && !one.isAlive() && !two.isAlive() && interrupted.get() >= 1 && unexpected.isEmpty(),
                "Deadlock diagnosis or interruptible cleanup failed: " + unexpected);
        return map("detected", detected, "detector", "ThreadMXBean.findDeadlockedThreads",
                "threadsTerminated", true, "interruptedWorkers", interrupted.get(), "threadInfo", stacks,
                "jstack", jstack, "prevention", "Acquire a common lock order; cleanup uses lockInterruptibly and finally unlock.");
    }

    private static void deadlockWorker(ReentrantLock first, ReentrantLock second, CyclicBarrier both,
                                       AtomicInteger interrupted, List<Throwable> failures) {
        boolean hasFirst = false, hasSecond = false;
        try {
            first.lockInterruptibly(); hasFirst = true;
            both.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            second.lockInterruptibly(); hasSecond = true;
        } catch (InterruptedException expected) { interrupted.incrementAndGet(); Thread.currentThread().interrupt(); }
        catch (Throwable failure) { failures.add(failure); }
        finally { if (hasSecond) second.unlock(); if (hasFirst) first.unlock(); }
    }

    private static Map<String, Object> jstack() throws Exception {
        Path executable = Path.of(System.getProperty("java.home"), "bin", System.getProperty("os.name").startsWith("Windows") ? "jstack.exe" : "jstack");
        if (!Files.isRegularFile(executable)) return map("status", "UNAVAILABLE", "reason", "Missing " + executable);
        ExecutorService reader = Executors.newSingleThreadExecutor(factory("course-jstack-reader-"));
        Process process = null;
        try {
            process = new ProcessBuilder(executable.toString(), "-l", Long.toString(ProcessHandle.current().pid())).redirectErrorStream(true).start();
            InputStream input = process.getInputStream();
            var text = reader.submit(() -> new String(input.readAllBytes(), StandardCharsets.UTF_8));
            if (!process.waitFor(5, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return map("status", "TIMED_OUT", "timeoutSeconds", 5);
            }
            String dump = text.get(2, TimeUnit.SECONDS);
            int offset = dump.indexOf("Found one Java-level deadlock");
            String excerpt = offset >= 0 ? dump.substring(offset) : dump.lines().filter(line -> line.contains("course-deadlock")).reduce("", (x, y) -> x + y + "\n");
            require(process.exitValue() == 0 && dump.contains("course-deadlock-A") && dump.contains("course-deadlock-B"), "jstack did not capture the teaching threads");
            return map("status", "CAPTURED", "exitCode", process.exitValue(), "pid", ProcessHandle.current().pid(), "deadlockExcerpt", excerpt);
        } finally { if (process != null && process.isAlive()) process.destroyForcibly(); close(reader); }
    }

    static final class MonitorChannel implements Channel {
        final ArrayDeque<Integer> queue = new ArrayDeque<>();
        public synchronized void put(int value) throws InterruptedException {
            while (queue.size() == 4) wait();
            queue.addLast(value); notifyAll();
        }
        public synchronized int take() throws InterruptedException {
            while (queue.isEmpty()) wait();
            int value = queue.removeFirst(); notifyAll(); return value;
        }
    }
    static final class ConditionChannel implements Channel {
        final ArrayDeque<Integer> queue = new ArrayDeque<>();
        final ReentrantLock lock = new ReentrantLock();
        final Condition notEmpty = lock.newCondition(), notFull = lock.newCondition();
        public void put(int value) throws InterruptedException {
            lock.lockInterruptibly();
            try { while (queue.size() == 4) notFull.await(); queue.addLast(value); notEmpty.signal(); }
            finally { lock.unlock(); }
        }
        public int take() throws InterruptedException {
            lock.lockInterruptibly();
            try { while (queue.isEmpty()) notEmpty.await(); int value = queue.removeFirst(); notFull.signal(); return value; }
            finally { lock.unlock(); }
        }
    }
    private static Map<String, Object> producerConsumer(Channel channel) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2, factory("course-channel-"));
        try {
            var producer = pool.submit(() -> { for (int n = 1; n <= 100; n++) channel.put(n); channel.put(-1); return 100; });
            var consumer = pool.submit(() -> { List<Integer> values = new ArrayList<>(); for (;;) { int value = channel.take(); if (value == -1) return values; values.add(value); } });
            int produced = producer.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            List<Integer> values = consumer.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            require(values.size() == 100, "Lost/duplicate channel items");
            for (int n = 0; n < values.size(); n++) require(values.get(n) == n + 1, "FIFO violated");
            return map("capacity", 4, "produced", produced, "consumed", values.size(), "sum", values.stream().mapToInt(Integer::intValue).sum(), "fifoPreserved", true);
        } finally { close(pool); }
    }

    private static Map<String, Object> synchronizers() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(12, factory("course-sync-"));
        CountDownLatch ready = new CountDownLatch(12), start = new CountDownLatch(1), done = new CountDownLatch(12), firstWave = new CountDownLatch(3);
        Semaphore semaphore = new Semaphore(3);
        AtomicInteger active = new AtomicInteger(), peak = new AtomicInteger(), completed = new AtomicInteger(), admission = new AtomicInteger();
        List<Future<?>> calls = new ArrayList<>();
        try {
            for (int n = 0; n < 12; n++) calls.add(pool.submit(() -> {
                ready.countDown(); await(start); semaphore.acquire();
                int count = active.incrementAndGet(); peak.accumulateAndGet(count, Math::max);
                try { if (admission.incrementAndGet() <= 3) { firstWave.countDown(); await(firstWave); } completed.incrementAndGet(); }
                finally { active.decrementAndGet(); semaphore.release(); done.countDown(); }
                return null;
            }));
            await(ready); start.countDown(); await(done);
            for (var call : calls) call.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            AtomicInteger rounds = new AtomicInteger();
            CyclicBarrier barrier = new CyclicBarrier(4, rounds::incrementAndGet);
            calls.clear();
            for (int n = 0; n < 4; n++) calls.add(pool.submit(() -> { for (int round = 0; round < 3; round++) barrier.await(TIMEOUT_SECONDS, TimeUnit.SECONDS); return null; }));
            for (var call : calls) call.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            require(peak.get() == 3 && completed.get() == 12 && rounds.get() == 3 && semaphore.availablePermits() == 3, "Synchronizer invariant failed");
            return map("configuredPermits", 3, "peakPermitsInUse", peak.get(), "completed", completed.get(),
                    "latchParticipants", 12, "barrierParticipants", 4, "barrierRounds", rounds.get(), "permitsRestored", semaphore.availablePermits());
        } finally { start.countDown(); close(pool); }
    }

    private static Map<String, Object> boundedPool() throws Exception {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 2, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(2), factory("course-bounded-"), new ThreadPoolExecutor.AbortPolicy());
        CountDownLatch occupied = new CountDownLatch(2), release = new CountDownLatch(1);
        AtomicInteger completed = new AtomicInteger();
        Set<String> names = new ConcurrentSkipListSet<>();
        Runnable work = () -> { names.add(Thread.currentThread().getName()); occupied.countDown(); try { await(release); completed.incrementAndGet(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } };
        int rejected = 0, queued;
        try {
            pool.execute(work); pool.execute(work); await(occupied);
            pool.execute(work); pool.execute(work); queued = pool.getQueue().size();
            try { pool.execute(work); } catch (RejectedExecutionException expected) { rejected++; }
            release.countDown(); pool.shutdown(); require(pool.awaitTermination(TIMEOUT_SECONDS, TimeUnit.SECONDS), "Pool did not terminate");
            require(queued == 2 && rejected == 1 && completed.get() == 4, "Saturated bounded pool contract failed");
            return map("coreThreads", 2, "maximumThreads", 2, "queueCapacity", 2, "queueAtSaturation", queued,
                    "rejectionPolicy", "AbortPolicy", "rejected", rejected, "completed", completed.get(), "workerNames", new ArrayList<>(names),
                    "threadReuseComparison", WorkloadComparisons.threadReuse());
        } finally { release.countDown(); close(pool); }
    }

    private static Map<String, Object> containers() throws Exception {
        Map<String, Object> locked = countMap(false), concurrent = countMap(true);
        require((int) locked.get("total") == 40000 && (int) concurrent.get("total") == 40000, "Lost map updates");
        return map("workers", 4, "incrementsPerWorker", 10000, "lockedHashMap", locked, "concurrentHashMap", concurrent,
                "operation", "Compound increment is protected by a manual lock or ConcurrentHashMap.merge.",
                "timingCaveat", "One measured sample per variant; no statistical claim or guaranteed speedup.");
    }
    private static Map<String, Object> countMap(boolean concurrent) throws Exception {
        Map<Integer, Integer> values = concurrent ? new ConcurrentHashMap<>() : new HashMap<>();
        ReentrantLock lock = new ReentrantLock();
        ExecutorService pool = Executors.newFixedThreadPool(4, factory("course-map-"));
        List<Future<?>> calls = new ArrayList<>();
        CountDownLatch ready = new CountDownLatch(4), start = new CountDownLatch(1);
        long begin = System.nanoTime();
        try {
            for (int worker = 0; worker < 4; worker++) calls.add(pool.submit(() -> {
                ready.countDown(); await(start);
                for (int n = 0; n < 10000; n++) {
                    int key = n % 4;
                    if (concurrent) values.merge(key, 1, Integer::sum);
                    else { lock.lock(); try { values.put(key, values.getOrDefault(key, 0) + 1); } finally { lock.unlock(); } }
                }
                return null;
            }));
            await(ready); start.countDown();
            for (var call : calls) call.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return map("total", values.values().stream().mapToInt(Integer::intValue).sum(), "keys", values.size(), "elapsedMs", ms(begin));
        } finally { start.countDown(); close(pool); }
    }

    private static Map<String, Object> threadLocal() throws Exception {
        ThreadLocal<String> context = new ThreadLocal<>();
        ExecutorService pool = Executors.newSingleThreadExecutor(factory("course-context-"));
        try {
            String worker = pool.submit(() -> { context.set("alice"); return Thread.currentThread().getName(); }).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            String leaked = pool.submit(context::get).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            boolean errorPropagated = false;
            try { pool.submit(() -> { try { context.set("bob"); throw new IllegalStateException("demonstration failure"); } finally { context.remove(); } }).get(TIMEOUT_SECONDS, TimeUnit.SECONDS); }
            catch (ExecutionException expected) { errorPropagated = expected.getCause() instanceof IllegalStateException; }
            String after = pool.submit(context::get).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            String nextWorker = pool.submit(() -> Thread.currentThread().getName()).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            require("alice".equals(leaked) && after == null && worker.equals(nextWorker) && errorPropagated, "ThreadLocal was not removed on error");
            return map("leakedBeforeCleanup", leaked, "afterCleanup", after, "sameWorkerReused", worker.equals(nextWorker),
                    "worker", worker, "exceptionPropagated", errorPropagated, "cleanup", "finally { context.remove(); }");
        } finally { close(pool); }
    }

    private static Map<String, Object> futures() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(3, factory("course-future-"));
        CountDownLatch bothEntered = new CountDownLatch(2), release = new CountDownLatch(1);
        try {
            CompletableFuture<Integer> left = CompletableFuture.supplyAsync(() -> awaitValue(bothEntered, release, 20), pool);
            CompletableFuture<Integer> right = CompletableFuture.supplyAsync(() -> awaitValue(bothEntered, release, 22), pool);
            await(bothEntered); release.countDown();
            int combined = left.thenCombine(right, Integer::sum).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            List<CompletableFuture<Integer>> parts = new ArrayList<>();
            for (int n = 1; n <= 3; n++) { int value = n; parts.add(CompletableFuture.supplyAsync(() -> value, pool)); }
            CompletableFuture.allOf(parts.toArray(CompletableFuture[]::new)).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            int sum = parts.stream().mapToInt(CompletableFuture::join).sum();
            CompletableFuture<Integer> failure = CompletableFuture.supplyAsync(() -> { throw new IllegalArgumentException("dependency failed"); }, pool);
            boolean propagated = false;
            try { CompletableFuture.allOf(left, failure).get(TIMEOUT_SECONDS, TimeUnit.SECONDS); }
            catch (ExecutionException expected) { propagated = expected.getCause() instanceof IllegalArgumentException; }
            int recovered = failure.exceptionally(error -> -1).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            require(combined == 42 && sum == 6 && propagated && recovered == -1, "Future composition or error propagation failed");
            return map("combined", combined, "allOfSum", sum, "exceptionPropagated", propagated, "explicitRecoveryValue", recovered,
                    "parallelTasksReachedGate", 2, "executor", "Explicit bounded-size executor; no implicit common pool.",
                    "interfaceComparison", WorkloadComparisons.asyncComposition());
        } finally { release.countDown(); close(pool); }
    }
    private static int awaitValue(CountDownLatch ready, CountDownLatch release, int value) {
        ready.countDown();
        try { await(release); return value; }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new CompletionException(e); }
    }

    private static Thread daemon(String name, Runnable task) { Thread t = new Thread(task, name); t.setDaemon(true); return t; }
    private static ThreadFactory factory(String prefix) { AtomicInteger counter = new AtomicInteger(); return task -> daemon(prefix + counter.incrementAndGet(), task); }
    private static void await(CountDownLatch latch) throws InterruptedException { require(latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS), "Latch timed out"); }
    private static void close(ExecutorService executor) throws InterruptedException { executor.shutdownNow(); require(executor.awaitTermination(2, TimeUnit.SECONDS), "Executor cleanup timed out"); }
    private static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    private static double ms(long begin) { return Math.round((System.nanoTime() - begin) / 1000.0) / 1000.0; }
    private static Map<String, Object> map(Object... entries) { Map<String, Object> result = new LinkedHashMap<>(); for (int n = 0; n < entries.length; n += 2) result.put((String) entries[n], entries[n + 1]); return result; }
    private static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> values) { List<String> parts = new ArrayList<>(); values.forEach((key, item) -> parts.add(json(key.toString()) + ":" + json(item))); return "{" + String.join(",", parts) + "}"; }
        if (value instanceof Collection<?> values) return "[" + String.join(",", values.stream().map(CourseLabs::json).toList()) + "]";
        StringBuilder out = new StringBuilder("\"");
        for (char c : value.toString().toCharArray()) switch (c) {
            case '"': out.append("\\\""); break;
            case '\\': out.append("\\\\"); break;
            case '\n': out.append("\\n"); break;
            case '\r': out.append("\\r"); break;
            case '\t': out.append("\\t"); break;
            default: if (c < 32) out.append(String.format("\\u%04x", (int) c)); else out.append(c);
        }
        return out.append('"').toString();
    }
}
