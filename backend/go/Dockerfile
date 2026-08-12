FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /sentinelpulse-backend main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /sentinelpulse-backend /usr/local/bin/sentinelpulse-backend

EXPOSE 8080
CMD ["sentinelpulse-backend"]
