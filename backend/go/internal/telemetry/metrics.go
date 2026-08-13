package telemetry

import (
	"fmt"
	"net/http"
)

func HandleMetrics(rdbClientCount int, dbActiveConns int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		fmt.Fprintf(w, "# HELP sentinelpulse_redis_pool_connections Active Redis pool connections\n")
		fmt.Fprintf(w, "# TYPE sentinelpulse_redis_pool_connections gauge\n")
		fmt.Fprintf(w, "sentinelpulse_redis_pool_connections %d\n", rdbClientCount)

		fmt.Fprintf(w, "# HELP sentinelpulse_db_active_connections Active PostgreSQL connections\n")
		fmt.Fprintf(w, "# TYPE sentinelpulse_db_active_connections gauge\n")
		fmt.Fprintf(w, "sentinelpulse_db_active_connections %d\n", dbActiveConns)
	}
}
