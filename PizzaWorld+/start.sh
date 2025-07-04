#!/bin/bash

# PizzaWorld Secure Start Script
# This script sets the required environment variables and starts the application

# Set environment variables (Demo credentials)
export DB_URL="jdbc:postgresql://aws-0-eu-central-1.pooler.supabase.com:6543/postgres?prepareThreshold=0"
export DB_USERNAME="postgres.xmjywzcuaajlmghgpcev"
export DB_PASSWORD="PizzaWorld.2025"
export JWT_SECRET="supergeheimerSchluessel123456789012345"

echo "🔒 Environment variables set securely"
echo "🚀 Starting PizzaWorld Backend..."

# Start the application
./mvnw spring-boot:run 