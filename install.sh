#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}→${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_debug() {
    echo -e "${BLUE}🔍${NC} $1"
}

# Function to check and start container system service
ensure_container_system() {
    log_info "Checking container system status..."
    
    # Check if container command exists
    if ! command -v container &>/dev/null; then
        log_error "Apple container CLI not found. Please install it first."
        return 1
    fi
    
    # Check system status
    local status_output
    if status_output=$(container system status 2>&1); then
        if [[ "$status_output" == *"apiserver is running"* ]]; then
            log_info "Container system already running"
            return 0
        fi
    fi
    
    log_warn "Container system not running, attempting to start..."
    
    # Stop any stale processes first
    log_debug "Stopping any existing container processes..."
    sudo container system stop 2>/dev/null || true
    
    # Small delay to ensure clean shutdown
    sleep 2
    
    # Start the container system
    log_info "Starting container system service..."
    if sudo container system start; then
        log_info "Container system started successfully"
        
        # Wait a bit for the system to be ready
        log_debug "Waiting for container system to be ready..."
        sleep 3
        
        # Verify it's actually running
        if container system status 2>&1 | grep -q "apiserver is running"; then
            log_info "Container system verified as running"
            return 0
        else
            log_error "Container system failed to start properly"
            return 1
        fi
    else
        log_error "Failed to start container system"
        return 1
    fi
}

# Function to cleanup existing containers
cleanup_existing_container() {
    local container_name="$1"
    
    log_debug "Checking for existing '$container_name' containers..."
    
    # List containers to see if our target exists
    local container_list
    if container_list=$(container list 2>/dev/null); then
        if echo "$container_list" | grep -q "$container_name"; then
            log_warn "Found existing '$container_name' container, cleaning up..."
            
            # Try to stop it first
            if container stop "$container_name" 2>/dev/null; then
                log_info "Stopped existing '$container_name' container"
                sleep 1
            fi
            
            # Try to remove it
            if container rm "$container_name" 2>/dev/null; then
                log_info "Removed existing '$container_name' container"
            else
                log_warn "Could not remove existing '$container_name' container"
            fi
        else
            log_debug "No existing '$container_name' container found"
        fi
    else
        log_warn "Could not list containers to check for existing '$container_name'"
    fi
}

# Function to run container command with retry and better error handling
run_container_command_with_retry() {
    local max_attempts=3
    local attempt=1
    local cmd="$1"
    local description="${2:-$cmd}"
    
    while [ $attempt -le $max_attempts ]; do
        log_debug "Attempt $attempt/$max_attempts: $description"
        
        # Execute the command and capture both stdout and stderr
        local output
        local exit_code=0
        
        if output=$(eval "$cmd" 2>&1); then
            echo "$output"
            return 0
        else
            exit_code=$?
            log_warn "Command failed (attempt $attempt/$max_attempts): $description"
            
            # Check for specific error patterns
            if [[ "$output" == *"XPC connection error"* ]] || [[ "$output" == *"Connection invalid"* ]]; then
                log_warn "XPC connection error detected, container system may need restart"
                
                if [ $attempt -lt $max_attempts ]; then
                    if ! ensure_container_system; then
                        log_error "Failed to restart container system"
                        return 1
                    fi
                fi
            elif [[ "$output" == *"already exists"* ]]; then
                log_warn "Resource already exists: $output"
                # For "already exists" errors, we can often continue
                return 0
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                log_error "All attempts failed for: $description"
                echo "$output" >&2
                return $exit_code
            fi
            
            attempt=$((attempt + 1))
            log_debug "Waiting before retry..."
            sleep 2
        fi
    done
}

# Function to robustly install coderunner with all the steps from their install.sh
install_coderunner_robustly() {
    log_info "Installing coderunner with robust error handling..."
    
    # 1. Ensure container system is running
    if ! ensure_container_system; then
        log_error "Cannot proceed without container system"
        return 1
    fi
    
    # 2. Setup DNS domain (handle "already exists" gracefully)
    log_info "Setting up local network domain..."
    if ! run_container_command_with_retry "sudo container system dns create local" "Create local DNS domain"; then
        # This might fail if domain already exists, check if it actually exists
        if container system dns list 2>/dev/null | grep -q "local"; then
            log_info "Local DNS domain already exists, continuing..."
        else
            log_error "Failed to create local DNS domain"
            return 1
        fi
    fi
    
    # 3. Set default DNS domain
    if ! run_container_command_with_retry "container system dns default set local" "Set default DNS domain"; then
        log_error "Failed to set default DNS domain"
        return 1
    fi
    
    # 4. Start container system again (coderunner script does this)
    if ! ensure_container_system; then
        log_error "Container system failed after DNS setup"
        return 1
    fi
    
    # 5. Pull the image with retry
    log_info "Pulling latest instavm/coderunner image..."
    if ! run_container_command_with_retry "container image pull instavm/coderunner" "Pull coderunner image"; then
        log_error "Failed to pull coderunner image"
        return 1
    fi
    
    # 6. Ensure assets directory
    log_debug "Ensuring coderunner assets directory..."
    ASSETS_SRC="$HOME/.coderunner/assets"
    mkdir -p "$ASSETS_SRC"
    
    # 7. Clean up any existing coderunner container
    cleanup_existing_container "coderunner"
    
    # 8. Run the container with retry logic
    log_info "Starting coderunner container..."
    local run_cmd="container run --volume \"$ASSETS_SRC:/app/uploads\" --name coderunner --detach --rm --cpus 8 --memory 4g instavm/coderunner"
    
    if ! run_container_command_with_retry "$run_cmd" "Start coderunner container"; then
        log_error "Failed to start coderunner container"
        return 1
    fi
    
    # 9. Verify the container is actually running
    log_debug "Verifying coderunner container is running..."
    sleep 2
    
    if container list 2>/dev/null | grep -q "coderunner"; then
        log_info "✅ Coderunner container is running successfully"
    else
        log_warn "Coderunner container may not be running properly"
    fi
    
    return 0
}


log_info "Ensuring coderunner assets directory…"
ASSETS_SRC="$HOME/.coderunner/assets"
mkdir -p "$ASSETS_SRC"

# If public/assets exists as a real dir, move its contents into ASSETS_SRC
if [ -d "public/assets" ] && [ ! -L "public/assets" ]; then
  log_info "Migrating existing public/assets → $ASSETS_SRC"
  cp -R public/assets/. "$ASSETS_SRC"/
  rm -rf public/assets
fi

if [ -L public/assets ] && [ "$(readlink public/assets)" = "$ASSETS_SRC" ]; then
  log_info "public/assets already linked → $ASSETS_SRC"
else
  log_info "Creating symlink public/assets → $ASSETS_SRC"
  ln -s "$ASSETS_SRC" public/assets
fi
# 1) Ensure Go is installed, then install mcp-filesystem-server
log_info "Installing mcp-filesystem-server..."
if ! command -v mcp-filesystem-server &>/dev/null; then
  if ! command -v go &>/dev/null; then
    log_error "Go not found. Please install Go: https://golang.org/dl/"
    exit 1
  fi
  log_debug "running: go install github.com/mark3labs/mcp-filesystem-server@latest"
  GO111MODULE=on go install github.com/mark3labs/mcp-filesystem-server@latest
else
  log_info "mcp-filesystem-server already on PATH"
fi

# 2) Clone & install coderunner
CODERUNNER_DIR="$HOME/coderunner"
log_info "Installing coderunner..."
# ... existing code ...

if [ ! -d "$CODERUNNER_DIR" ]; then
  git clone https://github.com/BandarLabs/coderunner.git "$CODERUNNER_DIR"
  cd "$CODERUNNER_DIR"
  chmod +x install.sh
  
  # Run the coderunner installation with our robust wrapper
  if install_coderunner_robustly; then
    log_info "coderunner server started successfully"
  else
    log_error "coderunner install failed"
    cd - &>/dev/null
    exit 1
  fi
  cd - &>/dev/null
else
  log_info "coderunner already cloned at $CODERUNNER_DIR → fetching updates"
  cd "$CODERUNNER_DIR"
  git fetch --all
  git reset --hard origin/main    # or replace origin/main with your branch
  chmod +x install.sh
  
  # Ensure container system is running before updating
  if ! ensure_container_system; then
    log_error "Container system is not available, cannot update coderunner"
    cd - &>/dev/null
    exit 1
  fi
  
  # Clean up any existing coderunner container before updating
  cleanup_existing_container "coderunner"
  
  # Run the coderunner installation with our robust wrapper
  if install_coderunner_robustly; then
    log_info "coderunner server updated successfully"
  else
    log_error "coderunner install script failed"
    # Don't exit here, continue with the rest of the setup
  fi
  cd - &>/dev/null
fi
# 3) Bootstrap your chat app
log_info "Installing chat app dependencies…"
if npm install; then
  log_info "Dependencies installed successfully"
else
  log_warn "Some npm dependencies may have issues (check npm audit output above)"
fi

# 4) Generate .env (if not present)
if [ ! -f ".env.local" ]; then
  log_info "Writing .env.local…"
  cat > .env.local <<EOF
# Path to the mcp-filesystem-server binary
MCP_FILESYSTEM_CMD=${HOME}/go/bin/mcp-filesystem-server

# Where your static assets live
MCP_FS_ASSETS_DIR=\${PWD}/public/assets

# Default workspace directory
MCP_FS_WORKSPACE_DIR=\${HOME}/Documents

# (Optional) adjust coderunner URL if not using localhost
CODERUNNER_SSE_URL=http://coderunner.local:8222/sse
EOF
  log_info ".env.local created – review & edit as needed"
else
  log_info ".env.local already exists, skipping"
fi

echo
log_info "✅ Setup complete!"
log_info "Start your Next.js app with: npm run dev"
log_debug "MCP server should be available at http://coderunner.local:8222/mcp"