provider "aws" {
  region = var.aws_region # sa-east-1
}

module "vpc" {
  source = "./modules/vpc"
  cidr   = var.vpc_cidr
}

module "eks" {
  source      = "./modules/eks"
  vpc_id      = module.vpc.id
  subnet_ids  = module.vpc.private_subnet_ids
  node_count  = 3
}

module "rds" {
  source     = "./modules/rds"
  engine     = "postgres"
  version    = "15.4"
  multi_az   = true
  subnet_ids = module.vpc.private_subnet_ids
}

module "kafka" {
  source     = "./modules/kafka" # MSK Serverless
  subnet_ids = module.vpc.private_subnet_ids
}

module "s3_worm" {
  source          = "./modules/s3-worm"
  bucket_name     = "${var.project}-audit-logs"
  object_lock     = true
  retention_years = 7
}

module "waf" {
  source       = "./modules/waf"
  alb_arn      = module.eks.alb_arn
  rate_limit   = 5000
  geo_blocks   = ["BR"]
}
