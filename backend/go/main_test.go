package main

import "testing"

func TestNewRedisClientParsesRedisURI(t *testing.T) {
	client := newRedisClient("redis://redis:6379/0")
	defer client.Close()

	if got := client.Options().Addr; got != "redis:6379" {
		t.Fatalf("expected redis URI to resolve to redis:6379, got %q", got)
	}
}

func TestNewRedisClientAcceptsHostPort(t *testing.T) {
	client := newRedisClient("redis:6379")
	defer client.Close()

	if got := client.Options().Addr; got != "redis:6379" {
		t.Fatalf("expected host:port to remain unchanged, got %q", got)
	}
}
