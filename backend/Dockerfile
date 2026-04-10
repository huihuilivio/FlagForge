FROM golang:1.21-alpine AS builder
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o flagforge-backend .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/flagforge-backend .
EXPOSE 8080
CMD ["./flagforge-backend"]
