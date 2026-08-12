package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"
)

type TokenRepository struct {
	db *sql.DB
}

func NewTokenRepository(db *sql.DB) *TokenRepository {
	return &TokenRepository{db: db}
}

func HashEnrollmentToken(rawToken string) string {
	h := sha256.New()
	h.Write([]byte(rawToken))
	return hex.EncodeToString(h.Sum(nil))
}

func (r *TokenRepository) CreateToken(orgID, rawToken string, expiresIn time.Duration) (string, error) {
	if r.db == nil {
		return "", fmt.Errorf("database connection is nil")
	}

	tokenHash := HashEnrollmentToken(rawToken)
	expiresAt := time.Now().UTC().Add(expiresIn)

	var id string
	query := `
		INSERT INTO enrollment_tokens (organization_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id
	`
	err := r.db.QueryRow(query, orgID, tokenHash, expiresAt).Scan(&id)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (r *TokenRepository) ConsumeAndRegisterEndpoint(rawToken, endpointID, hostname, serialNumber string) (bool, error) {
	if r.db == nil {
		return false, fmt.Errorf("database connection is nil")
	}

	tokenHash := HashEnrollmentToken(rawToken)

	tx, err := r.db.Begin()
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var orgID string
	var expiresAt time.Time
	var usedBy sql.NullString

	selectQuery := `SELECT organization_id, expires_at, used_by_endpoint_id FROM enrollment_tokens WHERE token_hash = $1 FOR UPDATE`
	err = tx.QueryRow(selectQuery, tokenHash).Scan(&orgID, &expiresAt, &usedBy)
	if err == sql.ErrNoRows {
		return false, fmt.Errorf("invalid enrollment token")
	} else if err != nil {
		return false, err
	}

	if usedBy.Valid || time.Now().UTC().After(expiresAt) {
		return false, fmt.Errorf("token already used or expired")
	}

	// Register endpoint
	epQuery := `
		INSERT INTO endpoints (id, organization_id, hostname, serial_number, status, last_seen_at)
		VALUES ($1, $2, $3, $4, 'online', NOW())
		ON CONFLICT (id) DO UPDATE SET status = 'online', last_seen_at = NOW()
	`
	_, err = tx.Exec(epQuery, endpointID, orgID, hostname, serialNumber)
	if err != nil {
		return false, err
	}

	// Consume token
	updateToken := `UPDATE enrollment_tokens SET used_by_endpoint_id = $1 WHERE token_hash = $2`
	_, err = tx.Exec(updateToken, endpointID, tokenHash)
	if err != nil {
		return false, err
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}

	return true, nil
}
