package repository

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/lib/pq"
)

func ConnectDB(databaseUrl string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseUrl)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

func RunMigrations(db *sql.DB) error {
	migrationPaths := []string{
		filepath.Join("migrations", "001_initial_schema.sql"),
		filepath.Join("migrations", "002_msi_auto_enrollment.sql"),
		filepath.Join("migrations", "003_diagnostic_events.sql"),
		filepath.Join("migrations", "004_truthful_metrics.sql"),
		filepath.Join("migrations", "005_endpoint_lifecycle_states.sql"),
	}
	for index := range migrationPaths {
		if _, err := os.Stat(migrationPaths[index]); os.IsNotExist(err) {
			migrationPaths[index] = filepath.Join("backend", "go", migrationPaths[index])
		}
	}

	for _, migrationPath := range migrationPaths {
		content, err := os.ReadFile(migrationPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", migrationPath, err)
		}
		if _, err = db.Exec(string(content)); err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", migrationPath, err)
		}
	}
	return nil
}
