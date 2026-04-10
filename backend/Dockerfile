FROM golang:1.24-alpine AS builder
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o flagforge-backend .

FROM alpine:latest
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/flagforge-backend .
EXPOSE 8080
ENV DB_PATH=/app/data/flagforge.db
VOLUME /app/data
CMD ["./flagforge-backend"]
