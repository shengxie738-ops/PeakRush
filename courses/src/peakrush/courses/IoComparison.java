package peakrush.courses;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** Standalone loopback TCP blocking-I/O comparison and its executable contract checks. */
public final class IoComparison {
    private static final int SAMPLE_INTERVAL_MS = 5;
    private static final int MAX_TASKS = 256;
    private static final int MAX_IN_FLIGHT_CLIENTS = 128;
    private static final int MAX_DELAY_MS = 250;
    private static final int CLEANUP_TIMEOUT_MS = 2_000;
    private static final String THREAD_PREFIX = "peakrush-course-io-";
    private static final Method IS_VIRTUAL = optionalMethod(Thread.class, "isVirtual");

    private IoComparison() { }

    public static Map<String, Object> run(int tasks, int delayMs) throws Exception {
        if (tasks < 1 || tasks > MAX_TASKS || delayMs < 1 || delayMs > MAX_DELAY_MS) {
            throw new IllegalArgumentException("tasks must be 1.." + MAX_TASKS
                    + " and delayMs must be 1.." + MAX_DELAY_MS);
        }
        int poolSize = Math.min(16, tasks);
        int platformTimeoutMs = (int) Math.min(30_000L,
                Math.max(5_000L, ((tasks + poolSize - 1L) / poolSize) * delayMs + 5_000L));
        Map<String, Object> platform = runMode("platform", tasks, delayMs,
                platformTimeoutMs, () -> Executors.newFixedThreadPool(poolSize,
                        namedThreads("platform")));
        Method virtualFactory = optionalMethod(Executors.class, "newVirtualThreadPerTaskExecutor");
        Map<String, Object> virtual;
        if (virtualFactory == null || IS_VIRTUAL == null) {
            virtual = map("status", "SKIPPED", "completed", 0,
                    "reason", "Virtual threads require JDK 21+; current runtime is "
                            + System.getProperty("java.version"));
        } else {
            virtual = runMode("virtual", tasks, delayMs, delayMs + 5_000,
                    () -> (ExecutorService) invoke(virtualFactory, null));
        }
        return map("status", "OK", "javaVersion", System.getProperty("java.version"),
                "tasks", tasks, "serverDelayMs", delayMs, "platformPoolSize", poolSize,
                "maxInFlightClients", MAX_IN_FLIGHT_CLIENTS,
                "io", "Blocking loopback TCP request/read; scheduled server response",
                "latencyScope", "Immediately before submit until the matching TCP response",
                "resourceScope", "Whole JVM, including the loopback server and sampler; modes run sequentially",
                "platform", platform, "virtual", virtual);
    }

    private static Map<String, Object> runMode(String mode, int tasks, int delayMs,
                                               int timeoutMs, ExecutorFactory factory) throws Exception {
        long[] latencies = new long[tasks];
        AtomicInteger virtualTasks = new AtomicInteger();
        Semaphore connections = new Semaphore(Math.min(tasks, MAX_IN_FLIGHT_CLIENTS));
        int responses;
        int peakConnections;
        long started;
        long finished = 0;
        try (ResourceProbe probe = new ResourceProbe()) {
            try (ClientExecutor clients = new ClientExecutor(factory.create());
                 LoopbackServer server = new LoopbackServer(tasks, delayMs)) {
                List<Future<TaskResult>> futures = new ArrayList<>(tasks);
                started = System.nanoTime();
                long deadline = started + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
                for (int i = 0; i < tasks; i++) {
                    int token = i + 1;
                    long submitted = System.nanoTime();
                    futures.add(clients.executor.submit(() -> {
                        if (IS_VIRTUAL != null && Boolean.TRUE.equals(invoke(IS_VIRTUAL, Thread.currentThread()))) {
                            virtualTasks.incrementAndGet();
                        }
                        connections.acquire();
                        try {
                            Socket socket = clients.openSocket();
                            try (socket) {
                                socket.setTcpNoDelay(true);
                                socket.setSoTimeout(Math.min(timeoutMs, delayMs + 5_000));
                                socket.connect(server.address(), Math.min(timeoutMs, 3_000));
                                DataOutputStream request = new DataOutputStream(socket.getOutputStream());
                                request.writeInt(token);
                                request.flush();
                                int response = new DataInputStream(socket.getInputStream()).readInt();
                                if (response != token) {
                                    throw new IOException("Loopback server returned the wrong task token");
                                }
                                long completed = System.nanoTime();
                                return new TaskResult(completed - submitted, completed);
                            } finally {
                                clients.sockets.remove(socket);
                            }
                        } finally {
                            connections.release();
                        }
                    }));
                }
                for (int i = 0; i < tasks; i++) {
                    TaskResult task;
                    try {
                        task = futures.get(i).get(remaining(deadline), TimeUnit.NANOSECONDS);
                    } catch (ExecutionException error) {
                        throwCause(error.getCause());
                        throw new AssertionError("unreachable");
                    }
                    latencies[i] = task.latencyNanos;
                    finished = Math.max(finished, task.completedNanos);
                }
                server.awaitResponses(deadline);
                responses = server.responses.get();
                peakConnections = server.peakConnections.get();
            }
            Map<String, Object> resources = probe.finish();
            Arrays.sort(latencies);
            double sumNanos = 0;
            for (long latency : latencies) {
                sumNanos += latency;
            }
            double totalMs = (finished - started) / 1_000_000.0;
            return map("status", "OK", "mode", mode, "completed", tasks,
                    "avgLatencyMs", sumNanos / tasks / 1_000_000.0,
                    "p95LatencyMs", percentile(latencies, 0.95),
                    "p99LatencyMs", percentile(latencies, 0.99),
                    "totalTimeMs", totalMs, "throughputPerSecond", tasks * 1_000.0 / totalMs,
                    "virtualTaskThreads", virtualTasks.get(), "serverResponses", responses,
                    "peakServerConnections", peakConnections, "serverTimerThreads", 2,
                    "maxInFlightClients", MAX_IN_FLIGHT_CLIENTS,
                    "timeoutMs", timeoutMs, "resources", resources);
        }
    }

    private static double percentile(long[] sorted, double quantile) {
        return sorted[Math.max(0, (int) Math.ceil(sorted.length * quantile) - 1)] / 1_000_000.0;
    }

    /** One acceptor plus two response timers; no thread is created per connection. */
    private static final class LoopbackServer implements AutoCloseable {
        private final ServerSocket listener;
        private final ScheduledExecutorService replies;
        private final Thread acceptor;
        private final Set<Socket> sockets = ConcurrentHashMap.newKeySet();
        private final AtomicBoolean running = new AtomicBoolean(true);
        private final AtomicReference<Throwable> failure = new AtomicReference<>();
        private final AtomicInteger responses = new AtomicInteger();
        private final AtomicInteger peakConnections = new AtomicInteger();
        private final CountDownLatch allResponses;
        private final int delayMs;

        private LoopbackServer(int tasks, int delayMs) throws IOException {
            this.delayMs = delayMs;
            allResponses = new CountDownLatch(tasks);
            listener = new ServerSocket();
            try {
                listener.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0), tasks);
            } catch (IOException error) {
                listener.close();
                throw error;
            }
            replies = Executors.newScheduledThreadPool(2, namedThreads("server-reply"));
            acceptor = namedThreads("server-accept").newThread(this::acceptRequests);
            acceptor.start();
        }

        private InetSocketAddress address() {
            return new InetSocketAddress(listener.getInetAddress(), listener.getLocalPort());
        }

        private void acceptRequests() {
            while (running.get()) {
                Socket socket = null;
                try {
                    socket = listener.accept();
                    synchronized (sockets) {
                        if (!running.get()) {
                            socket.close();
                            return;
                        }
                        sockets.add(socket);
                    }
                    peakConnections.accumulateAndGet(sockets.size(), Math::max);
                    socket.setSoTimeout(2_000);
                    int token = new DataInputStream(socket.getInputStream()).readInt();
                    Socket connection = socket;
                    replies.schedule(() -> respond(connection, token), delayMs, TimeUnit.MILLISECONDS);
                } catch (Throwable error) {
                    if (socket != null) {
                        sockets.remove(socket);
                        closeQuietly(socket);
                    }
                    if (running.get()) {
                        failure.compareAndSet(null, error);
                        return;
                    }
                }
            }
        }

        private void respond(Socket socket, int token) {
            try (socket) {
                DataOutputStream response = new DataOutputStream(socket.getOutputStream());
                response.writeInt(token);
                response.flush();
                responses.incrementAndGet();
                allResponses.countDown();
            } catch (Throwable error) {
                if (running.get()) {
                    failure.compareAndSet(null, error);
                }
            } finally {
                sockets.remove(socket);
            }
        }

        private void awaitResponses(long deadline) throws Exception {
            if (!allResponses.await(remaining(deadline), TimeUnit.NANOSECONDS)) {
                throw new TimeoutException("Loopback server did not finish before the mode deadline");
            }
            Throwable error = failure.get();
            if (error != null) {
                throwCause(error);
            }
        }

        @Override
        public void close() throws IOException, TimeoutException {
            IOException closeFailure = null;
            synchronized (sockets) {
                running.set(false);
                try {
                    listener.close();
                } catch (IOException error) {
                    closeFailure = error;
                }
                for (Socket socket : sockets) {
                    try {
                        socket.close();
                    } catch (IOException error) {
                        if (closeFailure == null) closeFailure = error;
                        else closeFailure.addSuppressed(error);
                    }
                }
            }
            replies.shutdownNow();
            awaitShutdown(replies);
            join(acceptor);
            if (closeFailure != null) throw closeFailure;
            Throwable serverFailure = failure.get();
            if (serverFailure != null) throwResourceFailure(serverFailure);
        }
    }

    private static final class ClientExecutor implements AutoCloseable {
        private final ExecutorService executor;
        private final Set<Socket> sockets = ConcurrentHashMap.newKeySet();
        private boolean closed;

        private ClientExecutor(ExecutorService executor) {
            this.executor = executor;
        }

        private Socket openSocket() throws IOException {
            synchronized (sockets) {
                if (closed || Thread.currentThread().isInterrupted()) {
                    throw new IOException("Experiment stopped before opening a client socket");
                }
                Socket socket = new Socket();
                sockets.add(socket);
                return socket;
            }
        }

        @Override
        public void close() throws IOException, TimeoutException {
            IOException closeFailure = null;
            executor.shutdownNow();
            synchronized (sockets) {
                closed = true;
                for (Socket socket : sockets) {
                    try {
                        socket.close();
                    } catch (IOException error) {
                        if (closeFailure == null) closeFailure = error;
                        else closeFailure.addSuppressed(error);
                    }
                }
            }
            awaitShutdown(executor);
            if (closeFailure != null) throw closeFailure;
        }
    }

    /** CPU utilization is normalized by logical processors and derived from process CPU time. */
    private static final class ResourceProbe implements AutoCloseable {
        private final ScheduledExecutorService sampler = Executors.newSingleThreadScheduledExecutor(
                namedThreads("resource-sampler"));
        private final List<Map<String, Object>> samples = new ArrayList<>();
        private final AtomicReference<Throwable> failure = new AtomicReference<>();
        private final long origin = System.nanoTime();
        private final int processors = Runtime.getRuntime().availableProcessors();
        private long previousTime;
        private long previousCpu;
        private long peakHeap;
        private double peakCpu = -1;
        private double maxSamplingGapMs;
        private Map<String, Object> result;

        private ResourceProbe() {
            sample();
            sampler.scheduleAtFixedRate(this::sample, SAMPLE_INTERVAL_MS,
                    SAMPLE_INTERVAL_MS, TimeUnit.MILLISECONDS);
        }

        private synchronized void sample() {
            try {
                long now = System.nanoTime();
                long cpu = ProcessHandle.current().info().totalCpuDuration()
                        .map(Duration::toNanos).orElse(-1L);
                long heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
                double utilization = cpu < 0 ? -1 : 0;
                if (previousTime > 0) {
                    maxSamplingGapMs = Math.max(maxSamplingGapMs, (now - previousTime) / 1_000_000.0);
                    if (cpu >= 0 && previousCpu >= 0 && now > previousTime) {
                        utilization = Math.min(100.0, Math.max(0.0,
                                (cpu - previousCpu) * 100.0 / (now - previousTime) / processors));
                    }
                }
                peakHeap = Math.max(peakHeap, heap);
                peakCpu = Math.max(peakCpu, utilization);
                samples.add(map("elapsedMs", (now - origin) / 1_000_000.0,
                        "processCpuTimeMs", cpu < 0 ? -1.0 : cpu / 1_000_000.0,
                        "cpuUtilizationPercent", utilization, "heapUsedBytes", heap));
                previousTime = now;
                previousCpu = cpu;
            } catch (Throwable error) {
                failure.compareAndSet(null, error);
            }
        }

        private Map<String, Object> finish() throws IOException, TimeoutException {
            if (result != null) return result;
            sampler.shutdownNow();
            awaitShutdown(sampler);
            sample();
            Throwable error = failure.get();
            if (error != null) throwResourceFailure(error);
            Map<String, Object> baseline = samples.get(0);
            Map<String, Object> after = samples.get(samples.size() - 1);
            double beforeCpu = ((Number) baseline.get("processCpuTimeMs")).doubleValue();
            double afterCpu = ((Number) after.get("processCpuTimeMs")).doubleValue();
            result = map("baseline", baseline, "after", after,
                    "peaks", map("heapUsedBytes", peakHeap, "cpuUtilizationPercent", peakCpu,
                            "processCpuTimeMs", afterCpu),
                    "sampleIntervalMs", SAMPLE_INTERVAL_MS, "sampleCount", samples.size(),
                    "maxSamplingGapMs", maxSamplingGapMs, "logicalProcessors", processors,
                    "processCpuTimeDeltaMs", beforeCpu < 0 || afterCpu < 0 ? -1.0 : afterCpu - beforeCpu,
                    "cpuMetric", "process CPU time delta / wall time delta / logical processors * 100",
                    "cpuAvailability", beforeCpu < 0 ? "UNAVAILABLE" : "AVAILABLE",
                    "samples", List.copyOf(samples));
            return result;
        }

        @Override
        public void close() throws IOException, TimeoutException {
            finish();
        }
    }

    private interface ExecutorFactory {
        ExecutorService create() throws Exception;
    }

    private static final class TaskResult {
        private final long latencyNanos;
        private final long completedNanos;

        private TaskResult(long latencyNanos, long completedNanos) {
            this.latencyNanos = latencyNanos;
            this.completedNanos = completedNanos;
        }
    }

    private static ThreadFactory namedThreads(String purpose) {
        AtomicInteger index = new AtomicInteger();
        return task -> new Thread(task, THREAD_PREFIX + purpose + "-" + index.incrementAndGet());
    }

    private static Method optionalMethod(Class<?> owner, String name) {
        try {
            return owner.getMethod(name);
        } catch (NoSuchMethodException unavailable) {
            return null;
        }
    }

    private static Object invoke(Method method, Object target) throws Exception {
        try {
            return method.invoke(target);
        } catch (InvocationTargetException error) {
            throwCause(error.getCause());
            throw new AssertionError("unreachable");
        }
    }

    private static long remaining(long deadline) throws TimeoutException {
        long left = deadline - System.nanoTime();
        if (left <= 0) throw new TimeoutException("Blocking-I/O mode exceeded its deadline");
        return left;
    }

    private static void awaitShutdown(ExecutorService executor) throws TimeoutException {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(CLEANUP_TIMEOUT_MS);
        boolean interrupted = false;
        try {
            while (!executor.isTerminated()) {
                try {
                    if (!executor.awaitTermination(remaining(deadline), TimeUnit.NANOSECONDS)) {
                        throw new TimeoutException("Experiment executor did not terminate");
                    }
                } catch (InterruptedException error) {
                    interrupted = true;
                }
            }
        } finally {
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    private static void join(Thread thread) throws TimeoutException {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(CLEANUP_TIMEOUT_MS);
        boolean interrupted = false;
        try {
            while (thread.isAlive()) {
                try {
                    TimeUnit.NANOSECONDS.timedJoin(thread, remaining(deadline));
                } catch (InterruptedException error) {
                    interrupted = true;
                }
            }
        } finally {
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    private static void closeQuietly(Socket socket) {
        try {
            socket.close();
        } catch (SocketException ignored) {
            // The original read/write failure is retained by the caller.
        } catch (IOException ignored) {
            // The original read/write failure is retained by the caller.
        }
    }

    private static void throwCause(Throwable error) throws Exception {
        if (error instanceof Exception exception) throw exception;
        if (error instanceof Error fatal) throw fatal;
        throw new IllegalStateException(error);
    }

    private static void throwResourceFailure(Throwable error) throws IOException {
        if (error instanceof IOException io) throw io;
        if (error instanceof RuntimeException runtime) throw runtime;
        if (error instanceof Error fatal) throw fatal;
        throw new IOException("Experiment resource failed", error);
    }

    private static Map<String, Object> map(Object... entries) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) {
            result.put((String) entries[i], entries[i + 1]);
        }
        return Collections.unmodifiableMap(result);
    }

    /** Fails visibly without relying on the optional JVM -ea flag. */
    public static void validate(Map<String, Object> result) {
        check("OK".equals(result.get("status")), "comparison did not finish");
        int tasks = number(result, "tasks").intValue();
        int delayMs = number(result, "serverDelayMs").intValue();
        int poolSize = number(result, "platformPoolSize").intValue();
        check(tasks > 0 && delayMs > 0, "invalid experiment parameters");
        check(poolSize == Math.min(16, tasks), "platform pool is not bounded at 16");
        validateMode(object(result, "platform"), tasks, delayMs, poolSize, false);
        Map<String, Object> virtual = object(result, "virtual");
        if ("SKIPPED".equals(virtual.get("status"))) {
            check(virtual.get("reason") instanceof String reason && !reason.isBlank(),
                    "skipped virtual mode needs a reason");
        } else {
            validateMode(virtual, tasks, delayMs, tasks, true);
        }
    }

    private static void validateMode(Map<String, Object> mode, int tasks, int delayMs,
                                     int concurrency, boolean virtual) {
        check("OK".equals(mode.get("status")), "mode did not finish");
        check(number(mode, "completed").intValue() == tasks, "lost client tasks");
        check(number(mode, "serverResponses").intValue() == tasks, "missing TCP responses");
        double average = number(mode, "avgLatencyMs").doubleValue();
        double p95 = number(mode, "p95LatencyMs").doubleValue();
        double p99 = number(mode, "p99LatencyMs").doubleValue();
        double total = number(mode, "totalTimeMs").doubleValue();
        double throughput = number(mode, "throughputPerSecond").doubleValue();
        check(average >= delayMs * 0.8, "clients did not block until delayed TCP replies");
        check(p95 >= delayMs * Math.ceil(tasks * 0.95 / concurrency) * 0.7,
                "task latency must include time in the submission queue");
        check(p99 >= p95 && total >= p99, "latency statistics are inconsistent");
        check(Double.isFinite(throughput) && throughput > 0, "invalid throughput");
        check(Math.abs(throughput * total / 1000.0 - tasks) < 0.001,
                "throughput does not use total experiment time");
        check(number(mode, "virtualTaskThreads").intValue() == (virtual ? tasks : 0),
                "executor did not use the expected thread type");
        Map<String, Object> resources = object(mode, "resources");
        Map<String, Object> baseline = object(resources, "baseline");
        Map<String, Object> after = object(resources, "after");
        Map<String, Object> peaks = object(resources, "peaks");
        check(number(resources, "sampleCount").intValue() >= 2, "resource samples are missing");
        check(number(resources, "sampleIntervalMs").intValue() > 0, "missing sampling interval");
        double baselineHeap = number(baseline, "heapUsedBytes").doubleValue();
        double afterHeap = number(after, "heapUsedBytes").doubleValue();
        double peakHeap = number(peaks, "heapUsedBytes").doubleValue();
        check(peakHeap >= baselineHeap && peakHeap >= afterHeap, "heap peak omitted endpoints");
        double beforeCpu = number(baseline, "processCpuTimeMs").doubleValue();
        double afterCpu = number(after, "processCpuTimeMs").doubleValue();
        check(beforeCpu < 0 || afterCpu >= beforeCpu, "process CPU time moved backwards");
        check(number(mode, "peakServerConnections").intValue() <= tasks,
                "server connections escaped the task bound");
    }

    /** Compile with --release 17; run on JDK 17 and 21+ to exercise both branches. */
    public static void main(String[] args) throws Exception {
        for (int[] invalid : new int[][] {{0, 40}, {257, 40}, {80, 0}, {80, 251}}) {
            try {
                run(invalid[0], invalid[1]);
                throw new AssertionError("Unbounded input was accepted");
            } catch (IllegalArgumentException expected) {
                // Invalid parameters must fail before allocating experiment resources.
            }
        }
        int tasks = args.length > 0 ? Integer.parseInt(args[0]) : 80;
        int delayMs = args.length > 1 ? Integer.parseInt(args[1]) : 40;
        Map<String, Object> result = run(tasks, delayMs);
        validate(result);
        if (Runtime.version().feature() >= 21) {
            check("OK".equals(object(result, "virtual").get("status")),
                    "JDK 21+ must execute virtual-thread tasks");
        } else {
            check("SKIPPED".equals(object(result, "virtual").get("status")),
                    "JDK 17 must report virtual threads as skipped");
        }
        AtomicReference<Throwable> interruptedRunFailure = new AtomicReference<>();
        Thread interruptedRunner = new Thread(() -> {
            Thread.currentThread().interrupt();
            try {
                run(80, 250);
                interruptedRunFailure.set(new AssertionError("Interrupted experiment completed normally"));
            } catch (InterruptedException expected) {
                if (expected.getSuppressed().length != 0) {
                    interruptedRunFailure.set(new AssertionError("Interrupted cleanup failed", expected));
                }
            } catch (Throwable error) {
                interruptedRunFailure.set(error);
            }
        }, THREAD_PREFIX + "interruption-self-test");
        interruptedRunner.start();
        join(interruptedRunner);
        if (interruptedRunFailure.get() != null) throwCause(interruptedRunFailure.get());
        for (Thread thread : Thread.getAllStackTraces().keySet()) {
            check(!thread.isAlive() || !thread.getName().startsWith("peakrush-course-io-"),
                    "experiment leaked a thread: " + thread.getName());
        }
        Map<String, Object> platform = object(result, "platform");
        Map<String, Object> virtual = object(result, "virtual");
        System.out.println("IoComparison self-test PASS " + map(
                "javaVersion", result.get("javaVersion"), "tasks", tasks, "serverDelayMs", delayMs,
                "platformTotalMs", platform.get("totalTimeMs"),
                "platformAvgMs", platform.get("avgLatencyMs"),
                "platformP95Ms", platform.get("p95LatencyMs"),
                "platformP99Ms", platform.get("p99LatencyMs"),
                "platformSamples", object(platform, "resources").get("sampleCount"),
                "virtualStatus", virtual.get("status"),
                "virtualTotalMs", virtual.get("totalTimeMs"),
                "virtualAvgMs", virtual.get("avgLatencyMs"),
                "virtualP95Ms", virtual.get("p95LatencyMs"),
                "virtualP99Ms", virtual.get("p99LatencyMs")));
    }

    private static Number number(Map<String, Object> map, String key) {
        check(map.get(key) instanceof Number, "missing numeric field: " + key);
        return (Number) map.get(key);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Map<String, Object> map, String key) {
        check(map.get(key) instanceof Map<?, ?>, "missing object field: " + key);
        return (Map<String, Object>) map.get(key);
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}
