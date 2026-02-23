packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
    googlecompute = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

# --------------------------------------------------------------------------- #
# Variables
# --------------------------------------------------------------------------- #

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_demo_account_id" {
  type    = string
  default = "631259293293"
}

variable "gcp_dev_project_id" {
  type    = string
  default = "csye6225-dev-487215"
}

variable "gcp_demo_project_id" {
  type    = string
  default = "csye6225-demo-487215"
}

variable "gcp_zone" {
  type    = string
  default = "us-east1-b"
}

variable "app_version" {
  type    = string
  default = "latest"
}

# --------------------------------------------------------------------------- #
# AWS Source
# --------------------------------------------------------------------------- #

source "amazon-ebs" "ubuntu" {
  region                = var.aws_region
  ami_name              = "csye6225-webapp-${formatdate("YYYY-MM-DD-hh-mm-ss", timestamp())}"
  ami_description       = "Custom AMI for CSYE6225 web application"
  instance_type         = "t2.micro"
  force_deregister      = true
  force_delete_snapshot = true

  # Find the latest Ubuntu 24.04 LTS AMI automatically
  source_ami_filter {
    filters = {
      name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
      root-device-type    = "ebs"
      virtualization-type = "hvm"
    }
    most_recent = true
    owners      = ["099720109477"] # Canonical's official AWS account
  }

  ssh_username = "ubuntu"

  # Share AMI with DEMO account after build
  ami_users = [var.aws_demo_account_id]

  tags = {
    Name        = "csye6225-webapp"
    Environment = "dev"
    Course      = "csye6225"
  }
}

# --------------------------------------------------------------------------- #
# GCP Source
# --------------------------------------------------------------------------- #

source "googlecompute" "ubuntu" {
  project_id          = var.gcp_dev_project_id
  zone                = var.gcp_zone
  image_name          = "csye6225-webapp-${formatdate("YYYY-MM-DD-hh-mm-ss", timestamp())}"
  image_description   = "Custom GCP image for CSYE6225 web application"
  machine_type        = "e2-medium"
  source_image_family = "ubuntu-2404-lts-amd64"
  ssh_username        = "packer"
  disk_size           = 20
  disk_type           = "pd-standard"
  omit_external_ip    = false
  ssh_timeout         = "10m"
  network             = "default"

  image_labels = {
    environment = "dev"
    course      = "csye6225"
  }
  use_os_login = false
  metadata = {
    enable-oslogin = "FALSE"
  }
}

# --------------------------------------------------------------------------- #
# Build
# --------------------------------------------------------------------------- #

build {
  name = "csye6225-webapp"
  sources = [
    "source.amazon-ebs.ubuntu",
    "source.googlecompute.ubuntu"
  ]

  # Copy application zip to the instance
  provisioner "file" {
    source      = "webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  # Copy systemd service file
  provisioner "file" {
    source      = "packer/webapp.service"
    destination = "/tmp/webapp.service"
  }

  # Run setup script
  provisioner "shell" {
    inline = [
      # Wait for apt to be available
      "sudo cloud-init status --wait || true",
      "sudo apt-get update -y",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y",

      # Install Node.js 18
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt-get install -y nodejs",

      # Install PostgreSQL
      "sudo apt-get install -y postgresql postgresql-contrib",
      "sudo systemctl enable postgresql",

      # Install unzip
      "sudo apt-get install -y unzip",

      # Create group and user csye6225 with no login shell
      "sudo groupadd --force csye6225",
      "sudo useradd --system --no-create-home --shell /usr/sbin/nologin --gid csye6225 csye6225 || true",

      # Create app directory
      "sudo mkdir -p /opt/csye6225",

      # Unzip application
      "sudo unzip /tmp/webapp.zip -d /opt/csye6225",

      # Install node dependencies
      "cd /opt/csye6225 && sudo npm ci --omit=dev",

      # Set ownership
      "sudo chown -R csye6225:csye6225 /opt/csye6225",

      # Install systemd service
      "sudo mv /tmp/webapp.service /etc/systemd/system/webapp.service",
      "sudo chown root:root /etc/systemd/system/webapp.service",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable webapp"
    ]
  }

  # Share GCP image with DEMO project after build
  # Grants DEMO project's GCP APIs service account access to use the image
  post-processor "shell-local" {
    only = ["googlecompute.ubuntu"]
    inline = [
      "gcloud projects add-iam-policy-binding ${var.gcp_dev_project_id} --member=serviceAccount:$(gcloud projects describe ${var.gcp_demo_project_id} --format='value(projectNumber)')@cloudservices.gserviceaccount.com --role=roles/compute.imageUser"
    ]
  }
}