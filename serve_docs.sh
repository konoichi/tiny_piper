#!/bin/bash
# Script to build and serve the documentation

# Check if mkdocs is installed
if ! command -v mkdocs &> /dev/null; then
    echo "❌ Error: mkdocs is not installed."
    echo "Please install it with: pip install mkdocs mkdocs-material pymdown-extensions"
    exit 1
fi

# Build the documentation
echo "🔨 Building documentation..."
mkdocs build

# Serve the documentation
echo "🚀 Starting documentation server..."
echo "📚 Documentation available at http://localhost:8000"
echo "Press Ctrl+C to stop the server."
mkdocs serve