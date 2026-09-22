FROM golang:1.22-alpine AS builder

WORKDIR /build
RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o agent ./cmd/agent

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/agent .
EXPOSE 9100
CMD ["./agent"]
