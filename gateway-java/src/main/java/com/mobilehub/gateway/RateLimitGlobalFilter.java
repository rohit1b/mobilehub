package com.mobilehub.gateway;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

// Simple in-memory request logger + rate limiter (300 req/min per IP),
// equivalent to what the old Node gateway did, without needing Redis.
@Component
public class RateLimitGlobalFilter implements GlobalFilter, Ordered {

    private static final int LIMIT_PER_MINUTE = 300;
    private final ConcurrentHashMap<String, AtomicInteger> hits = new ConcurrentHashMap<>();

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        InetSocketAddress addr = exchange.getRequest().getRemoteAddress();
        String ip = addr != null && addr.getAddress() != null ? addr.getAddress().getHostAddress() : "unknown";
        String key = ip + ":" + (System.currentTimeMillis() / 60000);
        int count = hits.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet();

        System.out.println("[gateway] " + exchange.getRequest().getMethod() + " " + exchange.getRequest().getURI());

        if (count > LIMIT_PER_MINUTE) {
            exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            return exchange.getResponse().setComplete();
        }
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
