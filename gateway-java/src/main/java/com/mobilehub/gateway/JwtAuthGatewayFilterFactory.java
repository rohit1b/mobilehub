package com.mobilehub.gateway;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

// Verifies the JWT issued by auth-service (Node) before letting a request
// through to cart-service / order-service. Used in application.yml as "JwtAuth".
@Component
public class JwtAuthGatewayFilterFactory extends AbstractGatewayFilterFactory<Object> {

    @Value("${jwt.secret}")
    private String secret;

    public JwtAuthGatewayFilterFactory() {
        super(Object.class);
    }

    @Override
    public GatewayFilter apply(Object config) {
        return (exchange, chain) -> {
            String header = exchange.getRequest().getHeaders().getFirst("Authorization");
            if (header == null || !header.startsWith("Bearer ")) {
                return unauthorized(exchange);
            }
            try {
                SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
                Claims claims = Jwts.parserBuilder().setSigningKey(key).build()
                        .parseClaimsJws(header.substring(7)).getBody();
                ServerWebExchange mutated = exchange.mutate()
                        .request(r -> r.header("X-User-Id", String.valueOf(claims.get("id"))))
                        .build();
                return chain.filter(mutated);
            } catch (JwtException | IllegalArgumentException e) {
                return unauthorized(exchange);
            }
        };
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }
}
