package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID         int    `json:"user_id"`
	Email          string `json:"email"`
	OrganizationID string `json:"organization_id"`
	Role           string `json:"role"`
	jwt.RegisteredClaims
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func newClaims(userID int, email, orgID, role string, ttl time.Duration) Claims {
	return Claims{
		UserID:         userID,
		Email:          email,
		OrganizationID: orgID,
		Role:           role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "sentinelpulse-auth",
		},
	}
}

// GenerateToken preserves the legacy HS256 path for existing installations.
// New deployments should prefer GenerateTokenRS256 with a key pair.
func GenerateToken(userID int, email, orgID, role, secret string, ttl time.Duration) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, newClaims(userID, email, orgID, role, ttl))
	return token.SignedString([]byte(secret))
}

// GenerateTokenRS256 signs access tokens with an RSA private key supplied as
// PEM or base64-encoded PEM. The private material never leaves this process.
func GenerateTokenRS256(userID int, email, orgID, role, privateKeyMaterial string, ttl time.Duration) (string, error) {
	privateKey, err := parseRSAPrivateKey(privateKeyMaterial)
	if err != nil {
		return "", err
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, newClaims(userID, email, orgID, role, ttl))
	return token.SignedString(privateKey)
}

// ValidateToken preserves legacy HS256 validation for existing installations.
func ValidateToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, errors.New("invalid token claims")
}

// ValidateTokenRS256 validates only RS256 tokens against the configured RSA
// public key. Algorithm confusion with HS256 is intentionally rejected.
func ValidateTokenRS256(tokenStr, publicKeyMaterial string) (*Claims, error) {
	publicKey, err := parseRSAPublicKey(publicKeyMaterial)
	if err != nil {
		return nil, err
	}
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		return publicKey, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, errors.New("invalid token claims")
}

func parseRSAPrivateKey(material string) (*rsa.PrivateKey, error) {
	decoded, err := decodeKeyMaterial(material)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(decoded)
	if block == nil {
		return nil, errors.New("JWT_PRIVATE_KEY_RS256 must contain PEM or base64-encoded PEM")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("JWT_PRIVATE_KEY_RS256 is not a valid RSA private key")
}

// ValidateRS256KeyPair parses both configured keys and verifies that they belong together.
func ValidateRS256KeyPair(privateMaterial, publicMaterial string) error {
	privateKey, err := parseRSAPrivateKey(privateMaterial)
	if err != nil {
		return err
	}
	publicKey, err := parseRSAPublicKey(publicMaterial)
	if err != nil {
		return err
	}
	if privateKey.PublicKey.E != publicKey.E || privateKey.PublicKey.N.Cmp(publicKey.N) != 0 {
		return errors.New("JWT_PRIVATE_KEY_RS256 and JWT_PUBLIC_KEY_RS256 do not belong to the same key pair")
	}
	return nil
}

func parseRSAPublicKey(material string) (*rsa.PublicKey, error) {
	decoded, err := decodeKeyMaterial(material)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(decoded)
	if block == nil {
		return nil, errors.New("JWT_PUBLIC_KEY_RS256 must contain PEM or base64-encoded PEM")
	}
	if key, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("JWT_PUBLIC_KEY_RS256 is not a valid RSA public key")
}

func decodeKeyMaterial(material string) ([]byte, error) {
	trimmed := strings.TrimSpace(material)
	if trimmed == "" {
		return nil, errors.New("RSA key material is empty")
	}
	if strings.Contains(trimmed, "BEGIN") {
		return []byte(trimmed), nil
	}
	decoded, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil {
		return nil, fmt.Errorf("RSA key material is neither PEM nor base64 PEM: %w", err)
	}
	return decoded, nil
}
